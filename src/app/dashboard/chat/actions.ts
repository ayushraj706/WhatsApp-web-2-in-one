"use server";

import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { getAuthenticatedUserForAction } from "@/lib/server-action-auth";
import { canAccessSession } from "@/lib/api-auth";

// 1. Fetch chat list
export async function getChatsStatus(sessionId: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");
    
    return await ChatService.getChatsList(session.id);
}

// 2. Fetch messages for a specific chat
export async function getChatMessages(sessionId: string, jid: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");

    const messages = await ChatService.getMessages(session.id, jid, 100);

    return messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
    }));
}

// 3. Send a basic text message
export async function sendChatMessage(sessionId: string, jid: string, text: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        await ChatService.sendTextMessage(sessionId, jid, { text });
        return { success: true };
    } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

// 4. Upload and Send Media (Optimized for Render RAM)
export async function sendMediaMessage(formData: FormData) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const sessionId = formData.get("sessionId") as string;
    const jid = formData.get("jid") as string;
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const caption = formData.get("caption") as string || "";

    if (!sessionId || !jid || !file || !type) {
        throw new Error("Missing required fields");
    }

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        // FIX: RAM bachane ke liye buffer ko dhyan se handle kar rahe hain
        const arrayBuffer = await file.arrayBuffer();
        let buffer: Buffer | null = Buffer.from(arrayBuffer);
        
        await ChatService.sendMediaMessage(
            sessionId,
            jid,
            buffer,
            type,
            file.type,
            file.name,
            caption
        );

        // Memory Release: Buffer ko turant null kar do taaki Render crash na ho
        buffer = null;

        return { success: true };
    } catch (error: any) {
        console.error("Media send error:", error);
        throw new Error(`Failed to send media: ${error.message}`);
    }
}

/**
 * 5. Naya Function: Send Interactive (Buttons) Message
 * Isse frontend ka Zap button connect hoga
 */
export async function sendInteractiveMessage(
    sessionId: string, 
    jid: string, 
    data: { text: string, footer: string, buttons: string[] }
) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        // ChatService mein call karne se pehle data check kar lo
        if (!data.text || data.buttons.length === 0) {
            throw new Error("Message text and at least one button are required");
        }

        await ChatService.sendInteractiveMessage(sessionId, jid, data);
        return { success: true };
    } catch (error: any) {
        console.error("Interactive send error:", error);
        throw new Error(`Failed to send buttons: ${error.message}`);
    }
}
