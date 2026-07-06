'use client';
export default function KeywordsTab({ settings, setSettings }) {
  const addRule = () => {
    setSettings(s => ({
      ...s, 
      keywordRules: [...s.keywordRules, { keyword: '', reply: '', matchType: 'contains', mediaUrl: '' }]
    }));
  };

  const updateRule = (index, field, value) => {
    const newRules = [...settings.keywordRules];
    newRules[index][field] = value;
    setSettings({ ...settings, keywordRules: newRules });
  };

  const removeRule = (index) => {
    const newRules = settings.keywordRules.filter((_, i) => i !== index);
    setSettings({ ...settings, keywordRules: newRules });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Keyword Automation</h2>
          <p className="text-sm text-gray-500">Trigger specific replies based on words in the user's message.</p>
        </div>
        <button onClick={addRule} className="px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg hover:bg-green-200">
          + Add Rule
        </button>
      </div>

      <div className="space-y-4">
        {settings.keywordRules.map((rule, i) => (
          <div key={i} className="p-5 border border-gray-200 rounded-xl bg-gray-50 space-y-4 relative">
            <button onClick={() => removeRule(i)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trigger Keyword</label>
                <input 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-green-500" 
                  placeholder="e.g. price, catalog" 
                  value={rule.keyword} 
                  onChange={(e) => updateRule(i, 'keyword', e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Match Type</label>
                <select 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-green-500 bg-white"
                  value={rule.matchType} 
                  onChange={(e) => updateRule(i, 'matchType', e.target.value)}
                >
                  <option value="contains">Contains Word</option>
                  <option value="exact">Exact Match</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Auto-Reply Text</label>
              <textarea 
                className="w-full p-3 border rounded-lg outline-none focus:border-green-500" 
                rows="2" 
                placeholder="Reply message..." 
                value={rule.reply} 
                onChange={(e) => updateRule(i, 'reply', e.target.value)} 
              />
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Attach Media URL (Optional)</label>
               <input 
                  className="w-full p-2.5 border rounded-lg outline-none focus:border-green-500" 
                  placeholder="https://example.com/image.jpg" 
                  value={rule.mediaUrl} 
                  onChange={(e) => updateRule(i, 'mediaUrl', e.target.value)} 
                />
            </div>
          </div>
        ))}
        {settings.keywordRules.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400">
            No keyword rules yet. Click "Add Rule" to start building BaseKey flows.
          </div>
        )}
      </div>
    </div>
  );
}
