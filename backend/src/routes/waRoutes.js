const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { startWhatsAppSession, getSession } = require("../sockets/whatsappSocket");
const Message = require("../models/Message");
const router = express.Router();

// Start / link a WhatsApp session (frontend shows returned QR via socket "wa:qr")
router.post("/connect", requireAuth, async (req, res) => {
  const io = req.app.get("io");
  await startWhatsAppSession(req.user.id, io);
  res.json({ status: "connecting" });
});

// Fetch chat history (includes anti-delete flagged messages)
router.get("/messages/:chatId", requireAuth, async (req, res) => {
  const messages = await Message.findAll({
    where: { userId: req.user.id, chatId: req.params.chatId },
    order: [["timestamp", "ASC"]],
    limit: 200,
  });
  res.json(messages);
});

// Send a message
router.post("/send", requireAuth, async (req, res) => {
  const { chatId, text } = req.body;
  const sock = getSession(req.user.id);
  if (!sock) return res.status(400).json({ error: "WhatsApp not connected" });

  const sent = await sock.sendMessage(chatId, { text });
  res.json({ success: true, id: sent.key.id });
});

module.exports = router;
