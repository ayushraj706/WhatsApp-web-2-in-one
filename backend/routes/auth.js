const express = require('express');
const router = express.Router();
const { startSession, getStatus, logoutSession } = require('../whatsapp/session');

// POST /api/auth/connect  { phoneNumber?: string }
// If phoneNumber is provided -> pairing code flow. Otherwise -> QR flow.
router.post('/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    console.log(`[Tracker 1] -> /connect API hit hui. Mode: ${phoneNumber ? 'Pairing Code' : 'QR Code'}`);
    
    console.log(`[Tracker 2] -> WhatsApp engine (startSession) chalu ho raha hai...`);
    const status = await startSession(phoneNumber ? { phoneNumber } : {});
    
    // Agar engine sahi se chalu ho gaya, toh yeh line print hogi
    console.log(`[Tracker 3] -> WhatsApp engine successfully chalu ho gaya! Status:`, status);
    
    res.json({ ok: true, ...status });
  } catch (err) {
    console.error(`[Tracker Error] -> Engine start hone me Error aagaya:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/status - poll this every 2-3s from the frontend to
// render QR code / pairing code / connected state.
router.get('/status', (req, res) => {
  res.json({ ok: true, ...getStatus() });
});

router.post('/logout', async (req, res) => {
  try {
    console.log(`[Tracker] -> Logout button dabaya gaya`);
    await logoutSession();
    res.json({ ok: true });
  } catch (err) {
    console.error(`[Tracker] -> Logout me error:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
