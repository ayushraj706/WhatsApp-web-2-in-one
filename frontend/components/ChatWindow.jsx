'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export default function ChatWindow({ jid }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  // Media Preview State
  const [previewMedia, setPreviewMedia] = useState(null);
  
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- SCROLLING LOGIC ---
  const scrollToBottom = (behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

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
    setDraft(''); 
    try {
      await api.sendText(jid, text);
      setMessages((prev) => [
        ...prev,
        { id: `tmp_${Date.now()}`, direction: 'out', text, timestamp: Date.now() },
      ]);
    } catch (error) {
      console.error("Message send failed:", error);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  // --- MEDIA ATTACHMENT LOGIC ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    alert(`File "${file.name}" selected! Backend API link pending.`);
  };

  const handleMediaClick = (url, type) => {
    setPreviewMedia({ url, type });
  };

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

  const hasText = draft.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2] h-full overflow-hidden relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundRepeat: 'repeat' }}>
      
      {/* FULL SCREEN MEDIA PREVIEW OVERLAY */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-300">
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
            <span className="text-white font-medium">Media Preview</span>
            <button 
              onClick={() => setPreviewMedia(null)}
              className="text-white hover:bg-white/20 rounded-full p-2 transition"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="w-full h-full p-8 flex items-center justify-center">
            {previewMedia.type === 'image' ? (
              <img src={previewMedia.url} alt="Full screen preview" className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm" />
            ) : (
              <video src={previewMedia.url} controls autoPlay className="max-w-full max-h-full drop-shadow-2xl rounded-sm" />
            )}
          </div>
        </div>
      )}

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
      >
        {messages.map((m) => {
          let msgText = m.text || m.body || m.content || m.message?.conversation || m.message?.extendedTextMessage?.text;
          if (!msgText && typeof m.message === 'string') msgText = m.message;
          
          const timeMs = m.timestamp?._seconds ? m.timestamp._seconds * 1000 : (typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : m.timestamp);
          
          const isEmpty = !msgText && !m.mediaUrl;
          if (isEmpty) return null; 

          const isOut = m.direction === 'out';
          const isImage = m.mediaType?.includes('image');
          const isVideo = m.mediaType?.includes('video');
          const isAudio = m.mediaType?.includes('audio');

          return (
            <div key={m.id} className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-2 text-[15px] shadow-[0_1px_1px_rgba(0,0,0,0.1)] relative flex flex-col ${
                  isOut ? 'bg-[#D9FDD3] rounded-tr-sm' : 'bg-white rounded-tl-sm'
                }`}
              >
                {/* Media Render (Clickable for preview) */}
                {(isImage || isVideo) && (
                  <div 
                    className="relative cursor-pointer mb-2 overflow-hidden rounded-lg group"
                    onClick={() => handleMediaClick(m.mediaUrl, isImage ? 'image' : 'video')}
                  >
                    {isImage && (
                      <img src={m.mediaUrl} alt="media" className="w-full max-h-[250px] object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                    )}
                    {isVideo && (
                      <div className="relative">
                         <video src={m.mediaUrl} className="w-full max-h-[250px] object-cover" />
                         <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                           <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center backdrop-blur-sm">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-gray-800 ml-1">
                               <path d="M5 3l14 9-14 9V3z" />
                             </svg>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                )}
                {isAudio && (
                  <audio src={m.mediaUrl} controls className="mb-2 w-[240px] h-[40px] outline-none" />
                )}
                
                {/* Text Render */}
                {msgText && <span className="text-gray-800 break-words leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{msgText}</span>}
                
                {/* Timestamp */}
                <div className={`text-[11px] text-gray-500 flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                  {timeMs ? new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  {isOut && (
                    <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor" className="text-[#53bdeb]">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* iOS STYLE SMART INPUT AREA */}
      <div className="px-3 py-2 bg-[#F6F6F6] border-t border-gray-300 flex items-end gap-3 pb-safe z-10">
        
        {/* iOS + Attachment Button */}
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        <button 
          onClick={() => fileInputRef.current.click()}
          className="mb-[7px] text-[#007AFF] hover:bg-gray-200 rounded-full p-1 transition duration-200 flex-shrink-0"
          title="Attach Media"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        {/* Text Input (Rounded Pill shape) */}
        <div className="flex-1 bg-white border border-[#D1D1D6] rounded-3xl flex items-end min-h-[36px] mb-[3px] shadow-sm overflow-hidden">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message"
            className="w-full max-h-[120px] min-h-[36px] bg-transparent border-none px-4 py-2 outline-none resize-none overflow-y-auto thin-scroll text-[16px] leading-tight"
            rows="1"
          />
          
          {/* Document icon inside input (iOS style) - visible only if empty */}
          {!hasText && (
             <button className="p-2 mr-1 text-gray-400 hover:text-gray-600 transition" onClick={() => fileInputRef.current.click()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
             </button>
          )}
        </div>
        
        {/* Smart Right Button (Send if text exists, Camera/Mic if empty) */}
        <div className="mb-[5px] flex-shrink-0 flex items-center gap-2">
          {sending ? (
             <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
             </div>
          ) : hasText ? (
            <button
              onClick={handleSend}
              className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center hover:bg-blue-600 transition transform active:scale-95 shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="ml-0.5 mt-0.5">
                <path d="M3 20V14L11 12L3 10V4L22 12L3 20Z"></path>
              </svg>
            </button>
          ) : (
            <>
              <button className="text-[#007AFF] p-1.5 hover:bg-gray-200 rounded-full transition" title="Camera">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </button>
              <button className="text-[#007AFF] p-1.5 hover:bg-gray-200 rounded-full transition" title="Microphone">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                   <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                   <line x1="12" y1="19" x2="12" y2="23"></line>
                   <line x1="8" y1="23" x2="16" y2="23"></line>
                 </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
