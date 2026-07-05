const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const NodeCache = require('node-cache');

const { useFirestoreAuthState } = require('./firestoreAuthState');
const { handleIncomingMessage } = require('./messageHandler');

const DEFAULT_SESSION_ID = 'superkey-session-v2';

const state = {
  sock: null,
  status: 'disconnected', 
  qrDataUrl: null,
  pairingCode: null,
  lastError: null,
};

const msgRetryCache = new NodeCache(); 

function getStatus() {
  return {
    status: state.status,
    qrDataUrl: state.status === 'qr_ready' ? state.qrDataUrl : null,
    pairingCode: state.status === 'pairing_code' ? state.pairingCode : null,
    lastError: state.lastError,
  };
}

async function startSession(opts = {}) {
  if (state.sock && state.status === 'connected') {
    return getStatus();
  }

  // TRACKER 1: Firebase check
  console.log(`[Session Tracker 1] -> Firebase Auth State database se laane ja raha hai...`);
  let authState, saveCreds;
  try {
    const firestoreResult = await useFirestoreAuthState(DEFAULT_SESSION_ID);
    authState = firestoreResult.state;
    saveCreds = firestoreResult.saveCreds;
    console.log(`[Session Tracker 2] -> Firebase Auth State mil gaya! Database connection SUCCESS.`);
  } catch (err) {
    console.error(`[Firebase Error] -> Firebase connection me gadbad hai! Apni FIREBASE_PRIVATE_KEY check karo. Error:`, err);
    throw new Error('Firebase Auth init failed: ' + err.message);
  }

  // TRACKER 3: Baileys Engine check
  console.log(`[Session Tracker 3] -> WhatsApp (Baileys) engine ka latest version check kar raha hai...`);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[Session Tracker 4] -> Baileys version mil gaya: v${version.join('.')}`);

  const logger = pino({ level: 'error' }); // Logs saaf rakhne ke liye

  console.log(`[Session Tracker 5] -> WhatsApp Socket (Engine) ban raha hai...`);
  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true, // MASTERSTROKE: Ab QR code render ke terminal me bhi dikhega!
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger),
    },
    msgRetryCounterCache: msgRetryCache,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  console.log(`[Session Tracker 6] -> Socket engine ban gaya! Events setup ho rahe hain.`);

  state.sock = sock;
  state.status = 'connecting';
  state.lastError = null;

  // Pairing Code Logic (With fix)
  if (opts.phoneNumber && !authState.creds.registered) {
    console.log(`[Session Tracker] -> Pairing code request kar raha hai for ${opts.phoneNumber}...`);
    // Thoda delay diya hai taaki socket pehle properly connect ho jaye
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(opts.phoneNumber.replace(/[^0-9]/g, ''));
        state.pairingCode = code;
        state.status = 'pairing_code';
        console.log(`[Session Tracker] -> SUCCESS! Pairing code mil gaya:`, code);
      } catch (err) {
        console.error(`[Session Tracker Error] -> Pairing code laane me fail:`, err.message);
        state.lastError = err.message;
      }
    }, 2500); 
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr || connection || lastDisconnect) {
      console.log(`[Connection Update] -> Status: ${connection || 'N/A'}, QR Aaya?: ${!!qr}`);
    }

    if (qr && !opts.phoneNumber) {
      console.log(`[Session Tracker] -> QR Code mil gaya! Vercel ko bhej raha hoon.`);
      state.qrDataUrl = await QRCode.toDataURL(qr);
      state.status = 'qr_ready';
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qrDataUrl = null;
      state.pairingCode = null;
      console.log('✅ [whatsapp] Successfully connected as', sock.user?.id);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      state.status = 'disconnected';

      if (!loggedOut) {
        console.log('⚠️ [whatsapp] connection closed, reconnecting...', statusCode);
        setTimeout(() => startSession(opts).catch(console.error), 3000);
      } else {
        console.log('❌ [whatsapp] logged out - user must relink device');
        state.sock = null;
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleIncomingMessage(sock, m);
    } catch (err) {
      console.error('[messageHandler] error:', err);
    }
  });

  return getStatus();
}

function getSocket() {
  if (!state.sock || state.status !== 'connected') {
    throw new Error('WhatsApp is not connected. Link the device first.');
  }
  return state.sock;
}

async function logoutSession() {
  if (state.sock) {
    try {
      await state.sock.logout();
    } catch (_) {}
  }
  const { clearSession } = await useFirestoreAuthState(DEFAULT_SESSION_ID);
  await clearSession();
  state.sock = null;
  state.status = 'disconnected';
}

module.exports = { startSession, getSocket, getStatus, logoutSession };
