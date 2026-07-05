const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET /api/chats?limit=25&cursor=<lastMessageAt of previous page>
// Chat list, sorted by most recent activity. Cursor-based so we never
// pull the whole `chats` collection into memory.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    let query = db.collection('chats').orderBy('lastMessageAt', 'desc').limit(limit);

    if (req.query.cursor) {
      query = query.startAfter(Number(req.query.cursor));
    }

    const snap = await query.get();
    const chats = snap.docs.map((d) => d.data());
    const nextCursor = chats.length ? chats[chats.length - 1].lastMessageAt : null;

    res.json({ ok: true, chats, nextCursor, hasMore: chats.length === limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/chats/:jid/messages?limit=30&cursor=<timestamp of oldest loaded message>
// Loads messages NEWEST-FIRST in pages of `limit`, for lazy-loading as the
// user scrolls up in the chat window (classic WhatsApp-style pagination).
router.get('/:jid/messages', async (req, res) => {
  try {
    const { jid } = req.params;
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    let query = db
      .collection('chats')
      .doc(jid)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (req.query.cursor) {
      query = query.startAfter(Number(req.query.cursor));
    }

    const snap = await query.get();
    const messages = snap.docs.map((d) => d.data()).reverse(); // chronological for rendering
    const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1].data().timestamp : null;

    res.json({ ok: true, messages, nextCursor, hasMore: snap.docs.length === limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Clear unread badge when a chat is opened - never deletes any messages.
router.post('/:jid/read', async (req, res) => {
  try {
    await db.collection('chats').doc(req.params.jid).set({ unreadCount: 0 }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
