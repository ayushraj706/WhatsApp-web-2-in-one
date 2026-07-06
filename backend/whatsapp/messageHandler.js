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
      const pushName = msg.pushName || 'User';

      // Ek hi Firestore read se pata chal jata hai: naya contact hai ya
      // nahi, aur DP pehle se saved hai ya nahi. Isi read se firstTime
      // nikaal rahe hain (pehle isFirstTimeContact() ka alag call lagta tha).
      let chatMeta = { isFirstTime: false, hasProfilePic: true };
      if (direction === 'in') {
        try {
          chatMeta = await getChatMeta(jid);
        } catch (metaError) {
          console.error('[chatMeta] read failed:', metaError.message);
        }
      }
      const firstTime = chatMeta.isFirstTime;

      // FIX 2: Profile Pic sirf tab fetch karo jab zaroorat ho —
      // naya contact ho, ya humare paas abhi tak uski DP save nahi hai.
      // Render free-tier par har message par DP fetch karna rate limit
      // aur high CPU dono cause kar raha tha, isliye ab ye sirf kabhi
      // kabhi (per-contact, not per-message) chalega.
      let profilePicUrl;
      if (direction === 'in' && (firstTime || !chatMeta.hasProfilePic)) {
        try {
          // Baileys engine se DP ka URL nikal rahe hain
          profilePicUrl = await sock.profilePictureUrl(jid, 'image');
        } catch (dpError) {
          // Agar user ne DP hide ki hai ya available nahi hai, toh crash na ho
          profilePicUrl = null;
        }
      }

      // Ab DP (agar fetch hui) aur Name dono saveMessage ko bhej rahe hain.
      // profilePicUrl 'undefined' rehta hai jab hum fetch hi nahi karte —
      // saveMessage isi wajah se sirf tabhi update karta hai jab value
      // explicitly di gayi ho, warna existing DP overwrite nahi hogi.
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
