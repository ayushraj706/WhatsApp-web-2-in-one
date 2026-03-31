import { prisma } from "./prisma";
import crypto from "crypto";
import { normalizeMessageContent, downloadMediaMessage, WAMessage } from "@whiskeysockets/baileys";
import { v2 as cloudinary } from "cloudinary"; // Cloudinary import
import pino from "pino";
import { resolveToPhoneJidBySessionId as resolveToPhoneJid, isLidJid } from "./jid-utils";

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type WebhookEventType =
    | "message.received"
    | "message.sent"
    | "message.status"
    | "connection.update"
    | "group.update"
    | "contact.update"
    | "status.update";

interface WebhookPayload {
    event: WebhookEventType;
    sessionId: string;
    timestamp: string;
    data: any;
}

export async function dispatchWebhook(
    sessionId: string,
    event: WebhookEventType,
    data: any
) {
    try {
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true, userId: true }
        });

        if (!session) return;

        const webhooks = await prisma.webhook.findMany({
            where: {
                userId: session.userId,
                isActive: true,
                OR: [
                    { sessionId: null },
                    { sessionId: session.id }
                ]
            }
        });

        if (webhooks.length === 0) return;

        const payload: WebhookPayload = {
            event,
            sessionId,
            timestamp: new Date().toISOString(),
            data: normalizePayloadData(event, data)
        };

        for (const webhook of webhooks) {
            const events = (webhook.events as string[]) || [];
            if (!events.includes(event) && !events.includes("*")) continue;

            sendWebhookRequest(webhook.url, payload, webhook.secret).catch(err => {
                console.error(`Webhook ${webhook.id} failed:`, err);
            });
        }
    } catch (error) {
        console.error("Webhook dispatch error:", error);
    }
}

function normalizePayloadData(event: WebhookEventType, data: any): any {
    return data;
}

function jsonReplacer(key: string, value: any) {
    if (typeof value === 'bigint') return value.toString();
    return value;
}

async function sendWebhookRequest(url: string, payload: WebhookPayload, secret?: string | null) {
    const body = JSON.stringify(payload, jsonReplacer);
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "WA-AKG-Webhook/1.0"
    };

    if (secret) {
        const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return response;
}

/**
 * NEW: Download and Upload to Cloudinary
 * Isse Render ka 512MB RAM crash nahi hoga.
 */
export async function downloadAndSaveMedia(message: WAMessage, sessionId: string): Promise<string | null> {
    try {
        const messageContent = normalizeMessageContent(message.message);
        if (!messageContent) return null;

        const messageType = Object.keys(messageContent)[0];
        const allowedTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

        if (!allowedTypes.includes(messageType)) return null;

        console.log(`MediaDownload: Cloudinary starting for ${messageType}...`);

        const buffer = await downloadMediaMessage(message, "buffer", {}) as Buffer;
        if (!buffer) return null;

        // Cloudinary Upload Logic (Using Promises)
        const uploadResponse = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `basekey/${sessionId}`,
                    public_id: message.key.id,
                    resource_type: "auto", // Image/Video/Doc apne aap detect karega
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        const fileUrl = (uploadResponse as any).secure_url;
        console.log(`MediaDownload: Cloudinary Success. URL: ${fileUrl}`);
        return fileUrl;

    } catch (e) {
        console.error("Cloudinary Upload Failed:", e);
        return null;
    }
}

export async function onMessageReceived(sessionId: string, message: any, existingFileUrl?: string | null) {
    const remoteJid = message.key?.remoteJid || "";
    const fromMe = message.key?.fromMe || false;
    const isGroup = remoteJid.endsWith("@g.us");
    const participant = isGroup ? (message.key?.participant || message.participant) : undefined;
    const remoteJidAlt = message.key?.remoteJidAlt || null;

    const normalizedFrom = await resolveToPhoneJid(remoteJid, sessionId, remoteJidAlt);
    let senderJid: string = isGroup ? (participant || "") : remoteJid;
    const normalizedSender = await resolveToPhoneJid(senderJid, sessionId);
    let sender: any = normalizedSender;
    let participantDetail: any = await resolveToPhoneJid(participant || "", sessionId);

    let fileUrl: string | null = existingFileUrl || null;
    if (!fileUrl) {
        fileUrl = await downloadAndSaveMedia(message, sessionId);
    }

    const normalized = extractMessageContent(message);
    const quoted = await extractQuotedMessageAsync(message, sessionId);

    dispatchWebhook(sessionId, "message.received", {
        key: {
            id: message.key?.id,
            remoteJid: normalizedFrom,
            fromMe,
            participant: participantDetail
        },
        pushName: message.pushName,
        messageTimestamp: message.messageTimestamp,
        from: normalizedFrom,
        sender,
        isGroup,
        chatType: getChatType(remoteJid),
        type: normalized.type,
        content: normalized.content,
        fileUrl,
        caption: normalized.caption,
        quoted,
        raw: message
    });
}

export async function onMessageSent(sessionId: string, message: any, existingFileUrl?: string | null) {
    const normalized = extractMessageContent(message);
    const quoted = await extractQuotedMessageAsync(message, sessionId);
    const remoteJid = message.key?.remoteJid || "";
    const isGroup = remoteJid.endsWith("@g.us");
    const remoteJidAlt = message.key?.remoteJidAlt || null;

    let fileUrl: string | null = existingFileUrl || null;
    if (!fileUrl) {
        fileUrl = await downloadAndSaveMedia(message, sessionId);
    }

    const normalizedFrom = await resolveToPhoneJid(remoteJid, sessionId, remoteJidAlt);
    const rawSender = message.key?.participant || (message.key?.fromMe ? "ME" : remoteJid);
    const sender = rawSender === "ME" ? "ME" : await resolveToPhoneJid(rawSender, sessionId);

    dispatchWebhook(sessionId, "message.sent", {
        key: {
            id: message.key?.id,
            remoteJid: normalizedFrom,
            fromMe: true,
            participant: isGroup ? sender : undefined
        },
        from: normalizedFrom,
        sender,
        isGroup,
        chatType: getChatType(remoteJid),
        type: normalized.type,
        content: normalized.content,
        fileUrl,
        caption: normalized.caption,
        quoted,
        timestamp: Date.now(),
        raw: message
    });
}

function getChatType(jid: string): "PERSONAL" | "GROUP" | "STATUS" | "NEWSLETTER" | "UNKNOWN" {
    if (!jid) return "UNKNOWN";
    if (jid.endsWith("@g.us")) return "GROUP";
    if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid")) return "PERSONAL";
    if (jid === "status@broadcast") return "STATUS";
    if (jid.endsWith("@newsletter")) return "NEWSLETTER";
    return "UNKNOWN";
}

export function onConnectionUpdate(sessionId: string, status: string, qr?: string) {
    dispatchWebhook(sessionId, "connection.update", { status, qr: qr || null });
}

function extractMessageContent(msg: any): { type: string, content: string, caption?: string } {
    const messageContent = normalizeMessageContent(msg.message);
    if (!messageContent) return { type: "UNKNOWN", content: "" };

    let text = "";
    let caption = undefined;
    let messageType = "TEXT";

    const m = messageContent;
    if (m.conversation) text = m.conversation;
    else if (m.extendedTextMessage?.text) text = m.extendedTextMessage.text;
    else if (m.imageMessage) { messageType = "IMAGE"; caption = m.imageMessage.caption || ""; text = caption; }
    else if (m.videoMessage) { messageType = "VIDEO"; caption = m.videoMessage.caption || ""; text = caption; }
    else if (m.audioMessage) messageType = "AUDIO";
    else if (m.documentMessage) { messageType = "DOCUMENT"; text = m.documentMessage.fileName || ""; caption = m.documentMessage.caption || ""; }
    else if (m.stickerMessage) messageType = "STICKER";
    else if (m.locationMessage) { messageType = "LOCATION"; text = `${m.locationMessage.degreesLatitude},${m.locationMessage.degreesLongitude}`; }
    else if (m.contactMessage) { messageType = "CONTACT"; text = m.contactMessage.displayName || ""; }

    return { type: messageType, content: text, caption };
}

async function extractQuotedMessageAsync(msg: any, sessionId: string): Promise<any> {
    const messageContent = normalizeMessageContent(msg.message);
    if (!messageContent) return null;

    let contextInfo: any = null;
    const types = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage', 'contactMessage', 'locationMessage'];
    
    for (const t of types) {
        if ((messageContent as any)[t]?.contextInfo) {
            contextInfo = (messageContent as any)[t].contextInfo;
            break;
        }
    }

    if (contextInfo && contextInfo.quotedMessage) {
        const normalized = extractMessageContent({ message: contextInfo.quotedMessage });
        let fileUrl = null;

        if (contextInfo.stanzaId) {
            try {
                const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
                if (session) {
                    const savedMsg = await prisma.message.findUnique({
                        where: { sessionId_keyId: { sessionId: session.id, keyId: contextInfo.stanzaId } },
                        select: { mediaUrl: true }
                    });
                    if (savedMsg?.mediaUrl) fileUrl = savedMsg.mediaUrl;
                }
            } catch (e) {}
        }

        return {
            key: {
                remoteJid: contextInfo.remoteJid || null,
                participant: contextInfo.participant || null,
                fromMe: contextInfo.participant === undefined,
                id: contextInfo.stanzaId || null
            },
            type: normalized.type,
            content: normalized.content,
            caption: normalized.caption,
            fileUrl
        };
    }
    return null;
}
