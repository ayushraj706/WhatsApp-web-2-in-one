# WhatsApp Business Automation Tool

Full-stack WhatsApp Web automation platform: Baileys (multi-device WhatsApp) + Next.js/Tailwind (iOS WhatsApp-style UI) + Firebase (Firestore chat storage) + Cloudinary (media storage).

> **Legal note (zaroor padhein):** This uses `@whiskeysockets/baileys`, an unofficial/reverse-engineered WhatsApp Web client. It is not affiliated with or endorsed by WhatsApp/Meta, and using it can violate WhatsApp's Terms of Service — accounts can be banned, especially for bulk/automated messaging. Use only with numbers you own or have explicit consent to message, keep volumes low and delays high, and understand you're accepting that risk. This project does not circumvent any authentication or security control — it automates the same "Linked Devices" feature WhatsApp itself exposes.

## What's inside

```
whatsapp-business-tool/
├── backend/          Node.js + Express + Baileys + Firebase Admin + Cloudinary
└── frontend/          Next.js 14 (App Router) + Tailwind CSS
```

## Features implemented

- **Session management**: QR code linking AND phone-number pairing code (both, as requested). Session/auth keys persist in Firestore (`wa_sessions/...`), so redeploying the backend does NOT require re-scanning.
- **Complete chat history, never deleted**: every message is its own Firestore document under `chats/{jid}/messages/{id}` — there is no delete code path anywhere for messages.
- **Bulk messaging** with a random 5–15s (configurable) delay between sends, run as a background job with live progress tracking.
- **Auto-responder**: welcome reply for first-time contacts + keyword-based rules (contains/exact match), editable from Settings.
- **Webhook integration**: `POST /api/webhook/send` and `/api/webhook/bulk`, secured with an API key you generate from Settings; plus an *outgoing* webhook that fires on every inbound message.
- **Status/Story viewer**: incoming statuses are captured and stored (24h expiry logic), with a full-screen story-style viewer with auto-advancing progress bars.
- **iOS WhatsApp-styled UI**: chat list, chat bubbles with tails, composer, connect screen, settings screen — built with Tailwind using WhatsApp's real color tokens (`#25D366`, `#075E54`, `#D9FDD3`, dark mode `#0B141A`/`#005C4B`, etc). This is a strong visual approximation, not a copy of WhatsApp's proprietary asset files.
- **RAM discipline (<500MB target)**:
  - Firestore reads are always paginated (`limit` + `startAfter` cursors) — chat list and message history never load a full collection.
  - Media is streamed straight from Baileys/multer buffers into Cloudinary's `upload_stream` — nothing is buffered to disk or held longer than one request.
  - `server.js` logs RSS memory every 60s so you can watch real usage on Render/your VPS.

## Setup

### 1. Firebase
1. Create a Firebase project → enable **Firestore** (production mode).
2. Project Settings → Service Accounts → **Generate new private key** → download the JSON.
3. Copy `projectId`, `client_email`, and `private_key` from that JSON into `backend/.env` (see `.env.example`). Keep the `\n` characters in the private key literal (don't convert to real newlines in the `.env` file).

### 2. Cloudinary
1. Sign up at cloudinary.com → Dashboard shows Cloud name, API key, API secret → paste into `backend/.env`.

### 3. Backend
```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm start              # or: npm run dev (nodemon)
```
Backend runs on `http://localhost:5000` by default.

### 4. Frontend
```bash
cd frontend
npm install
# create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev
```
Open `http://localhost:3000`. You'll land on the Connect screen — choose **Scan QR code** (classic) or **Use phone number** (enter your number, get a pairing code, type it into WhatsApp → Linked Devices → Link with phone number).

### 5. Deploying under 500MB RAM
- Backend: works fine on Render's free/starter tier or any small VPS (512MB–1GB). Don't run multiple WhatsApp sessions per instance.
- Frontend: deploy to Vercel (or any Node host) — set `NEXT_PUBLIC_API_URL` to your backend's public URL.
- Firestore/Cloudinary are fully managed — no RAM cost on your server.

## API quick reference (for the webhook feature)

```bash
# Generate an API key first from Settings page, then:
curl -X POST https://your-backend/api/webhook/send \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "text": "Hello from webhook!"}'

curl -X POST https://your-backend/api/webhook/bulk \
  -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"numbers": ["919876543210","919876543211"], "message": "Bulk hi!"}'
```

## Honest limitations / next steps

- Single WhatsApp number per backend instance in this scaffold (extend `whatsapp/session.js`'s `DEFAULT_SESSION_ID` to support multiple tenants if you need several numbers).
- The UI is a faithful *visual* approximation of iOS WhatsApp (colors, bubble shapes, layout) built from scratch with Tailwind — not literal Apple/WhatsApp source or assets.
- Group chat handling, message reactions, replies/quotes, and read-receipt ticks aren't wired up yet — the data model (per-message Firestore docs) supports adding them without restructuring anything.
- Add Firestore security rules before going to production (this scaffold assumes the Admin SDK is the only writer, via your backend).
