const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const NodeCache = require('node-cache');

const { useFirestoreAuthState, clearSession } = require('./firestoreAuthState');
const { handleIncomingMessage } = require('./messageHandler');

const DEFAULT_SESSION_ID = 'basekey-main'; 

// --- CCTV LOGIC START ---
const CORRUPTION_SIGNALS = ['InvalidPreKey', 'MessageCounterError', 'Bad MAC', 'No matching sessions found'];
const baseLogger = pino({ level: 'warn' });
const corruptLogger = Object.create(baseLogger);

corruptLogger.error = (...args) => {
  const text = args.map(a => (typeof a === 'string' ? a : a?.message || '')).join(' ');
  if (CORRUPTION_SIGNALS.some(sig => text.includes(sig))) {
    console.warn(`[Auth] Corrupt session detected, wiping and restarting...`);
    clearSession(DEFAULT_SESSION_ID).then(() => process.exit(1)); 
  }
  return baseLogger.error(...args);
};
// --- CCTV LOGIC END ---

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

  console.log(`[Session] -> Fetching Firebase Auth State for ID: ${DEFAULT_SESSION_ID}...`);
  let authState, saveCreds;
  try {
    const firestoreResult = await useFirestoreAuthState(DEFAULT_SESSION_ID);
    authState = firestoreResult.state;
    saveCreds = firestoreResult.saveCreds;
  } catch (err) {
    throw new Error('Firebase Auth init failed: ' + err.message);
  }

  const { version } = await fetchLatestBaileysVersion();
  
  // CCTV ACTIVE: logger: corruptLogger
  const sock = makeWASocket({
    version,
    logger: corruptLogger, 
    printQRInTerminal: true,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, corruptLogger),
    },
    msgRetryCounterCache: msgRetryCache,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  state.sock = sock;
  state.status = 'connecting';

  if (opts.phoneNumber && !authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(opts.phoneNumber.replace(/[^0-9]/g, ''));
        state.pairingCode = code;
        state.status = 'pairing_code';
      } catch (err) {
        state.lastError = err.message;
      }
    }, 2500); 
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !opts.phoneNumber) {
      state.qrDataUrl = await QRCode.toDataURL(qr);
      state.status = 'qr_ready';
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qrDataUrl = null;
      state.pairingCode = null;
      console.log('✅ [whatsapp] Connected as', sock.user?.id);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(() => startSession(opts).catch(console.error), 3000);
      } else {
        await clearSession(DEFAULT_SESSION_ID);
        state.status = 'disconnected';
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) await handleIncomingMessage(sock, msg);
      }
    }
  });

  return getStatus();
}

module.exports = { startSession, getStatus, clearSession };
