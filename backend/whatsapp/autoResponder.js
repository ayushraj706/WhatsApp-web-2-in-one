const { db } = require('../config/firebase');
const { saveMessage } = require('./chatStore');

// Settings are small (a handful of rules), so we cache them briefly
// instead of hitting Firestore on every single incoming message.
let settingsCache = null;
let settingsCacheAt = 0;
const CACHE_TTL_MS = 15000;

async function getSettings() {
  const now = Date.now();
  if (settingsCache && now - settingsCacheAt < CACHE_TTL_MS) return settingsCache;

  const doc = await db.collection('settings').doc('automation').get();
  settingsCache = doc.exists
    ? doc.data()
    : { welcomeReply: { enabled: false, text: '' }, keywordRules: [] };
  settingsCacheAt = now;
  return settingsCache;
}

async function sendAndLog(sock, jid, text) {
  const sent = await sock.sendMessage(jid, { text });
  await saveMessage(jid, sent, 'out').catch(() => {});
}

async function runAutoResponder(sock, jid, incomingText, isFirstTime) {
  const settings = await getSettings();

  if (isFirstTime && settings.welcomeReply?.enabled && settings.welcomeReply.text) {
    await sendAndLog(sock, jid, settings.welcomeReply.text);
    return; // don't also fire a keyword rule on the very first message
  }

  const text = (incomingText || '').toLowerCase().trim();
  if (!text) return;

  const rules = settings.keywordRules || [];
  for (const rule of rules) {
    if (!rule.keyword || !rule.reply) continue;
    const keyword = rule.keyword.toLowerCase().trim();
    const matched = rule.matchType === 'exact' ? text === keyword : text.includes(keyword);
    if (matched) {
      await sendAndLog(sock, jid, rule.reply);
      break;
    }
  }
}

function invalidateSettingsCache() {
  settingsCache = null;
}

module.exports = { runAutoResponder, invalidateSettingsCache };
