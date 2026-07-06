'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

// SMART HELPER: raw id (digits) ko clean +91 format me badalne ke liye.
// Kaam karta hai chahe id @s.whatsapp.net se aayi ho ya @lid se — dono
// cases me hum sirf suffix strip karke number ko format karte hain,
// koi bhi cheez hardcode nahi karte.
function formatPhoneNumber(rawId) {
  if (!rawId) return '';
  const digits = rawId.replace(/[^0-9]/g, '');
  if (!digits) return rawId; // agar digits hi nahi hain, jo mila wahi dikha do
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return '+' + digits;
}

// SMART HELPER: Naam ya Number nikalne ke liye
// Rule: hamesha pushName dikhao agar wo valid hai.
// Agar pushName missing/'.'/undefined hai, toh real formatted number par
// fallback karo (chahe jid @s.whatsapp.net ho ya @lid) — kabhi bhi
// "Official Business" jaisi hardcoded value nahi dikhani.
function getDisplayName(chat) {
  const pushName = chat.pushName?.trim();
  const isValidPushName = pushName && pushName !== 'User' && pushName !== '.' && pushName !== '';
  if (isValidPushName) {
    return pushName;
  }
  const rawId = chat.jid.split('@')[0];
  return formatPhoneNumber(rawId);
}

// SMART HELPER: Avatar ke initials nikalne ke liye
function getInitials(displayName) {
  if (!displayName) return '??';

  if (displayName.startsWith('+')) {
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
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// SAFE SORT: lastMessageAt kabhi kabhi Firestore Timestamp object ya string
// bhi ban sakta hai. Number() se coerce karke sort karo taaki NaN ki wajah
// se order kabhi na tootey.
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts._seconds) return ts._seconds * 1000;
  return Number(ts) || 0;
}
function sortByRecent(list) {
  return [...list].sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));
}

export default function ChatList({ activeJid, onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // SEARCH STATE
  const [searchQuery, setSearchQuery] = useState('');
  
  const pollingRef = useRef(null);

  // Load Chats (Infinite Scroll ke liye)
  const loadMore = useCallback(async (isInitial = false) => {
    if (loading || (!hasMore && !isInitial)) return;
    if (isInitial) setLoading(true);
    try {
      const res = await api.getChats(isInitial ? null : cursor);
      setChats((prev) => {
        const newChats = isInitial ? res.chats : [...prev, ...res.chats];
        // Merge with existing, keeping the LATEST version of the chat object (for DP updates)
        const chatMap = new Map();
        prev.forEach(c => chatMap.set(c.jid, c)); // purane daalo
        res.chats.forEach(c => chatMap.set(c.jid, c)); // naye wale override kar denge (with DP if fetched)
        
        return sortByRecent(Array.from(chatMap.values()));
      });
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  // Initial Load
  useEffect(() => {
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔥 LIVE SYNC MAGIC: Har 3 second me silent background check
  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.getChats(null); 
        if (res.chats) {
          setChats((prev) => {
            const chatMap = new Map();
            prev.forEach(c => chatMap.set(c.jid, c));
            // Hamesha naya object save karo taaki PushName ya DP update ho jaye
            res.chats.forEach(c => {
               if(!chatMap.has(c.jid) || toMillis(chatMap.get(c.jid).lastMessageAt) <= toMillis(c.lastMessageAt)){
                   chatMap.set(c.jid, c);
               }
            });
            return sortByRecent(Array.from(chatMap.values()));
          });
        }
      } catch (err) {}
    }, 3000); // 3 seconds for snappier updates
    return () => clearInterval(pollingRef.current);
  }, []);

  // ⚡ INSTANT REORDER: jab CRM se koi message bhejte ho, ChatWindow ye
  // event fire karta hai. Isse hume 3s poll ka wait nahi karna padta —
  // chat turant top par chali jaati hai.
  useEffect(() => {
    function onChatActivity(e) {
      const { jid, lastMessage, lastMessageAt } = e.detail || {};
      if (!jid) return;
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.jid === jid);
        if (idx === -1) return prev; // chat list me nahi hai toh kuch mat karo
        const updated = {
          ...prev[idx],
          lastMessage: lastMessage ?? prev[idx].lastMessage,
          lastMessageAt: lastMessageAt ?? Date.now(),
        };
        const rest = prev.filter((c) => c.jid !== jid);
        return sortByRecent([updated, ...rest]);
      });
    }
    window.addEventListener('basekey:chat-activity', onChatActivity);
    return () => window.removeEventListener('basekey:chat-activity', onChatActivity);
  }, []);

  function onScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore(false);
  }

  // SEARCH FILTER LOGIC
  const filteredChats = chats.filter((chat) => {
    if (!searchQuery) return true;
    const nameOrNumber = getDisplayName(chat).toLowerCase();
    const query = searchQuery.toLowerCase();
    return nameOrNumber.includes(query) || chat.jid.includes(query);
  });

  return (
    <div className="h-full flex flex-col bg-white border-r border-[#E5E5EA] w-full max-w-sm shrink-0">
      
      {/* iOS Style Header */}
      <div className="bg-[#F6F6F6] pb-2 border-b border-[#E5E5EA] z-10 sticky top-0">
        <div className="flex justify-center items-center px-4 pt-8 pb-1 relative">
          <h1 className="text-[32px] font-bold text-black tracking-tight leading-none w-full text-left">Chats</h1>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[17px] text-black placeholder-[#8E8E93]" 
            />
            {/* Clear search button (X) */}
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#8E8E93] ml-1 hover:text-gray-600 transition">
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Items List (Filtered) */}
      <div className="flex-1 overflow-y-auto thin-scroll bg-white" onScroll={onScroll}>
        {filteredChats.map((chat) => {
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
              {/* iOS Avatar */}
              <div className="py-2.5 pl-4 pr-3 shrink-0">
                <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-gradient-to-tr from-[#94a3b8] to-[#cbd5e1] text-white flex items-center justify-center font-medium shadow-sm text-[20px]">
                  {chat.profilePicUrl ? (
                    <img 
                       src={chat.profilePicUrl} 
                       alt="DP" 
                       className="w-full h-full object-cover" 
                       onError={(e) => { e.target.style.display = 'none'; }} // Fallback if image fails to load
                    />
                  ) : (
                    initials
                  )}
                </div>
              </div>

              {/* Chat Content */}
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

        {!filteredChats.length && !loading && (
          <div className="flex flex-col items-center justify-center h-40 text-[#8E8E93]">
            <p className="text-[17px]">{searchQuery ? 'No results found' : 'No chats yet'}</p>
          </div>
        )}
        
        {loading && !searchQuery && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#007AFF]"></div>
          </div>
        )}
      </div>
    </div>
  );
}
