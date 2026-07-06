const axios = require('axios');
const { saveMessage, isFirstTimeContact, extractText, saveStatus } = require('./chatStore');
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
    // FIX 1: Loop ke andar try-catch lagaya hai! 
    // Ab agar ek message error dega, toh baaki rukenge nahi.
    try {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;

      if (jid === 'status@broadcast') {
        await saveStatus(msg).catch((err) => console.error('[status] save failed:', err.message));
        continue;
      }

      const direction = msg.key.fromMe ? 'out' : 'in';
      const firstTime = direction === 'in' ? await isFirstTimeContact(jid) : false;
      const pushName = msg.pushName || 'User';

      // FIX 2: Profile Pic fetch karna (with safety)
      let profilePicUrl = null;
      if (direction === 'in') {
        try {
          // Baileys engine se DP ka URL nikal rahe hain
          profilePicUrl = await sock.profilePictureUrl(jid, 'image');
        } catch (dpError) {
          // Agar user ne DP hide ki hai ya available nahi hai, toh crash na ho
          profilePicUrl = null;
        }
      }

      // Ab DP aur Name dono saveMessage ko bhej rahe hain taaki DB me update ho jaye
      await saveMessage(jid, msg, direction, profilePicUrl, pushName);

      if (direction === 'in') {
        fireOutgoingWebhook({
          event: 'message.received',
          jid,
          pushName,
          profilePicUrl, // Webhook me DP URL bhej diya
          text: extractText(msg.message),
          timestamp: Date.now(),
        });

        await runAutoResponder(sock, jid, extractText(msg.message), firstTime, { pushName });
      }

    } catch (innerError) {
      // Is line ki wajah se bot kabhi freeze nahi hoga
      console.error('[MessageHandler] Failed to process a specific message:', innerError.message);
    }
  }
}

module.exports = { handleIncomingMessage };
