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
    // Basic formatting: remove spaces/+, ensure it's a clean number
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;
    setBusy(true);
    try {
      await api.connect(cleanPhone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFEAE2]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-gray-100 p-8 text-center m-4">
        
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-full bg-[#00a884] mx-auto mb-5 flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">BaseKey CRM</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Link your WhatsApp Business to enable auto-replies, smart flows, and CRM features.
        </p>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 rounded-lg overflow-hidden p-1 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'qr' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setMode('qr')}
          >
            Scan QR Code
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'code' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setMode('code')}
          >
            Phone Number
          </button>
        </div>

        {/* QR CODE MODE */}
        {mode === 'qr' && (
          <div className="animate-fadeIn">
            <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm inline-block mb-4 relative">
              {status.status === 'qr_ready' && status.qrDataUrl ? (
                <img src={status.qrDataUrl} alt="Scan QR" className="w-56 h-56 object-contain" />
              ) : (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                   {status.status === 'connecting' || busy ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mb-3"></div>
                        <span className="text-sm font-medium text-gray-500">Generating Code...</span>
                      </>
                   ) : (
                      <span className="text-sm font-medium">Click below to generate</span>
                   )}
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mb-5 px-4">
              Open WhatsApp → Settings → Linked Devices → Link a Device, and scan this code.
            </p>
            
            <button
              onClick={handleConnectQr}
              disabled={busy || status.status === 'connecting'}
              className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white py-3 rounded-xl font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Generate Fresh QR
            </button>
          </div>
        )}

        {/* PHONE NUMBER MODE */}
        {mode === 'code' && (
          <div className="animate-fadeIn">
            {status.status === 'pairing_code' && status.pairingCode ? (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Your Pairing Code</p>
                <div className="text-4xl font-bold tracking-[0.2em] text-[#00a884]">{status.pairingCode}</div>
              </div>
            ) : (
              <div className="mb-5 text-left">
                <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">WhatsApp Number (with Country Code)</label>
                <input
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition"
                />
              </div>
            )}
            
            <p className="text-xs text-gray-500 mb-5 px-2">
              Open WhatsApp → Linked Devices → Link with phone number instead, then enter the code.
            </p>
            
            <button
              onClick={handleConnectWithCode}
              disabled={busy || !phone || status.status === 'connecting'}
              className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white py-3 rounded-xl font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {busy ? 'Requesting Code...' : 'Get Pairing Code'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {status.lastError && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
            {status.lastError}
          </div>
        )}
      </div>
    </div>
  );
}
