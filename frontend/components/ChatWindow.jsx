'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function ChatWindow({ jid }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadOlder = useCallback(async () => {
    if (!jid || !hasMore) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;

    const res = await api.getMessages(jid, cursor);
    setMessages((prev) => [...res.messages, ...prev]);
    setCursor(res.nextCursor);
    setHasMore(res.hasMore);

    // preserve scroll position after prepending older messages
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }, [jid, cursor, hasMore]);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    if (!jid) return;

    (async () => {
      const res = await api.getMessages(jid);
      setMessages(res.messages);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
      await api.markRead(jid);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    })();
  }, [jid]);

  function onScroll(e) {
    if (e.target.scrollTop < 60) loadOlder();
  }

  async function handleSend() {
    if (!draft.trim() || !jid) return;
    setSending(true);
    const text = draft;
    setDraft('');
    try {
      await api.sendText(jid, text);
      setMessages((prev) => [
        ...prev,
        { id: `tmp_${Date.now()}`, direction: 'out', text, timestamp: Date.now() },
      ]);
      // Naya message bhejne ke baad automatically scroll down karna
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } finally {
      setSending(false);
    }
  }

  if (!jid) {
    return (
      <div className="flex-1 flex items-center justify-center text-wa-text-secondary bg-wa-bg">
        Select a chat to start messaging
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-wa-bg">
      <div className="px-4 py-3 bg-white border-b border-wa-divider flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-wa-green-dark text-white flex items-center justify-center text-sm">
          {jid.split('@')[0].slice(-2)}
        </div>
        <span className="font-medium">{jid.split('@')[0]}</span>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto thin-scroll px-4 py-3 space-y-1.5">
        {messages.map((m) => {
          // YAHAN HAI ASLI FIX: Baileys aur Firebase ke saare formats ko handle karna
          const msgText = m.text || m.body || m.content || m.message?.conversation || m.message?.extendedTextMessage?.text || (typeof m.message === 'string' ? m.message : null);
          
          // Timestamp ko format karne ka safe tarika (agar Firebase Timestamp object aa jaye toh crash na ho)
          const timeMs = m.timestamp?._seconds ? m.timestamp._seconds * 1000 : (typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : m.timestamp);
          
          return (
            <div key={m.id} className={`bubble ${m.direction === 'out' ? 'bubble-out' : 'bubble-in'}`}>
              {m.mediaUrl && m.mediaType?.includes('image') && (
                <img src={m.mediaUrl} alt="" className="rounded-lg mb-1 max-w-full" />
              )}
              {m.mediaUrl && m.mediaType?.includes('video') && (
                <video src={m.mediaUrl} controls className="rounded-lg mb-1 max-w-full" />
              )}
              {msgText && <span>{msgText}</span>}
              <span className="bubble-meta">
                {timeMs ? new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-white border-t border-wa-divider flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message"
          className="flex-1 border border-wa-divider rounded-full px-4 py-2 outline-none focus:border-wa-green"
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="w-10 h-10 rounded-full bg-wa-green text-white flex items-center justify-center disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
