'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// SMART HELPER: Naam ya Number nikalne ke liye
function getDisplayName(chat) {
  if (chat.pushName && chat.pushName !== 'User') {
    return chat.pushName;
  }
  // Agar naam nahi hai toh clean phone number return karo
  return '+' + chat.jid.split('@')[0];
}

// SMART HELPER: Avatar ke initials nikalne ke liye
function getInitials(displayName) {
  if (displayName.startsWith('+')) {
    // Agar number hai, toh last ke 2 digit dikhao
    return displayName.slice(-2);
  }
  // Agar naam hai, toh pehle 2 letters (e.g., "Ayush" -> "AY", "Rahul Kumar" -> "RK")
  const parts = displayName.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        // Duplicate chats hatane ke liye filter (Safe UX)
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
    <div className="h-full flex flex-col border-r border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <h2 className="text-lg font-bold text-gray-800">Chats</h2>
      </div>

      {/* Chat Items */}
      <div className="flex-1 overflow-y-auto thin-scroll" onScroll={onScroll}>
        {chats.map((chat) => {
          const displayName = getDisplayName(chat);
          const initials = getInitials(displayName);
          
          return (
            <button
              key={chat.jid}
              onClick={() => onSelectChat(chat.jid)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors duration-150 ${
                activeJid === chat.jid ? 'bg-teal-50/50' : ''
              }`}
            >
              {/* Avatar with DP logic */}
              <div className="w-12 h-12 rounded-full overflow-hidden bg-teal-600 text-white flex items-center justify-center font-medium shrink-0 shadow-sm text-lg">
                {chat.profilePicUrl ? (
                  <img src={chat.profilePicUrl} alt="DP" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* Chat Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-semibold text-gray-900 truncate text-[16px]">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-gray-500 shrink-0 ml-2">
                    {formatTime(chat.lastMessageAt)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[13px] text-gray-500 truncate w-[85%]">
                    {chat.lastMessage || 'Sent a message'}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {!chats.length && !loading && (
          <p className="text-center text-gray-400 text-sm mt-8 italic">No chats yet</p>
        )}
        
        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
