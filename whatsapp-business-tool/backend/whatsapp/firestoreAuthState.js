/**
 * A drop-in replacement for Baileys' useMultiFileAuthState, but backed by
 * Firestore instead of the local filesystem. This is what lets the bot
 * reconnect after a redeploy/restart on ephemeral hosts (Render, Railway,
 * etc.) WITHOUT asking the user to scan the QR code again.
 *
 * Keys are stored under collection `wa_sessions/{sessionId}/keys/{keyId}`.
 * Only the exact keys Baileys asks for are read/written - we never load
 * the whole keys collection into memory.
 */
const { db } = require('../config/firebase');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

async function useFirestoreAuthState(sessionId) {
  const sessionRef = db.collection('wa_sessions').doc(sessionId);
  const keysCol = sessionRef.collection('keys');

  async function readData(key) {
    const doc = await keysCol.doc(key).get();
    if (!doc.exists) return null;
    const raw = doc.data().json;
    return JSON.parse(raw, BufferJSON.reviver);
  }

  async function writeData(key, value) {
    const json = JSON.stringify(value, BufferJSON.replacer);
    await keysCol.doc(key).set({ json, updatedAt: Date.now() });
  }

  async function removeData(key) {
    await keysCol.doc(key).delete().catch(() => {});
  }

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    // Wipes the whole session (used when the user wants to unlink the device)
    clearSession: async () => {
      const snap = await keysCol.get();
      const batchDeletes = snap.docs.map((d) => d.ref.delete());
      await Promise.all(batchDeletes);
    },
  };
}

module.exports = { useFirestoreAuthState };
