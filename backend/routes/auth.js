const express = require('express');
const router = express.Router();
const { startSession, getStatus, logoutSession } = require('../whatsapp/session');

// POST /api/auth/connect  { phoneNumber?: string }
// If phoneNumber is provided -> pairing code flow. Otherwise -> QR flow.
router.post('/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const status = await startSession(phoneNumber ? { phoneNumber } : {});
    res.json({ ok: true, ...status });
  } catch (err) {
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
    await logoutSession();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
