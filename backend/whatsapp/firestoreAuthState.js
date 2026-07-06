/**
 * A drop-in replacement for Baileys' useMultiFileAuthState, backed by Firestore.
 * FIXED: Dynamic creds update and robust cleanup logic.
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

  // --- ROBUST AUTH LOAD ---
  let creds = await readData('creds');
  if (!creds) {
    console.log('[Auth] Initializing fresh session...');
    // Cleanup existing keys if initialization happens
    const snap = await keysCol.get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    creds = initAuthCreds();
  }

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
      // DYNAMIC UPDATE: Har baar saveCreds call hone par updated creds likho
      await writeData('creds', creds);
    },
  };
}

module.exports = { useFirestoreAuthState };
