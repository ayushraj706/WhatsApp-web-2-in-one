'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// SMART HELPER: 12-digit number ko clean +91 format me badalne ke liye
function formatPhoneNumber(num) {
  if (!num) return '';
  // Agar Indian number hai (91 se shuru aur 12 digit)
  if (num.startsWith('91') && num.length === 12) {
    return `+91 ${num.slice(2, 7)} ${num.slice(7)}`;
  }
  return '+' + num;
}

// SMART HELPER: Naam ya Number nikalne ke liye
function getDisplayName(chat) {
  // Agar backend se asli naam (pushName) aaya hai aur wo 'User' nahi hai
  if (chat.pushName && chat.pushName !== 'User') {
    return chat.pushName;
  }
  // Warna clean formatted number return karo
  return formatPhoneNumber(chat.jid.split('@')[0]);
}

// SMART HELPER: Avatar ke initials nikalne ke liye
function getInitials(displayName) {
  if (displayName.startsWith('+')) {
    // Agar number hai, toh aakhri ke 2 digit (iOS style placeholder)
    return displayName.slice(-2);
  }
  const parts = displayName.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  // iOS Style Time (e.g., "10:30 AM")
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatList({ activeJid, onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await api.getChats(cursor);
      setChats((prev) => {
        const existingJids = new Set(prev.map(c => c.jid));
        const newChats = res.chats.filter(c => !existingJids.has(c.jid));
        return [...prev, ...newChats];
      });
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  function onScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore();
  }

  return (
    <div className="h-full flex flex-col bg-white border-r border-[#E5E5EA] w-full max-w-sm shrink-0">
      
      {/* iOS Style Header */}
      <div className="bg-[#F6F6F6] pb-2 border-b border-[#E5E5EA] z-10 sticky top-0">
        <div className="flex justify-between items-center px-4 pt-8 pb-1">
          <h1 className="text-[32px] font-bold text-black tracking-tight leading-none">Chats</h1>
          <button className="text-[#007AFF] text-[17px] font-medium hover:opacity-70 transition-opacity">
            Edit
          </button>
        </div>
        
        {/* iOS Style Search Bar */}
        <div className="px-4 mt-2">
          <div className="bg-[#7676801F] rounded-[10px] flex items-center px-2 py-1.5">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-[#8E8E93] mr-1" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input 
              type="text" 
              placeholder="Search" 
              className="bg-transparent border-none outline-none w-full text-[17px] text-black placeholder-[#8E8E93]" 
            />
          </div>
        </div>
      </div>

      {/* Chat Items List */}
      <div className="flex-1 overflow-y-auto thin-scroll bg-white" onScroll={onScroll}>
        {chats.map((chat) => {
          const displayName = getDisplayName(chat);
          const initials = getInitials(displayName);
          const isUnread = chat.unreadCount > 0;
          
          return (
            <button
              key={chat.jid}
              onClick={() => onSelectChat(chat.jid)}
              className={`w-full flex items-center text-left transition-colors duration-150 ${
                activeJid === chat.jid ? 'bg-[#E5E5EA]' : 'bg-white hover:bg-[#F2F2F7]'
              }`}
            >
              {/* iOS Avatar (Pura left aligned, bina border ke) */}
              <div className="py-2.5 pl-4 pr-3 shrink-0">
                <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-gradient-to-tr from-[#94a3b8] to-[#cbd5e1] text-white flex items-center justify-center font-medium shadow-sm text-[20px]">
                  {chat.profilePicUrl ? (
                    <img src={chat.profilePicUrl} alt="DP" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
              </div>

              {/* Chat Content (iOS Partial Border Bottom) */}
              <div className="flex-1 min-w-0 pr-4 py-3 border-b border-[#C6C6C8]/60 h-full flex flex-col justify-center">
                
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-black text-[17px] truncate tracking-tight">
                    {displayName}
                  </span>
                  <span className={`text-[15px] shrink-0 ml-2 ${isUnread ? 'text-[#007AFF] font-medium' : 'text-[#8E8E93]'}`}>
                    {formatTime(chat.lastMessageAt)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mt-0.5">
                  <p className="text-[15px] text-[#8E8E93] truncate w-[85%] leading-snug">
                    {/* Prefix with Media icon if last message was media */}
                    {chat.lastMessage === '[image]' && '📷 Photo'}
                    {chat.lastMessage === '[video]' && '🎥 Video'}
                    {chat.lastMessage === '[audio]' && '🎵 Audio'}
                    {!['[image]', '[video]', '[audio]'].includes(chat.lastMessage) && chat.lastMessage}
                  </p>
                  
                  {isUnread && (
                    <span className="bg-[#007AFF] text-white text-[12px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shrink-0 shadow-sm">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>

              </div>
            </button>
          );
        })}

        {!chats.length && !loading && (
          <div className="flex flex-col items-center justify-center h-40 text-[#8E8E93]">
            <p className="text-[17px]">No chats yet</p>
          </div>
        )}
        
        {loading && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#007AFF]"></div>
          </div>
        )}
      </div>
    </div>
  );
}
