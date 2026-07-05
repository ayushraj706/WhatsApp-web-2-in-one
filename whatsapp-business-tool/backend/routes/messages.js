const express = require('express');
const multer = require('multer');
const router = express.Router();

const { getSocket } = require('../whatsapp/session');
const { saveMessage } = require('../whatsapp/chatStore');
const { uploadToCloudinary } = require('../config/cloudinary');

// memoryStorage keeps the file as a small in-memory Buffer only for the
// duration of the request - it is never written to disk, and is released
// as soon as the request finishes (image/video uploads are user-sized,
// typically well under a few MB, so this stays within the RAM budget).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function toJid(number) {
  if (number.includes('@')) return number;
  return `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
}

// POST /api/messages/text  { to, text }
router.post('/text', async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ ok: false, error: 'to and text are required' });

    const sock = getSocket();
    const jid = toJid(to);
    const sent = await sock.sendMessage(jid, { text });
    await saveMessage(jid, sent, 'out');

    res.json({ ok: true, messageId: sent.key.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/messages/media  (multipart/form-data: file, to, caption?, type=image|video|document)
router.post('/media', upload.single('file'), async (req, res) => {
  try {
    const { to, caption, type } = req.body;
    if (!to || !req.file) return res.status(400).json({ ok: false, error: 'to and file are required' });

    const jid = toJid(to);
    const resourceType = type === 'video' ? 'video' : type === 'document' ? 'raw' : 'image';

    // Stream straight to Cloudinary from the in-memory buffer - never
    // saved to local disk at any point.
    const uploaded = await uploadToCloudinary(req.file.buffer, resourceType, 'whatsapp/media');

    const sock = getSocket();
    const payload =
      type === 'video'
        ? { video: { url: uploaded.secure_url }, caption }
        : type === 'document'
        ? { document: { url: uploaded.secure_url }, mimetype: req.file.mimetype, fileName: req.file.originalname }
        : { image: { url: uploaded.secure_url }, caption };

    const sent = await sock.sendMessage(jid, payload);
    await saveMessage(jid, sent, 'out');

    res.json({ ok: true, messageId: sent.key.id, mediaUrl: uploaded.secure_url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
