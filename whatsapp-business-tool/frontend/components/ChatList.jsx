'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

function initialsFromJid(jid) {
  const num = jid.split('@')[0];
  return num.slice(-2);
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
      setChats((prev) => [...prev, ...res.chats]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 80) loadMore();
  }

  return (
    <div className="h-full flex flex-col border-r border-wa-divider bg-white">
      <div className="px-4 py-3 border-b border-wa-divider flex items-center justify-between">
        <h2 className="text-xl font-semibold">Chats</h2>
      </div>
      <div className="flex-1 overflow-y-auto thin-scroll" onScroll={onScroll}>
        {chats.map((chat) => (
          <button
            key={chat.jid}
            onClick={() => onSelectChat(chat.jid)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-wa-divider hover:bg-gray-50 ${
              activeJid === chat.jid ? 'bg-gray-100' : ''
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-wa-green-dark text-white flex items-center justify-center font-medium shrink-0">
              {initialsFromJid(chat.jid)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="font-medium truncate">{chat.jid.split('@')[0]}</span>
                <span className="text-xs text-wa-text-secondary shrink-0 ml-2">
                  {formatTime(chat.lastMessageAt)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-wa-text-secondary truncate">{chat.lastMessage}</p>
                {chat.unreadCount > 0 && (
                  <span className="ml-2 bg-wa-green text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
        {!chats.length && !loading && (
          <p className="text-center text-wa-text-secondary text-sm mt-8">No chats yet</p>
        )}
        {loading && <p className="text-center text-wa-text-secondary text-sm py-3">Loading…</p>}
      </div>
    </div>
  );
}
