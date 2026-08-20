import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase configuration (Hardcoded - Publicly Safe)
const firebaseConfig = {
  apiKey: "AIzaSyA7eSyUGtk5GxSiB3O-3BY5G3p66MdEksY",
  authDomain: "notification-53600.firebaseapp.com",
  projectId: "notification-53600",
  storageBucket: "notification-53600.firebasestorage.app",
  messagingSenderId: "781765403038",
  appId: "1:781765403038:web:73f9be7f1092cf4c86b68f",
  measurementId: "G-7F16PW051F"
};

// Next.js safe initialization (Prevent duplicate app errors)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export async function requestPushToken() {
  if (typeof window === "undefined") return null;
  const messaging = getMessaging(app);
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // DHYAN DEIN: Yahan apni asli VAPID Key daalni hai
  return getToken(messaging, { vapidKey: "BH37GF3Wy1MYSsAls9yrw_HNW0nwUN0zc4TXm20Ixlh_L7epWWu3WzZMjJ9dk92KnvWdt7CszLIo-ufcbjiaPA4" }); 
}

export function listenForPush(callback) {
  if (typeof window === "undefined") return;
  const messaging = getMessaging(app);
  onMessage(messaging, callback);
}
