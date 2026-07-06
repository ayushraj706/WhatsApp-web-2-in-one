const axios = require('axios');
const { saveMessage, getChatMeta, extractText, saveStatus } = require('./chatStore');
const { runAutoResponder } = require('./autoResponder');

async function fireOutgoingWebhook(payload) {
  const url = process.env.OUTGOING_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(url, payload, { timeout: 5000 });
  } catch (err) {
    console.error('[webhook] delivery failed:', err.message);
  }
}

async function handleIncomingMessage(sock, upsert) {
  if (upsert.type !== 'notify') return;

  for (const msg of upsert.messages) {
    try {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) continue; // Group messages ignore karne ke liye safe check

      if (jid === 'status@broadcast') {
        await saveStatus(msg).catch((err) => console.error('[status] save failed:', err.message));
        continue;
      }

      const direction = msg.key.fromMe ? 'out' : 'in';
      const pushName = msg.pushName || 'User';

      // 1. Meta check karo (Is First time? Has DP?)
      let chatMeta = { isFirstTime: false, hasProfilePic: false };
      if (direction === 'in') {
        try {
          chatMeta = await getChatMeta(jid);
        } catch (metaError) {
          console.error('[chatMeta] read failed:', metaError.message);
        }
      }

      // 2. DP Logic: Sirf tabhi fetch karo jab zaroorat ho
      let profilePicUrl = undefined;
      if (direction === 'in' && (chatMeta.isFirstTime || !chatMeta.hasProfilePic)) {
        try {
          // Timeout add kiya taaki Render server hang na ho
          profilePicUrl = await sock.profilePictureUrl(jid, 'image', 5000);
        } catch (dpError) {
          profilePicUrl = null; // DP nahi mili ya privacy hai
        }
      }

      // 3. Save Message
      await saveMessage(jid, msg, direction, profilePicUrl, pushName);

      // 4. Webhook & Auto-responder
      if (direction === 'in') {
        fireOutgoingWebhook({
          event: 'message.received',
          jid,
          pushName,
          profilePicUrl, 
          text: extractText(msg.message),
          timestamp: Date.now(),
        });

        await runAutoResponder(sock, jid, extractText(msg.message), chatMeta.isFirstTime, { pushName });
      }

    } catch (innerError) {
      console.error('[MessageHandler] Failed to process a specific message:', innerError.message);
    }
  }
}

module.exports = { handleIncomingMessage };
