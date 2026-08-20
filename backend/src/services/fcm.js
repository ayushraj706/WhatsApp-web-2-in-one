const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FCM_PROJECT_ID,
    clientEmail: process.env.FCM_CLIENT_EMAIL,
    privateKey: (process.env.FCM_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});

/**
 * Send a background push notification (used when a new WA message
 * arrives and the app is closed / backgrounded on Android).
 */
async function sendPushNotification(deviceToken, { title, body, chatId }) {
  try {
    await admin.messaging().send({
      token: deviceToken,
      notification: { title, body },
      data: { chatId: String(chatId) },
      android: { priority: "high" },
    });
  } catch (err) {
    console.error("FCM send failed:", err.message);
  }
}

module.exports = { sendPushNotification };
