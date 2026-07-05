const { db } = require('../config/firebase');
const { saveMessage } = require('./chatStore');

// Settings are small (a handful of rules), so we cache them briefly
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

/**
 * BaseKey Master Template Parser (The Jadugar 🪄)
 * Saare %variables% ko real data me badal dega.
 */
function parseBaseKeyTemplate(templateText, userData = {}) {
  if (!templateText) return '';
  let text = templateText;

  // System Variables
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  text = text.replace(/%date%/g, dateStr);

  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  text = text.replace(/%time%/g, timeStr);

  const currentHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  let greeting = 'Hello';
  if (currentHour < 12) greeting = 'Good Morning';
  else if (currentHour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';
  text = text.replace(/%greeting%/g, greeting);

  // User Variables
  const name = userData.pushName || userData.name || 'User';
  text = text.replace(/%name%/g, name);

  const phone = userData.phone || '';
  text = text.replace(/%phone%/g, phone);

  // Custom regex pattern for any other %variable%
  text = text.replace(/%([a-zA-Z0-9_]+)%/g, (match, variableName) => {
      if (userData[variableName] !== undefined) return userData[variableName];
      return match; 
  });

  return text;
}

/**
 * Smart Delivery Boy 🚚 
 * Jo text, photos, aur documents sab kuch handle karke bhejega aur database me save karega.
 */
async function sendBaseKeyMessageAndLog(sock, jid, templateText, userData = {}) {
  const finalCaption = parseBaseKeyTemplate(templateText, userData);
  let sentMsg;

  try {
    if (userData.media_url) {
      if (userData.media_type === 'image') {
        sentMsg = await sock.sendMessage(jid, { image: { url: userData.media_url }, caption: finalCaption });
      } else if (userData.media_type === 'document') {
        sentMsg = await sock.sendMessage(jid, { 
          document: { url: userData.media_url }, 
          mimetype: 'application/pdf', 
          fileName: userData.file_name || 'Document.pdf', 
          caption: finalCaption 
        });
      } else {
        sentMsg = await sock.sendMessage(jid, { text: finalCaption });
      }
    } else {
      sentMsg = await sock.sendMessage(jid, { text: finalCaption });
    }

    if (sentMsg) {
      await saveMessage(jid, sentMsg, 'out').catch(() => {});
    }
  } catch (error) {
    console.error('[AutoResponder Error] -> Message bhejne mein dikkat aayi:', error.message);
  }
}

/**
 * Main Auto Responder Logic (Yahan userData 5th parameter ban gaya hai)
 */
async function runAutoResponder(sock, jid, incomingText, isFirstTime, userData = {}) {
  const settings = await getSettings();

  // Welcome Message Logic
  if (isFirstTime && settings.welcomeReply?.enabled && settings.welcomeReply.text) {
    await sendBaseKeyMessageAndLog(sock, jid, settings.welcomeReply.text, userData);
    return; // Don't fire a keyword rule on the very first message
  }

  const text = (incomingText || '').toLowerCase().trim();
  if (!text) return;

  // Keyword Matching Logic
  const rules = settings.keywordRules || [];
  for (const rule of rules) {
    if (!rule.keyword || !rule.reply) continue;
    const keyword = rule.keyword.toLowerCase().trim();
    const matched = rule.matchType === 'exact' ? text === keyword : text.includes(keyword);
    
    if (matched) {
      // Agar future me dashboard se kisi rule me media lagaya, toh wo data yahan mix ho jayega
      const ruleData = { 
        ...userData, 
        media_url: rule.media_url, 
        media_type: rule.media_type, 
        file_name: rule.file_name 
      };
      
      await sendBaseKeyMessageAndLog(sock, jid, rule.reply, ruleData);
      break;
    }
  }
}

function invalidateSettingsCache() {
  settingsCache = null;
}

module.exports = { runAutoResponder, invalidateSettingsCache };
