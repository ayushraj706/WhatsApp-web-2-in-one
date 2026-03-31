import { prisma } from "@/lib/prisma";
import { batchResolveToPhoneJid, normalizeJid } from "@/lib/jid-utils";
import { waManager } from "@/modules/whatsapp/manager";
import Sticker from "wa-sticker-formatter";

export class ChatService {
    /**
     * Get the active chats list for a session, including last message preview.
     */
    static async getChatsList(dbSessionId: string) {
        const contacts = await prisma.contact.findMany({
            where: { sessionId: dbSessionId },
            orderBy: { updatedAt: 'desc' },
            select: { jid: true, name: true, notify: true, profilePic: true }
        });

        const messagesWithDistinctJids = await prisma.message.findMany({
            where: { sessionId: dbSessionId },
            distinct: ['remoteJid'],
            select: { remoteJid: true }
        });

        const allJids = new Set([
            ...contacts.map(c => c.jid),
            ...messagesWithDistinctJids.map(m => m.remoteJid)
        ]);

        const jidMap = await batchResolveToPhoneJid(Array.from(allJids), dbSessionId);
        const contactMap = new Map(contacts.map(c => [c.jid, c]));

        const chatList = await Promise.all(Array.from(allJids).map(async (originalJid) => {
            const resolvedJid = jidMap.get(originalJid) || originalJid;
            const normalizedJid = normalizeJid(resolvedJid);
            const contactInfo = contactMap.get(originalJid) || contactMap.get(normalizedJid) || { jid: normalizedJid, name: null, notify: null, profilePic: null };

            const lastMessage = await prisma.message.findFirst({
                where: {
                    sessionId: dbSessionId,
                    OR: [{ remoteJid: originalJid }, { remoteJid: normalizedJid }]
                },
                orderBy: { timestamp: 'desc' },
                select: { content: true, timestamp: true, type: true }
            });

            return {
                ...contactInfo,
                jid: normalizedJid,
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    timestamp: lastMessage.timestamp.toISOString(),
                    type: lastMessage.type
                } : undefined
            };
        }));

        const uniqueChats = new Map();
        chatList.forEach(chat => {
            const existing = uniqueChats.get(chat.jid);
            if (!existing || (chat.lastMessage?.timestamp && (!existing.lastMessage?.timestamp || new Date(chat.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)))) {
                uniqueChats.set(chat.jid, chat);
            }
        });

        const finalChats = Array.from(uniqueChats.values());
        finalChats.sort((a, b) => {
            const tA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
            const tB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
            return tB - tA;
        });

        return finalChats;
    }

    /**
     * Get recent messages for a specific chat.
     */
    static async getMessages(dbSessionId: string, jid: string, take: number = 100) {
        const normalizedJid = normalizeJid(jid);
        return await prisma.message.findMany({
            where: {
                sessionId: dbSessionId,
                remoteJid: normalizedJid
            },
            orderBy: { timestamp: 'asc' },
            take
        });
    }

    /**
     * Send a text message.
     */
    static async sendTextMessage(sessionId: string, jid: string, messagePayload: any, mentions?: string[]) {
        const instance = waManager.getInstance(sessionId);
        if (!instance || !instance.socket) {
            throw new Error("WhatsApp session is disconnected or not found");
        }

        let msgPayload = { ...messagePayload };

        if (msgPayload.sticker && (msgPayload.sticker.url || typeof msgPayload.sticker === 'string')) {
            const url = msgPayload.sticker.url || msgPayload.sticker;
            try {
                const res = await fetch(url);
                const buffer = await res.arrayBuffer();
                const sticker = new Sticker(Buffer.from(buffer), {
                    pack: msgPayload.sticker.pack || "BaseKey Bot",
                    author: msgPayload.sticker.author || "BaseKey",
                    type: "full",
                    quality: 50
                });
                msgPayload = { sticker: await sticker.toBuffer() };
            } catch (e: any) {
                throw new Error(`Sticker error: ${e.message}`);
            }
        }

        return await instance.socket.sendMessage(jid, msgPayload, { mentions: mentions || [] } as any);
    }

    /**
     * Send a media message (Cloudinary support integrated via buffer).
     */
    static async sendMediaMessage(
        sessionId: string, 
        jid: string, 
        buffer: Buffer, 
        type: string, 
        mimetype: string,
        fileName: string, 
        caption: string
    ) {
        const instance = waManager.getInstance(sessionId);
        if (!instance || !instance.socket) {
            throw new Error("WhatsApp session not found");
        }

        const options: any = { caption, mimetype, fileName };
        let content: any = {};

        switch (type) {
            case 'image': content = { image: buffer, ...options }; break;
            case 'video': content = { video: buffer, ...options }; break;
            case 'audio': content = { audio: buffer, mimetype: 'audio/mp4', ptt: false }; break;
            case 'voice': content = { audio: buffer, mimetype: 'audio/mp4', ptt: true }; break;
            case 'document': content = { document: buffer, ...options }; break;
            case 'sticker':
                const sticker = new Sticker(buffer, { pack: "BaseKey", author: "Ayush", quality: 50 });
                content = { sticker: await sticker.toBuffer() };
                break;
            default: content = { document: buffer, ...options };
        }

        const result = await instance.socket.sendMessage(jid, content);
        // RAM release: buffer ko null karna zaroori nahi yahan kyunki ye variable garbage collect ho jayega
        return result;
    }

    /**
     * NEW: Send Interactive (Buttons) Message
     */
    static async sendInteractiveMessage(
        sessionId: string, 
        jid: string, 
        data: { text: string, footer: string, buttons: string[] }
    ) {
        const instance = waManager.getInstance(sessionId);
        if (!instance || !instance.socket) {
            throw new Error("WhatsApp session not found");
        }

        // Baileys Button Structure
        const buttons = data.buttons.map((btnText, index) => ({
            buttonId: `btn-${index}-${Date.now()}`,
            buttonText: { displayText: btnText },
            type: 1
        }));

        const buttonMessage = {
            text: data.text,
            footer: data.footer || "Powered by BaseKey",
            buttons: buttons,
            headerType: 1
        };

        return await instance.socket.sendMessage(jid, buttonMessage);
    }
}
