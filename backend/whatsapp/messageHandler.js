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
    if (!msg.message) continue;
    const jid = msg.key.remoteJid;
    if (!jid) continue;

    if (jid === 'status@broadcast') {
      await saveStatus(msg).catch((err) => console.error('[status] save failed:', err.message));
      continue;
    }

    const direction = msg.key.fromMe ? 'out' : 'in';
    const firstTime = direction === 'in' ? await isFirstTimeContact(jid) : false;
    
    // YAHAN CHANGE HAI: WhatsApp se User ka naam (pushName) nikal rahe hain
    const pushName = msg.pushName || 'User';

    await saveMessage(jid, msg, direction);

    if (direction === 'in') {
      // Webhook me bhi pushName pass kar diya taaki API powerful bane
      fireOutgoingWebhook({
        event: 'message.received',
        jid,
        pushName, // Naya field add kiya
        text: extractText(msg.message),
        timestamp: Date.now(),
      });

      // YAHAN BADA CHANGE HAI: Auto-responder ko userData (pushName) bhej rahe hain 
      // taaki wo %name%, %time% waigarah set kar sake
      await runAutoResponder(sock, jid, extractText(msg.message), firstTime, { pushName });
    }
  }
}

module.exports = { handleIncomingMessage };
