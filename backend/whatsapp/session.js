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

// Strings Baileys logs internally when the Signal session state is corrupt.
const CORRUPTION_SIGNALS = [
  'InvalidPreKey',
  'MessageCounterError',
  'Bad MAC',
  'No matching sessions found',
];

const state = {
  sock: null,
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  lastError: null,
};

const msgRetryCache = new NodeCache();

// Guards against the logger firing multiple times (e.g. several bad-MAC
// lines in a row) and triggering clearSession/process.exit more than once.
let isHealing = false;

/**
 * "CCTV" logger: behaves like a normal pino logger, but watches every
 * warn/error line for signs of a corrupted Signal session. If it sees one,
 * it wipes the Firestore session and kills the process so Render's restart
 * policy brings the container back up with a clean slate (and a fresh QR).
 */
function createSelfHealingLogger(sessionId) {
  const baseLogger = pino({ level: 'error' });

  const containsCorruptionSignal = (args) => {
    const text = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message;
        if (a && typeof a === 'object') {
          try {
            return JSON.stringify(a);
          } catch (_) {
            return '';
          }
        }
        return '';
      })
      .join(' ');
    return CORRUPTION_SIGNALS.some((signal) => text.includes(signal));
  };

  const triggerSelfHeal = (args) => {
    if (isHealing) return;
    isHealing = true;

    console.error('🚨 [Self-Healing] Corrupted session signal detected:', ...args);
    console.error('🧹 [Self-Healing] Wiping Firestore session and restarting process...');

    clearSession(sessionId)
      .catch((err) => console.error('❌ [Self-Healing] clearSession failed:', err))
      .finally(() => {
        // Exit non-zero so Render's process supervisor restarts the
        // container. On the next boot, useFirestoreAuthState will find
        // no creds and generate a fresh session (new QR).
        process.exit(1);
      });
  };

  const logger = Object.create(baseLogger);

  logger.error = (...args) => {
    if (containsCorruptionSignal(args)) {
      triggerSelfHeal(args);
    }
    return baseLogger.error(...args);
  };

  logger.warn = (...args) => {
    if (containsCorruptionSignal(args)) {
      triggerSelfHeal(args);
    }
    return baseLogger.warn(...args);
  };

  // makeCacheableSignalKeyStore and Baileys internals call logger.child(...)
  // to get scoped child loggers — make sure those also inherit the hook.
  logger.child = (...args) => {
    const child = baseLogger.child(...args);
    const wrappedChild = Object.create(child);
    wrappedChild.error = (...cArgs) => {
      if (containsCorruptionSignal(cArgs)) triggerSelfHeal(cArgs);
      return child.error(...cArgs);
    };
    wrappedChild.warn = (...cArgs) => {
      if (containsCorruptionSignal(cArgs)) triggerSelfHeal(cArgs);
      return child.warn(...cArgs);
    };
    wrappedChild.child = logger.child;
    return wrappedChild;
  };

  return logger;
}

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

  // Self-Healing (CCTV) logger — watches for session corruption signals.
  const logger = createSelfHealingLogger(DEFAULT_SESSION_ID);

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
    // Resource optimization for Render's free tier: generous timeouts so
    // slow cold-starts don't get mistaken for a dead connection, and skip
    // the extra link-preview fetch to save memory/CPU.
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
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
        // Connection Stability: a normal drop (network blip, Render
        // free-tier sleep, etc.) must NOT wipe the session — only
        // reconnect with the existing creds.
        console.log(`⚠️ [whatsapp] Connection closed (Status: ${statusCode}), reconnecting in 3s...`);
        setTimeout(() => startSession(opts).catch(console.error), 3000);
      } else {
        console.log('🚨 [whatsapp] LOGGED OUT (401 Error) - User must relink device');
        console.log('🧹 [System] -> Auto-deleting corrupted session from Firebase...');

        state.sock = null;
        state.qrDataUrl = null;
        state.pairingCode = null;

        try {
          await clearSession(DEFAULT_SESSION_ID);
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
  await clearSession(DEFAULT_SESSION_ID);
  state.sock = null;
  state.status = 'disconnected';
}

module.exports = { startSession, getSocket, getStatus, logoutSession };
