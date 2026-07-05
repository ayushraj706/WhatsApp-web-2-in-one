'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function ChatWindow({ jid }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- SCROLLING LOGIC (EKDUM SMOOTH) ---
  const scrollToBottom = (behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Jab bhi naya message aaye, auto-scroll down karo
  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages]);

  const loadOlder = useCallback(async () => {
    if (!jid || !hasMore) return;
    const el = scrollContainerRef.current;
    const prevHeight = el?.scrollHeight || 0;

    try {
      const res = await api.getMessages(jid, cursor);
      setMessages((prev) => [...res.messages, ...prev]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);

      // Scroll position maintain rakho purane load hone par
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      console.error("Failed to load older messages", err);
    }
  }, [jid, cursor, hasMore]);

  // Initial Load
  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    if (!jid) return;

    (async () => {
      try {
        const res = await api.getMessages(jid);
        setMessages(res.messages || []);
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
        await api.markRead(jid);
        // Pehli baar load par turant neeche jao
        setTimeout(() => scrollToBottom("auto"), 100);
      } catch (err) {
        console.error("Load error:", err);
      }
    })();
  }, [jid]);

  function onScroll(e) {
    if (e.target.scrollTop < 100) loadOlder();
  }

  // --- SEND MESSAGE LOGIC ---
  async function handleSend() {
    if (!draft.trim() || !jid) return;
    setSending(true);
    const text = draft;
    setDraft(''); // Input turant khali karo UX ke liye
    try {
      await api.sendText(jid, text);
      setMessages((prev) => [
        ...prev,
        { id: `tmp_${Date.now()}`, direction: 'out', text, timestamp: Date.now() },
      ]);
    } catch (error) {
      console.error("Message send failed:", error);
      setDraft(text); // Fail hone par wapas text daal do
    } finally {
      setSending(false);
    }
  }

  // --- MEDIA ATTACHMENT LOGIC (UI Placeholder) ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    alert(`File "${file.name}" selected! Backend me media upload route lagane ke baad yeh bheja jayega.`);
    // Future update me yahan API call aayegi (Media send karne ke liye)
  };

  // --- RENDER FALLBACK ---
  if (!jid) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#EFEAE2] text-gray-500">
        <svg viewBox="0 0 100 100" width="150" height="150" className="mb-4 opacity-50">
           <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2"/>
           <path d="M50 30 v40 M30 50 h40" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <p className="text-lg font-medium">WhatsApp Business Web</p>
        <p className="text-sm mt-2">Kripya koi chat select karein...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2] h-full overflow-hidden relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundRepeat: 'repeat' }}>
      
      {/* HEADER */}
      <div className="px-4 py-3 bg-[#F0F2F5] border-b border-gray-300 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-lg font-semibold shadow">
            {jid.split('@')[0].slice(-2)}
          </div>
          <div>
            <span className="font-semibold text-gray-800 block text-lg">{jid.split('@')[0]}</span>
            <span className="text-xs text-green-600 block">Online (Bot Active)</span>
          </div>
        </div>
      </div>

      {/* CHAT MESSAGES AREA */}
      <div 
        ref={scrollContainerRef} 
        onScroll={onScroll} 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-2 flex flex-col relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.map((m) => {
          // Universal Message Parser
          let msgText = m.text || m.body || m.content || m.message?.conversation || m.message?.extendedTextMessage?.text;
          if (!msgText && typeof m.message === 'string') msgText = m.message;
          
          const timeMs = m.timestamp?._seconds ? m.timestamp._seconds * 1000 : (typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : m.timestamp);
          
          // Agar message ekdum khali hai (System message/Reaction)
          const isEmpty = !msgText && !m.mediaUrl;
          if (isEmpty) return null; // Khali dabbe ab gayab!

          const isOut = m.direction === 'out';

          return (
            <div key={m.id} className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] md:max-w-[65%] rounded-lg px-3 py-2 text-[15px] shadow-sm relative flex flex-col ${
                  isOut ? 'bg-[#D9FDD3] rounded-tr-none' : 'bg-white rounded-tl-none'
                }`}
              >
                {/* Media Render (Video/Image) */}
                {m.mediaUrl && m.mediaType?.includes('image') && (
                  <img src={m.mediaUrl} alt="media" className="rounded-md mb-2 max-h-[300px] object-cover cursor-pointer" loading="lazy" />
                )}
                {m.mediaUrl && m.mediaType?.includes('video') && (
                  <video src={m.mediaUrl} controls className="rounded-md mb-2 max-h-[300px] w-full" preload="metadata" />
                )}
                {m.mediaUrl && m.mediaType?.includes('audio') && (
                  <audio src={m.mediaUrl} controls className="mb-2" />
                )}
                
                {/* Text Render */}
                {msgText && <span className="text-gray-800 break-words" style={{ whiteSpace: 'pre-wrap' }}>{msgText}</span>}
                
                {/* Timestamp */}
                <div className={`text-[11px] text-gray-500 flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                  {timeMs ? new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  {isOut && (
                    <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor" className="text-blue-500">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Dummy div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA (Media Attachment + Text) */}
      <div className="px-4 py-3 bg-[#F0F2F5] flex items-end gap-2 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
        
        {/* Attachment Button */}
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        <button 
          onClick={() => fileInputRef.current.click()}
          className="p-3 text-gray-500 hover:bg-gray-200 rounded-full transition duration-200"
          title="Attach Media"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M21.583 8.246l-7.795-7.794A3.942 3.942 0 0 0 8.214.453L1.31 7.357a3.942 3.942 0 0 0 0 5.574l7.794 7.794a3.942 3.942 0 0 0 5.574 0l6.905-6.904a3.942 3.942 0 0 0 0-5.575zM12.981 2.21a2.128 2.128 0 0 1 3.01 0l7.794 7.794a2.128 2.128 0 0 1 0 3.01L16.88 19.92a2.128 2.128 0 0 1-3.01 0L6.076 12.126a2.128 2.128 0 0 1 0-3.01l6.905-6.906zM7.172 8.784a.907.907 0 1 1-1.282-1.282.907.907 0 0 1 1.282 1.282z"></path>
          </svg>
        </button>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message"
          className="flex-1 max-h-[120px] min-h-[45px] bg-white border-none rounded-xl px-4 py-3 outline-none resize-none overflow-y-auto thin-scroll shadow-sm text-[15px]"
          rows="1"
        />
        
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="p-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:bg-gray-400 transition shadow-sm mb-[2px]"
        >
          {sending ? (
            <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="ml-1">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
