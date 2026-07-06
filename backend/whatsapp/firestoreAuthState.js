// backend/whatsapp/connection.js
const pino = require('pino');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useFirestoreAuthState, clearSession } = require('./firestoreAuthState');

// Keywords Baileys logs internally when a session's crypto state is broken.
const CORRUPTION_SIGNALS = [
  'InvalidPreKey',
  'MessageCounterError',
  'Bad MAC',
  'No matching sessions found for message',
];

function isCorruptionLog(args) {
  const text = args.map(a => (typeof a === 'string' ? a : a?.message || '')).join(' ');
  return CORRUPTION_SIGNALS.some(sig => text.includes(sig));
}

async function startSession(sessionId, onNeedsRestart) {
  const { state, saveCreds } = await useFirestoreAuthState(sessionId);

  const baseLogger = pino({ level: 'warn' });
  // Wrap error/warn so we can inspect what Baileys is logging without
  // changing its own logging behavior.
  const logger = Object.create(baseLogger);
  logger.error = (...args) => {
    if (isCorruptionLog(args)) {
      console.warn(`[Auth] Corrupt session detected for "${sessionId}", wiping...`);
      clearSession(sessionId)
        .then(() => onNeedsRestart?.(sessionId)) // caller restarts -> initAuthCreds() -> new QR
        .catch(err => console.error('[Auth] Failed to clear session:', err));
    }
    return baseLogger.error(...args);
  };

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  return sock;
}

module.exports = { startSession };
