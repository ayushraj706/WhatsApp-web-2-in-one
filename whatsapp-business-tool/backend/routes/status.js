const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET /api/status - list contacts who have posted a status in the last 24h
router.get('/', async (req, res) => {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const snap = await db.collection('statuses').where('lastStatusAt', '>=', cutoff).get();
    const posters = snap.docs.map((d) => d.data());
    res.json({ ok: true, posters });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/status/:posterJid - story items for one contact, oldest first
router.get('/:posterJid', async (req, res) => {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const snap = await db
      .collection('statuses')
      .doc(req.params.posterJid)
      .collection('items')
      .where('timestamp', '>=', cutoff)
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();

    res.json({ ok: true, items: snap.docs.map((d) => d.data()) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
