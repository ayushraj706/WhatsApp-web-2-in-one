# Android App via Capacitor — Setup Steps

```bash
# 1. Build Next.js as a static export (CAPACITOR_BUILD flag enables output:'export')
cd frontend
CAPACITOR_BUILD=true npm run build

# 2. Install Capacitor + Android platform (once)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications
npx cap init "WA SaaS Clone" "com.yourcompany.whatsappsaas" --web-dir=out
npx cap add android

# 3. Sync the built web assets into the native Android project
npx cap sync android

# 4. Open in Android Studio to build/sign the APK/AAB
npx cap open android
```

## Firebase Cloud Messaging (Android native)
1. In Firebase Console → Project Settings → Add Android app, package name must match
   `appId` in `capacitor.config.ts` (`com.yourcompany.whatsappsaas`).
2. Download `google-services.json` → place at `frontend/android/app/google-services.json`.
3. In `frontend/android/build.gradle`, add classpath:
   `classpath 'com.google.gms:google-services:4.4.2'`
4. In `frontend/android/app/build.gradle`, add at the bottom:
   `apply plugin: 'com.google.gms.google-services'`
5. Rebuild: `npx cap sync android`.

## Requesting push token & registering with backend (frontend/lib/firebase.js)
```js
import { requestPushToken } from "../lib/firebase";

const token = await requestPushToken();
await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/push-token`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${backendToken}` },
  body: JSON.stringify({ token }),
});
```
Backend then calls `services/fcm.js -> sendPushNotification(token, {...})` whenever
`messages.upsert` fires a new WhatsApp message (see `sockets/whatsappSocket.js`).
