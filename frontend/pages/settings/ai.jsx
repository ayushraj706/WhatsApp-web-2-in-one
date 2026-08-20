import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * AI Settings Page — implements all four automation rules from the spec:
 *  a) manual model selection
 *  b) automatic mode
 *  c) largest vs fastest policy
 *  d) confirm-before-send toggle
 */
export default function AISettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState({
    aiEnabled: false,
    aiMode: "manual",           // "manual" | "automatic"
    aiPreferredProvider: "openai",
    aiSelectedModel: "gpt-4o-mini",
    aiSizePolicy: "auto",       // "largest" | "fastest" | "auto"
    aiRequireConfirmation: true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/ai/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.backendToken}`,
      },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-lg p-6 text-white">
      <h1 className="mb-6 text-xl font-semibold">AI Auto-Reply Settings</h1>

      <label className="mb-4 flex items-center justify-between">
        <span>Enable AI automation</span>
        <input
          type="checkbox"
          checked={settings.aiEnabled}
          onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
        />
      </label>

      <div className="mb-4">
        <p className="mb-1 text-sm text-gray-400">Mode</p>
        <select
          className="w-full rounded bg-wa-bubbleIn p-2"
          value={settings.aiMode}
          onChange={(e) => setSettings({ ...settings, aiMode: e.target.value })}
        >
          <option value="manual">Manual (I choose the model)</option>
          <option value="automatic">Automatic (system decides)</option>
        </select>
      </div>

      {settings.aiMode === "manual" ? (
        <div className="mb-4">
          <p className="mb-1 text-sm text-gray-400">Model</p>
          <select
            className="w-full rounded bg-wa-bubbleIn p-2"
            value={settings.aiSelectedModel}
            onChange={(e) => setSettings({ ...settings, aiSelectedModel: e.target.value })}
          >
            <option value="gpt-4o">GPT-4o (OpenAI, largest)</option>
            <option value="gpt-4o-mini">GPT-4o-mini (OpenAI, fastest)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (largest)</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (fastest)</option>
            <option value="claude-opus-4-8">Claude Opus (largest)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku (fastest)</option>
          </select>
        </div>
      ) : (
        <div className="mb-4">
          <p className="mb-1 text-sm text-gray-400">Automatic sizing policy</p>
          <select
            className="w-full rounded bg-wa-bubbleIn p-2"
            value={settings.aiSizePolicy}
            onChange={(e) => setSettings({ ...settings, aiSizePolicy: e.target.value })}
          >
            <option value="auto">Auto (pick model by message complexity)</option>
            <option value="largest">Always use the largest model</option>
            <option value="fastest">Always use the fastest/smallest model</option>
          </select>
        </div>
      )}

      <label className="mb-6 flex items-center justify-between">
        <span>Ask for my confirmation before sending AI replies</span>
        <input
          type="checkbox"
          checked={settings.aiRequireConfirmation}
          onChange={(e) => setSettings({ ...settings, aiRequireConfirmation: e.target.checked })}
        />
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded bg-wa-accent py-2 font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
