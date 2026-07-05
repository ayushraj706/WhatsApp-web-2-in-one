const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { getSocket } = require('../whatsapp/session'); // Socket import kiya

// GET /api/chats?limit=25&cursor=<lastMessageAt of previous page>
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    let query = db.collection('chats').orderBy('lastMessageAt', 'desc').limit(limit);

    if (req.query.cursor) {
      query = query.startAfter(Number(req.query.cursor));
    }

    const snap = await query.get();
    const chatsRaw = snap.docs.map((d) => d.data());

    // --- DP FETCHING LOGIC ---
    let sock = null;
    try {
      sock = getSocket(); // Check karo kya WhatsApp connected hai?
    } catch (e) {
      console.log("Socket not ready, skipping DP fetch...");
    }

    const chats = await Promise.all(chatsRaw.map(async (chat) => {
      let profilePic = null;
      if (sock) {
        try {
          // WhatsApp se DP fetch karo
          profilePic = await sock.profilePictureUrl(chat.jid, 'image');
        } catch (e) {
          // DP nahi mili toh ignore karo
        }
      }
      return { ...chat, profilePic };
    }));
    // --- END DP FETCHING ---

    const nextCursor = chats.length ? chats[chats.length - 1].lastMessageAt : null;

    res.json({ ok: true, chats, nextCursor, hasMore: chats.length === limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/chats/:jid/messages?limit=30&cursor=<timestamp of oldest loaded message>
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
    const messages = snap.docs.map((d) => d.data()).reverse();
    const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1].data().timestamp : null;

    res.json({ ok: true, messages, nextCursor, hasMore: snap.docs.length === limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Clear unread badge when a chat is opened
router.post('/:jid/read', async (req, res) => {
  try {
    await db.collection('chats').doc(req.params.jid).set({ unreadCount: 0 }, { merge: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
