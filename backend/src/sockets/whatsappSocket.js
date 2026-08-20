/**
 * whatsappSocket.js
 * -------------------------------------------------------------
 * Connects to WhatsApp Web protocol via Baileys, persists every
 * message the instant it arrives (Shadow Backup), and intercepts
 * "delete for everyone" (revoke) events for the Anti-Delete feature.
 *
 * NOTE: This uses the unofficial Baileys library. It replicates the
 * WhatsApp Web multi-device protocol and is against WhatsApp's ToS
 * for automated/SaaS use. Swap this file for the official WhatsApp
 * Business Cloud API for a fully compliant production deployment.
 * -------------------------------------------------------------
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const path = require("path");
const Message = require("../models/Message");
const logger = require("../utils/logger");

const sessions = new Map(); // userId -> Baileys socket instance

async function startWhatsAppSession(userId, io) {
  const sessionPath = path.join(__dirname, "..", "..", "wa_sessions", userId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["WhatsApp SaaS Clone", "Chrome", "1.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  // --- QR code for linking device (sent to frontend over the room, never logged) ---
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) io.to(`user:${userId}`).emit("wa:qr", { qr });

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      io.to(`user:${userId}`).emit("wa:status", { connected: false });
      if (shouldReconnect) startWhatsAppSession(userId, io);
    } else if (connection === "open") {
      io.to(`user:${userId}`).emit("wa:status", { connected: true });
    }
  });

  // ============================================================
  // 1) SHADOW BACKUP — persist every incoming/outgoing message
  //    the instant it's received, before any delete can touch it.
  // ============================================================
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      if (!msg.message) continue; // protocol/system messages, skip

      const chatId = msg.key.remoteJid;
      const waMessageId = msg.key.id;
      const sender = msg.key.participant || msg.key.remoteJid;
      const isMedia = !!(
        msg.message.imageMessage ||
        msg.message.videoMessage ||
        msg.message.audioMessage ||
        msg.message.documentMessage
      );

      let content = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      let mediaUrl = null;
      if (isMedia) {
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {});
          mediaUrl = await saveMediaBuffer(buffer, waMessageId); // implement: upload to S3/local disk
        } catch (e) {
          logger.warn(`Media download failed for ${waMessageId}: ${e.message}`);
        }
      }

      try {
        const saved = await Message.create({
          waMessageId,
          chatId,
          userId,
          sender,
          type: isMedia ? detectMediaType(msg.message) : "text",
          content,
          mediaUrl,
          timestamp: new Date(Number(msg.messageTimestamp) * 1000),
          status: "delivered",
        });

        // push to connected clients in real time
        io.to(`user:${userId}`).emit("message:new", saved);
      } catch (err) {
        // ignore duplicate waMessageId (unique constraint) — already backed up
        if (!err.message.includes("unique")) logger.error(err);
      }
    }
  });

  // ============================================================
  // 2) ANTI-DELETE — intercept the "revoke" (delete for everyone)
  //    protocol message. Instead of removing the message, we flag
  //    it and keep it visible in the UI with a 🚫 marker.
  // ============================================================
  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      const isRevoke = update?.message === null || update?.messageStubType === 68; // REVOKE stub

      if (isRevoke) {
        const [row] = await Message.update(
          { isDeletedBySender: true, deletedAt: new Date() },
          { where: { waMessageId: key.id }, returning: true }
        );

        if (row) {
          // Notify frontend: DO NOT remove the bubble — just mark it deleted.
          io.to(`user:${userId}`).emit("message:revoked", {
            waMessageId: key.id,
            chatId: key.remoteJid,
            isDeletedBySender: true,
            deletedAt: new Date(),
          });
          logger.info(`Anti-Delete triggered for message ${key.id}`);
        }
      }
    }
  });

  sessions.set(userId, sock);
  return sock;
}

function detectMediaType(message) {
  if (message.imageMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage) return "audio";
  if (message.documentMessage) return "document";
  return "text";
}

async function saveMediaBuffer(buffer, id) {
  // Plug in your storage of choice (S3, Cloudinary, local disk, etc.)
  // return the public/signed URL used to render it in the UI.
  const fs = require("fs");
  const dir = path.join(__dirname, "..", "..", "media");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.bin`);
  fs.writeFileSync(filePath, buffer);
  return `/media/${id}.bin`;
}

function getSession(userId) {
  return sessions.get(userId);
}

module.exports = { startWhatsAppSession, getSession };
