'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    welcomeReply: { enabled: false, text: '' },
    keywordRules: [],
    bulkDelay: { minMs: 5000, maxMs: 15000 },
    webhookUrl: '',
  });
  const [apiKey, setApiKey] = useState(null);
  const [saving, setSaving] = useState(false);

  // Bulk campaign form
  const [numbersText, setNumbersText] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [campaignId, setCampaignId] = useState(null);
  const [campaignProgress, setCampaignProgress] = useState(null);

  useEffect(() => {
    api.getSettings().then((res) => setSettings((s) => ({ ...s, ...res.settings })));
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    const poll = setInterval(async () => {
      const res = await api.bulkStatus(campaignId);
      setCampaignProgress(res.campaign);
      if (res.campaign.status === 'completed') clearInterval(poll);
    }, 2000);
    return () => clearInterval(poll);
  }, [campaignId]);

  async function save() {
    setSaving(true);
    try {
      await api.saveSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    setSettings((s) => ({
      ...s,
      keywordRules: [...s.keywordRules, { keyword: '', reply: '', matchType: 'contains' }],
    }));
  }

  function updateRule(i, field, value) {
    setSettings((s) => {
      const rules = [...s.keywordRules];
      rules[i] = { ...rules[i], [field]: value };
      return { ...s, keywordRules: rules };
    });
  }

  function removeRule(i) {
    setSettings((s) => ({ ...s, keywordRules: s.keywordRules.filter((_, idx) => idx !== i) }));
  }

  async function generateKey() {
    const res = await api.generateApiKey();
    setApiKey(res.apiKey);
  }

  async function launchBulk() {
    const numbers = numbersText
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!numbers.length || !bulkMessage) return;
    const res = await api.sendBulk(numbers, bulkMessage, settings.bulkDelay.minMs, settings.bulkDelay.maxMs);
    setCampaignId(res.campaignId);
    setCampaignProgress({ total: numbers.length, sent: 0, failed: 0, status: 'running' });
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Welcome reply */}
      <section className="bg-white rounded-xl border border-wa-divider p-5">
        <h2 className="font-medium mb-3">Welcome reply</h2>
        <label className="flex items-center gap-2 mb-3 text-sm">
          <input
            type="checkbox"
            checked={settings.welcomeReply.enabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, welcomeReply: { ...s.welcomeReply, enabled: e.target.checked } }))
            }
          />
          Send an automatic reply to first-time contacts
        </label>
        <textarea
          rows={3}
          placeholder="Hi! Thanks for reaching out, we'll get back to you shortly."
          value={settings.welcomeReply.text}
          onChange={(e) => setSettings((s) => ({ ...s, welcomeReply: { ...s.welcomeReply, text: e.target.value } }))}
          className="w-full border border-wa-divider rounded-lg p-2.5 text-sm outline-none focus:border-wa-green"
        />
      </section>

      {/* Keyword rules */}
      <section className="bg-white rounded-xl border border-wa-divider p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Keyword auto-reply rules</h2>
          <button onClick={addRule} className="text-sm text-wa-green-dark font-medium">
            + Add rule
          </button>
        </div>
        <div className="space-y-3">
          {settings.keywordRules.map((rule, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                placeholder="keyword"
                value={rule.keyword}
                onChange={(e) => updateRule(i, 'keyword', e.target.value)}
                className="w-1/3 border border-wa-divider rounded-lg p-2 text-sm outline-none focus:border-wa-green"
              />
              <input
                placeholder="auto-reply text"
                value={rule.reply}
                onChange={(e) => updateRule(i, 'reply', e.target.value)}
                className="flex-1 border border-wa-divider rounded-lg p-2 text-sm outline-none focus:border-wa-green"
              />
              <select
                value={rule.matchType}
                onChange={(e) => updateRule(i, 'matchType', e.target.value)}
                className="border border-wa-divider rounded-lg p-2 text-sm"
              >
                <option value="contains">contains</option>
                <option value="exact">exact</option>
              </select>
              <button onClick={() => removeRule(i)} className="text-red-500 text-sm px-2">
                Remove
              </button>
            </div>
          ))}
          {!settings.keywordRules.length && (
            <p className="text-sm text-wa-text-secondary">No rules yet.</p>
          )}
        </div>
      </section>

      {/* Bulk delay + webhook + api key */}
      <section className="bg-white rounded-xl border border-wa-divider p-5">
        <h2 className="font-medium mb-3">Bulk sending delay (anti-ban)</h2>
        <div className="flex gap-3 mb-4">
          <label className="flex-1 text-sm">
            Min (ms)
            <input
              type="number"
              value={settings.bulkDelay.minMs}
              onChange={(e) => setSettings((s) => ({ ...s, bulkDelay: { ...s.bulkDelay, minMs: Number(e.target.value) } }))}
              className="w-full border border-wa-divider rounded-lg p-2 mt-1 text-sm"
            />
          </label>
          <label className="flex-1 text-sm">
            Max (ms)
            <input
              type="number"
              value={settings.bulkDelay.maxMs}
              onChange={(e) => setSettings((s) => ({ ...s, bulkDelay: { ...s.bulkDelay, maxMs: Number(e.target.value) } }))}
              className="w-full border border-wa-divider rounded-lg p-2 mt-1 text-sm"
            />
          </label>
        </div>

        <h2 className="font-medium mb-2">Outgoing webhook</h2>
        <input
          placeholder="https://yourapp.com/webhook"
          value={settings.webhookUrl || ''}
          onChange={(e) => setSettings((s) => ({ ...s, webhookUrl: e.target.value }))}
          className="w-full border border-wa-divider rounded-lg p-2.5 text-sm mb-4"
        />

        <h2 className="font-medium mb-2">API key (for /api/webhook/* endpoints)</h2>
        <div className="flex gap-2 items-center">
          <button onClick={generateKey} className="bg-wa-teal text-white text-sm px-3 py-2 rounded-lg">
            Generate new key
          </button>
          {apiKey && <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{apiKey}</code>}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-5 w-full bg-wa-green text-white py-2.5 rounded-lg font-medium disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      {/* Bulk campaign launcher */}
      <section className="bg-white rounded-xl border border-wa-divider p-5">
        <h2 className="font-medium mb-3">Send bulk campaign</h2>
        <textarea
          rows={4}
          placeholder="One number per line (e.g. 919876543210)"
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          className="w-full border border-wa-divider rounded-lg p-2.5 text-sm mb-3"
        />
        <textarea
          rows={3}
          placeholder="Message to send"
          value={bulkMessage}
          onChange={(e) => setBulkMessage(e.target.value)}
          className="w-full border border-wa-divider rounded-lg p-2.5 text-sm mb-3"
        />
        <button onClick={launchBulk} className="bg-wa-green text-white px-4 py-2.5 rounded-lg font-medium">
          Start campaign
        </button>

        {campaignProgress && (
          <div className="mt-4 text-sm">
            <p>
              Sent {campaignProgress.sent} / {campaignProgress.total} • Failed {campaignProgress.failed} • {campaignProgress.status}
            </p>
            <div className="w-full h-2 bg-gray-100 rounded mt-2 overflow-hidden">
              <div
                className="h-full bg-wa-green"
                style={{ width: `${((campaignProgress.sent + campaignProgress.failed) / campaignProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
