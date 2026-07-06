'use client';
export default function WelcomeTab({ settings, setSettings }) {
  const insertVar = (v) => {
    setSettings(s => ({
      ...s, 
      welcomeReply: { ...s.welcomeReply, text: s.welcomeReply.text + v }
    }));
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Welcome Message</h2>
        <p className="text-sm text-gray-500 mb-4">Auto-reply when a customer messages you for the first time.</p>
      </div>

      <label className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 cursor-pointer hover:bg-green-50 transition-colors">
        <input 
          type="checkbox" 
          checked={settings.welcomeReply.enabled} 
          onChange={(e) => setSettings(s => ({...s, welcomeReply: {...s.welcomeReply, enabled: e.target.checked}}))}
          className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
        />
        <span className="font-medium text-gray-700">Enable Welcome Reply</span>
      </label>

      {settings.welcomeReply.enabled && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {['%name%', '%phone%', '%time%'].map(v => (
              <button 
                key={v} 
                onClick={() => insertVar(v)} 
                className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full hover:bg-green-200"
              >
                + {v}
              </button>
            ))}
          </div>
          <textarea 
            rows="5" 
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            placeholder="Hi %name%, welcome to BaseKey!"
            value={settings.welcomeReply.text}
            onChange={(e) => setSettings(s => ({...s, welcomeReply: {...s.welcomeReply, text: e.target.value}}))}
          />
        </div>
      )}
    </div>
  );
}
