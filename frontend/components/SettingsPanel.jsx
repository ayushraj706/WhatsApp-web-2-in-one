import SettingsPanel from '@/components/SettingsPanel';

export const metadata = {
  title: 'Settings | BaseKey CRM',
  description: 'Manage BaseKey WhatsApp automation and configurations',
};

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <SettingsPanel />
    </main>
  );
}
