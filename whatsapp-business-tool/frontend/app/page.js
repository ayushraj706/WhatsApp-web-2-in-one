'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import ConnectScreen from '@/components/ConnectScreen';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import StatusViewer, { StatusRail } from '@/components/StatusViewer';

export default function HomePage() {
  const [connected, setConnected] = useState(null); // null = checking
  const [activeJid, setActiveJid] = useState(null);
  const [openStatusJid, setOpenStatusJid] = useState(null);

  useEffect(() => {
    api
      .status()
      .then((res) => setConnected(res.status === 'connected'))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) {
    return <div className="min-h-screen flex items-center justify-center text-wa-text-secondary">Loading…</div>;
  }

  if (!connected) {
    return <ConnectScreen onConnected={() => setConnected(true)} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-wa-teal text-white text-sm">
        <span>WhatsApp Business Automation</span>
        <Link href="/settings" className="underline">
          Settings
        </Link>
      </div>

      <StatusRail onOpen={setOpenStatusJid} />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full max-w-sm">
          <ChatList activeJid={activeJid} onSelectChat={setActiveJid} />
        </div>
        <ChatWindow jid={activeJid} />
      </div>

      {openStatusJid && <StatusViewer posterJid={openStatusJid} onClose={() => setOpenStatusJid(null)} />}
    </div>
  );
}
