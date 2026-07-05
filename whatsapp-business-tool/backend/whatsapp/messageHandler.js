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

    await saveMessage(jid, msg, direction);

    if (direction === 'in') {
      fireOutgoingWebhook({
        event: 'message.received',
        jid,
        text: extractText(msg.message),
        timestamp: Date.now(),
      });

      await runAutoResponder(sock, jid, extractText(msg.message), firstTime);
    }
  }
}

module.exports = { handleIncomingMessage };
