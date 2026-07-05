'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ConnectScreen({ onConnected }) {
  const [mode, setMode] = useState('qr'); // 'qr' | 'code'
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState({ status: 'disconnected' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await api.status();
        setStatus(res);
        if (res.status === 'connected') onConnected?.();
      } catch (_) {}
    }, 2500);
    return () => clearInterval(poll);
  }, [onConnected]);

  async function handleConnectQr() {
    setBusy(true);
    try {
      await api.connect();
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectWithCode() {
    if (!phone) return;
    setBusy(true);
    try {
      await api.connect(phone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-wa-bg">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-wa-divider p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-wa-green mx-auto mb-4 flex items-center justify-center">
          <span className="text-white text-2xl">✆</span>
        </div>
        <h1 className="text-xl font-semibold mb-1">Link your device</h1>
        <p className="text-wa-text-secondary text-sm mb-6">
          Connect your WhatsApp number to enable automation, bulk sends, and auto-replies.
        </p>

        <div className="flex rounded-lg overflow-hidden border border-wa-divider mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium ${mode === 'qr' ? 'bg-wa-green text-white' : 'bg-white text-wa-text-secondary'}`}
            onClick={() => setMode('qr')}
          >
            Scan QR code
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium ${mode === 'code' ? 'bg-wa-green text-white' : 'bg-white text-wa-text-secondary'}`}
            onClick={() => setMode('code')}
          >
            Use phone number
          </button>
        </div>

        {mode === 'qr' && (
          <div>
            {status.status === 'qr_ready' && status.qrDataUrl ? (
              <img src={status.qrDataUrl} alt="Scan with WhatsApp" className="mx-auto w-56 h-56 rounded-lg border" />
            ) : (
              <div className="w-56 h-56 mx-auto rounded-lg border border-dashed border-wa-divider flex items-center justify-center text-wa-text-secondary text-sm">
                {status.status === 'connecting' ? 'Generating QR…' : 'Tap below to get a QR code'}
              </div>
            )}
            <p className="text-xs text-wa-text-secondary mt-4 mb-4">
              Open WhatsApp → Settings → Linked Devices → Link a Device, then scan this code.
            </p>
            <button
              onClick={handleConnectQr}
              disabled={busy}
              className="w-full bg-wa-green text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
            >
              {busy ? 'Starting…' : 'Get QR code'}
            </button>
          </div>
        )}

        {mode === 'code' && (
          <div>
            {status.status === 'pairing_code' && status.pairingCode ? (
              <div className="text-3xl font-bold tracking-widest my-6 text-wa-teal">{status.pairingCode}</div>
            ) : (
              <input
                type="tel"
                placeholder="e.g. 919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-wa-divider rounded-lg px-3 py-2.5 mb-4 outline-none focus:border-wa-green"
              />
            )}
            <p className="text-xs text-wa-text-secondary mb-4">
              Open WhatsApp → Settings → Linked Devices → Link with phone number instead, then enter this code.
            </p>
            <button
              onClick={handleConnectWithCode}
              disabled={busy || !phone}
              className="w-full bg-wa-green text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
            >
              {busy ? 'Requesting code…' : 'Get pairing code'}
            </button>
          </div>
        )}

        {status.lastError && <p className="text-red-500 text-xs mt-4">{status.lastError}</p>}
      </div>
    </div>
  );
}
