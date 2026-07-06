'use client';
import { useState, useEffect } from 'react';
import WelcomeTab from './Settings/WelcomeTab';
import KeywordsTab from './Settings/KeywordsTab';
import MediaTab from './Settings/MediaTab';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [settings, setSettings] = useState({
    welcomeReply: { enabled: false, text: '' },
    keywordRules: [],
    mediaLibrary: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch mock/real API call
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if(data.settings) setSettings(data.settings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      alert('BaseKey Settings Saved Successfully!');
    } catch (error) {
      alert('Failed to save settings.');
    }
  };

  if (loading) return <div className="text-center mt-20 text-green-600 font-semibold">Loading BaseKey Engine...</div>;

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-green-600 px-6 py-4">
        <h1 className="text-xl font-bold text-white">BaseKey CRM Settings</h1>
      </div>

      <div className="flex border-b border-gray-200">
        {['welcome', 'keywords', 'media'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab 
                ? 'border-b-2 border-green-600 text-green-700 bg-green-50' 
                : 'text-gray-500 hover:text-green-600 hover:bg-gray-50'
            }`}
          >
            {tab} Automation
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'welcome' && <WelcomeTab settings={settings} setSettings={setSettings} />}
        {activeTab === 'keywords' && <KeywordsTab settings={settings} setSettings={setSettings} />}
        {activeTab === 'media' && <MediaTab settings={settings} setSettings={setSettings} />}
        
        <div className="mt-8 pt-5 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            Save All Settings
          </button>
        </div>
      </div>
    </div>
  );
        }
            
