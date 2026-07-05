const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { getSocket } = require('../whatsapp/session');
const { saveMessage } = require('../whatsapp/chatStore');
const { runBulkCampaign } = require('../whatsapp/bulkSender');

// All webhook routes require an API key (generated from Settings page)
// sent as header: x-api-key
async function requireApiKey(req, res, next) {
  try {
    const provided = req.header('x-api-key');
    if (!provided) return res.status(401).json({ ok: false, error: 'missing x-api-key header' });

    const doc = await db.collection('settings').doc('api').get();
    const stored = doc.exists ? doc.data().apiKey : null;

    if (!stored || provided !== stored) {
      return res.status(403).json({ ok: false, error: 'invalid api key' });
    }
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

router.use(requireApiKey);

// POST /api/webhook/send  { to, text }
// Lets an external system (CRM, Zapier, your own backend) trigger a
// single outgoing message through this bot.
router.post('/send', async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ ok: false, error: 'to and text are required' });

    const jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    const sock = getSocket();
    const sent = await sock.sendMessage(jid, { text });
    await saveMessage(jid, sent, 'out');

    res.json({ ok: true, messageId: sent.key.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/webhook/bulk  { numbers: string[], message: string }
// Lets an external system trigger a full bulk campaign programmatically.
router.post('/bulk', async (req, res) => {
  try {
    const { numbers, message, minDelayMs, maxDelayMs } = req.body;
    if (!Array.isArray(numbers) || !numbers.length || !message) {
      return res.status(400).json({ ok: false, error: 'numbers[] and message are required' });
    }

    const campaignId = `camp_${Date.now()}`;
    runBulkCampaign(campaignId, numbers, message, { minDelayMs, maxDelayMs }).catch((err) =>
      console.error('[webhook bulk] campaign crashed:', err)
    );

    res.json({ ok: true, campaignId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
