const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../config/firebase');
const { invalidateSettingsCache } = require('../whatsapp/autoResponder');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('automation').get();
    
    // Default structure fallback taaki frontend crash na ho
    const defaultSettings = { 
      welcomeReply: { enabled: false, text: '' }, 
      keywordRules: [], 
      bulkDelay: { minMs: 5000, maxMs: 15000 },
      webhookUrl: ''
    };
    
    res.json({
      ok: true,
      settings: doc.exists ? { ...defaultSettings, ...doc.data() } : defaultSettings,
    });
  } catch (err) {
    console.error('[Settings GET Error]:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/settings  
router.put('/', async (req, res) => {
  try {
    // FIX: Sirf wahi data update hoga jo frontend se aaya hai (Partial Update)
    // Isse existing settings Firebase me delete/overwrite nahi hongi
    const updatePayload = { updatedAt: Date.now() };
    
    if (req.body.welcomeReply) updatePayload.welcomeReply = req.body.welcomeReply;
    if (req.body.keywordRules) updatePayload.keywordRules = req.body.keywordRules;
    if (req.body.bulkDelay) updatePayload.bulkDelay = req.body.bulkDelay;
    if (req.body.webhookUrl !== undefined) updatePayload.webhookUrl = req.body.webhookUrl;

    await db.collection('settings').doc('automation').set(updatePayload, { merge: true });
    
    // Cache clear karna zaroori hai taaki Baileys naye rules turant pick kare
    invalidateSettingsCache();
    
    res.json({ ok: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('[Settings PUT Error]:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// NAYA ROUTE: Dashboard par existing API key dikhane ke liye
// GET /api/settings/api-key 
router.get('/api-key', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('api').get();
    res.json({ ok: true, apiKey: doc.exists ? doc.data().apiKey : null });
  } catch (err) {
    console.error('[API Key GET Error]:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/settings/api-key/generate - Creates a new key
router.post('/api-key/generate', async (req, res) => {
  try {
    // 24 bytes ka strong hexadecimal API key generate kar rahe hain
    const key = crypto.randomBytes(24).toString('hex');
    await db.collection('settings').doc('api').set({ apiKey: key, createdAt: Date.now() });
    res.json({ ok: true, apiKey: key });
  } catch (err) {
    console.error('[API Key Generate Error]:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
