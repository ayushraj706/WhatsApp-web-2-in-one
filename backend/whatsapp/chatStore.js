const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { db, admin } = require('../config/firebase');
const { uploadToCloudinary } = require('../config/cloudinary');

const MEDIA_TYPE_MAP = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'video', // Cloudinary handles audio files under the video resource type
  documentMessage: 'raw',
  stickerMessage: 'image',
};

function extractText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

function getMediaType(message) {
  return Object.keys(MEDIA_TYPE_MAP).find((k) => message?.[k]) || null;
}

/**
 * Persists ONE message as its own Firestore document. Chats are never
 * deleted or overwritten wholesale - this keeps memory flat regardless
 * of how large history grows, and satisfies the "never delete" requirement.
 */
async function saveMessage(jid, msg, direction, profilePicUrl = undefined, pushName = null) {
  const chatRef = db.collection('chats').doc(jid);
  const msgId = msg.key.id;
  const messageType = getMediaType(msg.message);
  const text = extractText(msg.message);

  let mediaUrl = null;
  if (messageType) {
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const resourceType = MEDIA_TYPE_MAP[messageType];
      const uploaded = await uploadToCloudinary(buffer, resourceType, 'whatsapp/media');
      mediaUrl = uploaded.secure_url;
    } catch (err) {
      console.error('[media upload] failed:', err.message);
    }
  }

  // Individual message history
  await chatRef.collection('messages').doc(msgId).set({
    id: msgId,
    direction,
    text,
    mediaType: messageType,
    mediaUrl,
    timestamp: Number(msg.messageTimestamp) * 1000 || Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Parent chat document update (for the sidebar list)
  const updateData = {
    jid,
    lastMessage: text || (messageType ? `[${messageType.replace('Message', '')}]` : ''),
    lastMessageAt: Number(msg.messageTimestamp) * 1000 || Date.now(),
    unreadCount:
      direction === 'in'
        ? admin.firestore.FieldValue.increment(1)
        : admin.firestore.FieldValue.increment(0),
  };

  // Naya Data: Agar messageHandler se pushName aaya hai, toh use update karo
  if (pushName && pushName !== 'User') {
    updateData.pushName = pushName;
  }

  // Naya Data: Agar DP available hai ya explicitly null pass ki gayi hai
  if (profilePicUrl !== undefined) {
    updateData.profilePicUrl = profilePicUrl;
  }

  // Firebase me save/merge kar do
  await chatRef.set(updateData, { merge: true });
}

async function isFirstTimeContact(jid) {
  const chatDoc = await db.collection('chats').doc(jid).get();
  return !chatDoc.exists;
}

/**
 * Saves a status/story update (from status@broadcast) under
 * statuses/{posterJid}/items/{messageId}, with a 24h expiresAt.
 */
async function saveStatus(msg) {
  const posterJid = msg.key.participant || msg.key.remoteJid;
  const messageType = getMediaType(msg.message);
  const text = extractText(msg.message);

  let mediaUrl = null;
  if (messageType) {
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const resourceType = MEDIA_TYPE_MAP[messageType];
      const uploaded = await uploadToCloudinary(buffer, resourceType, 'whatsapp/status');
      mediaUrl = uploaded.secure_url;
    } catch (err) {
      console.error('[status media upload] failed:', err.message);
      return;
    }
  }

  const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

  await db
    .collection('statuses')
    .doc(posterJid)
    .collection('items')
    .doc(msg.key.id)
    .set({
      id: msg.key.id,
      posterJid,
      text,
      mediaType: messageType,
      mediaUrl,
      timestamp,
      expiresAt: timestamp + 24 * 60 * 60 * 1000,
    });

  await db.collection('statuses').doc(posterJid).set({ posterJid, lastStatusAt: timestamp }, { merge: true });
}

module.exports = { saveMessage, isFirstTimeContact, extractText, getMediaType, saveStatus };
