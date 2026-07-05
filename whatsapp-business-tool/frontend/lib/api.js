const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  connect: (phoneNumber) =>
    request('/api/auth/connect', { method: 'POST', body: JSON.stringify(phoneNumber ? { phoneNumber } : {}) }),
  status: () => request('/api/auth/status'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  getChats: (cursor) => request(`/api/chats${cursor ? `?cursor=${cursor}` : ''}`),
  getMessages: (jid, cursor) =>
    request(`/api/chats/${encodeURIComponent(jid)}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  markRead: (jid) => request(`/api/chats/${encodeURIComponent(jid)}/read`, { method: 'POST' }),

  sendText: (to, text) => request('/api/messages/text', { method: 'POST', body: JSON.stringify({ to, text }) }),

  sendBulk: (numbers, message, minDelayMs, maxDelayMs) =>
    request('/api/bulk/send', {
      method: 'POST',
      body: JSON.stringify({ numbers, message, minDelayMs, maxDelayMs }),
    }),
  bulkStatus: (campaignId) => request(`/api/bulk/${campaignId}`),

  getStatusPosters: () => request('/api/status'),
  getStatusItems: (posterJid) => request(`/api/status/${encodeURIComponent(posterJid)}`),

  getSettings: () => request('/api/settings'),
  saveSettings: (settings) => request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  generateApiKey: () => request('/api/settings/api-key/generate', { method: 'POST' }),
};
