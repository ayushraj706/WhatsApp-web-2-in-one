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
    return <div className="h-[100dvh] flex items-center justify-center text-wa-text-secondary bg-[#EFEAE2]">Loading…</div>;
  }

  if (!connected) {
    return <ConnectScreen onConnected={() => setConnected(true)} />;
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-white">
      
      {/* Top Header (Mobile par jab chat open ho tab ise hide kar denge) */}
      <div className={`${activeJid ? 'hidden md:flex' : 'flex'} items-center justify-between px-4 py-3 bg-wa-teal text-white shadow-md z-10`}>
        <span className="font-semibold text-lg">WhatsApp Business</span>
        <Link href="/settings" className="bg-teal-700 hover:bg-teal-800 px-3 py-1.5 rounded-md text-sm transition">
          Settings
        </Link>
      </div>

      {/* Status Rail (Mobile par jab chat open ho tab ise bhi hide kar denge) */}
      <div className={`${activeJid ? 'hidden md:block' : 'block'} bg-white border-b border-gray-100`}>
        <StatusRail onOpen={setOpenStatusJid} />
      </div>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Chat List (Mobile par hide ho jayegi agar activeJid set hai) */}
        <div className={`${activeJid ? 'hidden md:flex' : 'flex'} w-full md:w-[350px] lg:w-[400px] border-r border-gray-200 shrink-0 flex-col`}>
          <ChatList activeJid={activeJid} onSelectChat={setActiveJid} />
        </div>

        {/* Chat Window Area (Mobile par absolute position me full screen le legi) */}
        <div className={`${activeJid ? 'flex' : 'hidden md:flex'} flex-1 flex-col absolute md:relative w-full h-full z-20 bg-white`}>
          
          {/* Mobile Back Button Header */}
          {activeJid && (
            <div className="md:hidden px-2 py-1.5 bg-[#F0F2F5] border-b border-gray-300 flex items-center gap-1 shadow-sm z-30">
              <button 
                onClick={() => setActiveJid(null)} 
                className="text-gray-600 hover:bg-gray-300 p-2 rounded-full transition flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
                </svg>
              </button>
              <span className="font-semibold text-gray-800 text-[15px]">Back</span>
            </div>
          )}
          
          <ChatWindow jid={activeJid} />
        </div>
      </div>

      {openStatusJid && <StatusViewer posterJid={openStatusJid} onClose={() => setOpenStatusJid(null)} />}
    </div>
  );
                  }
