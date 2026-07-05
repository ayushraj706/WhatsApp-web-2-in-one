const { db, admin } = require('../config/firebase');
const { saveMessage } = require('./chatStore');
const { getSocket } = require('./session');

function randomDelay(minMs, maxMs) {
  return new Promise((resolve) => {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(resolve, delay);
  });
}

function toJid(number) {
  const digits = number.replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

/**
 * Runs a bulk campaign in the background (fire-and-forget from the route
 * handler). Numbers are processed ONE AT A TIME with a random delay
 * between each send - this is the core anti-ban safeguard requested.
 * Progress is written to Firestore incrementally so the UI can poll it
 * without us ever holding the full recipient list + results in RAM
 * longer than a single pass requires.
 */
async function runBulkCampaign(campaignId, numbers, messageText, options = {}) {
  const minMs = options.minDelayMs ?? Number(process.env.BULK_MIN_DELAY_MS) ?? 5000;
  const maxMs = options.maxDelayMs ?? Number(process.env.BULK_MAX_DELAY_MS) ?? 15000;
  const campaignRef = db.collection('bulk_campaigns').doc(campaignId);

  await campaignRef.set({
    id: campaignId,
    total: numbers.length,
    sent: 0,
    failed: 0,
    status: 'running',
    startedAt: Date.now(),
  });

  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i];
    const jid = toJid(number);

    try {
      const sock = getSocket();
      const sent = await sock.sendMessage(jid, { text: messageText });
      await saveMessage(jid, sent, 'out');
      await campaignRef.update({ sent: admin.firestore.FieldValue.increment(1) });
    } catch (err) {
      console.error(`[bulk] failed to send to ${number}:`, err.message);
      await campaignRef.collection('failures').doc(number).set({ error: err.message });
      await campaignRef.update({ failed: admin.firestore.FieldValue.increment(1) });
    }

    // Human-like randomized gap - skip the wait after the very last message
    if (i < numbers.length - 1) {
      await randomDelay(minMs, maxMs);
    }
  }

  await campaignRef.update({ status: 'completed', completedAt: Date.now() });
}

module.exports = { runBulkCampaign };
