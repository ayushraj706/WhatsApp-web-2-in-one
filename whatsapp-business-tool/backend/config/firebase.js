const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return;

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  initialized = true;
}

initFirebase();

const db = admin.firestore();
// Keep Firestore's local cache small - we never want to accidentally
// hold entire collections in memory. Pagination is enforced everywhere
// messages/chats are read (see routes/chats.js, routes/messages.js).
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db };
