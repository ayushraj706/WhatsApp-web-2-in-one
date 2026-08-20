import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export async function requestPushToken() {
  if (typeof window === "undefined") return null;
  const messaging = getMessaging(app);
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  return getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY });
}

export function listenForPush(callback) {
  if (typeof window === "undefined") return;
  const messaging = getMessaging(app);
  onMessage(messaging, callback);
}
