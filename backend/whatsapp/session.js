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

const DEFAULT_SESSION_ID = 'primary'; // single-number bot; extend to multi-tenant by keying on sessionId

// In-memory only (tiny) - not chat history, just live connection state.
const state = {
  sock: null,
  status: 'disconnected', // disconnected | connecting | qr_ready | pairing_code | connected
  qrDataUrl: null,
  pairingCode: null,
  lastError: null,
};

const msgRetryCache = new NodeCache(); // small, bounded cache Baileys uses for retry receipts

function getStatus() {
  return {
    status: state.status,
    qrDataUrl: state.status === 'qr_ready' ? state.qrDataUrl : null,
    pairingCode: state.status === 'pairing_code' ? state.pairingCode : null,
    lastError: state.lastError,
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.phoneNumber] - if provided, request a pairing code instead of QR
 */
async function startSession(opts = {}) {
  if (state.sock && state.status === 'connected') {
    return getStatus();
  }

  const { state: authState, saveCreds } = await useFirestoreAuthState(DEFAULT_SESSION_ID);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'error' });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger),
    },
    msgRetryCounterCache: msgRetryCache,
    generateHighQualityLinkPreview: true,
    // Never keep full sync history in RAM - we persist what we need
    // to Firestore ourselves inside messageHandler and let Baileys
    // discard the rest.
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  state.sock = sock;
  state.status = 'connecting';
  state.lastError = null;

  // Request a pairing code (numeric, entered on phone) instead of scanning QR
  if (opts.phoneNumber && !authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(opts.phoneNumber.replace(/[^0-9]/g, ''));
      state.pairingCode = code;
      state.status = 'pairing_code';
    } catch (err) {
      state.lastError = err.message;
    }
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
      console.log('[whatsapp] connected as', sock.user?.id);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      state.status = 'disconnected';

      if (!loggedOut) {
        // transient network/server issue - auto reconnect
        console.log('[whatsapp] connection closed, reconnecting...', statusCode);
        setTimeout(() => startSession(opts).catch(console.error), 3000);
      } else {
        console.log('[whatsapp] logged out - user must relink device');
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
