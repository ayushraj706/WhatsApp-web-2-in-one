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

const DEFAULT_SESSION_ID = 'basekey-main'; 

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
    console.log(`[Session] -> Firebase connection SUCCESS.`);
  } catch (err) {
    console.error(`[Firebase Error] -> Check FIREBASE_PRIVATE_KEY. Error:`, err);
    throw new Error('Firebase Auth init failed: ' + err.message);
  }

  console.log(`[Session] -> Fetching latest Baileys version...`);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[Session] -> Baileys version: v${version.join('.')}`);

  const logger = pino({ level: 'error' });

  console.log(`[Session] -> Initializing WhatsApp Socket Engine...`);
  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger),
    },
    msgRetryCounterCache: msgRetryCache,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  state.sock = sock;
  state.status = 'connecting';
  state.lastError = null;

  if (opts.phoneNumber && !authState.creds.registered) {
    console.log(`[Session] -> Requesting pairing code for ${opts.phoneNumber}...`);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(opts.phoneNumber.replace(/[^0-9]/g, ''));
        state.pairingCode = code;
        state.status = 'pairing_code';
        console.log(`[Session] -> SUCCESS! Pairing code:`, code);
      } catch (err) {
        console.error(`[Session Error] -> Pairing code failed:`, err.message);
        state.lastError = err.message;
      }
    }, 2500); 
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !opts.phoneNumber) {
      console.log(`[Session] -> QR Code generated.`);
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
        console.log(`⚠️ [whatsapp] Connection closed (Status: ${statusCode}), reconnecting in 3s...`);
        setTimeout(() => startSession(opts).catch(console.error), 3000);
      } else {
        console.log('🚨 [whatsapp] LOGGED OUT (401 Error) - User must relink device');
        console.log('🧹 [System] -> Auto-deleting corrupted session from Firebase...');
        
        state.sock = null;
        state.qrDataUrl = null;
        state.pairingCode = null;

        try {
          const { clearSession } = await useFirestoreAuthState(DEFAULT_SESSION_ID);
          await clearSession();
          console.log('✅ [System] -> Session cleaned. Ready for fresh start.');
          startSession(opts).catch(console.error);
        } catch (err) {
          console.error('❌ [System] -> Session cleanup failed:', err);
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            await handleIncomingMessage(sock, msg);
          }
        }
      }
    } catch (err) {
      console.error('[messageHandler] Error processing incoming message:', err);
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
