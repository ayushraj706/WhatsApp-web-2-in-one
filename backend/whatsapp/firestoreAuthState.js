/**
 * A drop-in replacement for Baileys' useMultiFileAuthState, backed by Firestore.
 * UPDATED: Includes auto-cleanup logic to prevent session corruption.
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

  // --- AUTO CLEANUP LOGIC ---
  // Agar creds (encryption keys) database mein hain, toh unhe read karo, 
  // warna fresh init karo.
  let creds = await readData('creds');
  
  if (!creds) {
    console.log('[Auth] No existing session found, initializing fresh session...');
    // Fresh session ke liye purana session ka kachra saaf kar do
    await sessionRef.collection('keys').get().then(snap => {
       const batch = db.batch();
       snap.docs.forEach(doc => batch.delete(doc.ref));
       return batch.commit();
    }).catch(err => console.error('[Auth] Cleanup failed:', err));
    
    creds = initAuthCreds();
  } else {
    console.log('[Auth] Existing session loaded.');
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
      await writeData('creds', creds);
    },
    clearSession: async () => {
      const snap = await keysCol.get();
      const batchDeletes = snap.docs.map((d) => d.ref.delete());
      await Promise.all(batchDeletes);
    },
  };
}

module.exports = { useFirestoreAuthState };
