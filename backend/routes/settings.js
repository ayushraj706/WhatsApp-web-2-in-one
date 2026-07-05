const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../config/firebase');
const { invalidateSettingsCache } = require('../whatsapp/autoResponder');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('automation').get();
    res.json({
      ok: true,
      settings: doc.exists
        ? doc.data()
        : { welcomeReply: { enabled: false, text: '' }, keywordRules: [], bulkDelay: { minMs: 5000, maxMs: 15000 } },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/settings  { welcomeReply, keywordRules, bulkDelay, webhookUrl }
router.put('/', async (req, res) => {
  try {
    const { welcomeReply, keywordRules, bulkDelay, webhookUrl } = req.body;
    await db.collection('settings').doc('automation').set(
      { welcomeReply, keywordRules, bulkDelay, webhookUrl, updatedAt: Date.now() },
      { merge: true }
    );
    invalidateSettingsCache();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/settings/api-key/generate - creates a key for the /api/webhook/* routes
router.post('/api-key/generate', async (req, res) => {
  try {
    const key = crypto.randomBytes(24).toString('hex');
    await db.collection('settings').doc('api').set({ apiKey: key, createdAt: Date.now() });
    res.json({ ok: true, apiKey: key });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
