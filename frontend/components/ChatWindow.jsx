'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// SMART HELPER: 12-digit number ko clean +91 format me badalne ke liye
function formatPhoneNumber(num) {
  if (!num) return '';
  if (num.startsWith('91') && num.length === 12) {
    return `+91 ${num.slice(2, 7)} ${num.slice(7)}`;
  }
  return '+' + num;
}

// iOS style quick-pick emoji strip (koi heavy library nahi, halka aur fast)
const QUICK_EMOJIS = ['😀','😂','😍','👍','🙏','❤️','😢','😮','🔥','🎉','😅','🤔','👏','😎','🥳','😴'];

// NAYA PROP: onBack add kiya gaya hai taaki back button sach me kaam kare
export default function ChatWindow({ jid, onBack }) {
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  // Media Preview State
  const [previewMedia, setPreviewMedia] = useState(null);

  // Emoji Picker State (iOS jaisa in-input emoji icon)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Emoji picker ko bahar click karne par band karo
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClickOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  function insertEmoji(emoji) {
    setDraft((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

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

  // 🔥 LIVE SYNC MAGIC: Har 3 second me naye messages check karega
  useEffect(() => {
    if (!jid) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.getMessages(jid);
        if (res.messages) {
          setMessages(prev => {
            const currentIds = new Set(prev.map(m => m.id));
            const newMsgs = res.messages.filter(m => !currentIds.has(m.id));
            if (newMsgs.length > 0) {
               setTimeout(() => scrollToBottom("smooth"), 100);
               return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(pollingRef.current);
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
      const sentAt = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: `tmp_${sentAt}`, direction: 'out', text, timestamp: sentAt },
      ]);
      // ⚡ Isse ChatList ko turant pata chal jaata hai ki ye chat abhi
      // active hui hai, aur wo 3s poll ka wait kiye bina hi ise top par
      // le jaata hai.
      window.dispatchEvent(new CustomEvent('basekey:chat-activity', {
        detail: { jid, lastMessage: text, lastMessageAt: sentAt },
      }));
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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F2F2F7] text-gray-500">
        <svg viewBox="0 0 100 100" width="100" height="100" className="mb-4 text-[#C6C6C8]">
           <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3"/>
           <path d="M50 30 v40 M30 50 h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <p className="text-[17px] font-medium text-[#8E8E93]">BaseKey Web CRM</p>
      </div>
    );
  }

  const hasText = draft.trim().length > 0;

  // DYNAMIC NAME & DETAILS EXTRACTION
  const incomingMsgWithName = messages.find(m => m.direction === 'in' && m.pushName && m.pushName !== 'User');
  const rawNumber = jid.split('@')[0];
  const formattedNumber = formatPhoneNumber(rawNumber);
  
  // Agar asli naam mila toh wo dikhayenge, nahi toh number
  const hasRealName = !!incomingMsgWithName;
  const displayName = hasRealName ? incomingMsgWithName.pushName : formattedNumber;
  // Subtitle me additional details
  const subTitleInfo = hasRealName ? `${formattedNumber} • Online (Bot)` : 'Online (Bot Active)';
  
  const initials = displayName.startsWith('+') ? displayName.slice(-2) : displayName.substring(0, 2).toUpperCase();

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2] h-full overflow-hidden relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain', backgroundRepeat: 'repeat' }}>
      
      {/* FULL SCREEN MEDIA PREVIEW OVERLAY */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center backdrop-blur-md transition-opacity duration-300">
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

      {/* iOS STYLE HEADER */}
      <div className="px-3 py-2.5 bg-[#F6F6F6]/95 backdrop-blur-md border-b border-[#C6C6C8]/60 flex items-center justify-between z-10 sticky top-0 shadow-sm cursor-pointer">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* iOS Back Button (Ab sach me kaam karega) */}
          <button 
            onClick={onBack} 
            className="text-[#007AFF] flex items-center gap-1 -ml-1 pr-1 hover:opacity-70 transition-opacity"
            title="Go Back"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-gradient-to-tr from-[#94a3b8] to-[#cbd5e1] text-white flex items-center justify-center font-medium shrink-0 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
              {initials}
            </div>
          </button>
          
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-semibold text-black text-[16px] truncate tracking-tight">{displayName}</span>
            <span className="text-[12px] text-[#8E8E93] truncate">{subTitleInfo}</span>
          </div>
        </div>
      </div>

      {/* CHAT MESSAGES AREA */}
      <div 
        ref={scrollContainerRef} 
        onScroll={onScroll} 
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2 flex flex-col relative"
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
                className={`max-w-[80%] md:max-w-[65%] rounded-[18px] px-3.5 py-2 text-[16px] leading-[22px] shadow-sm relative flex flex-col ${
                  isOut ? 'bg-[#DCF7C5] rounded-br-[4px]' : 'bg-white rounded-bl-[4px] border border-[#E5E5EA]'
                }`}
              >
                {/* Media Render */}
                {(isImage || isVideo) && (
                  <div 
                    className="relative cursor-pointer mb-1.5 mt-0.5 overflow-hidden rounded-[14px] group"
                    onClick={() => handleMediaClick(m.mediaUrl, isImage ? 'image' : 'video')}
                  >
                    {isImage && (
                      <img src={m.mediaUrl} alt="media" className="w-full max-h-[280px] object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                    )}
                    {isVideo && (
                      <div className="relative">
                         <video src={m.mediaUrl} className="w-full max-h-[280px] object-cover" />
                         <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-[14px]">
                           <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center backdrop-blur-sm shadow-md">
                             <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-gray-900 ml-1">
                               <path d="M5 3l14 9-14 9V3z" />
                             </svg>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                )}
                {isAudio && (
                  <audio src={m.mediaUrl} controls className="mb-2 w-[220px] h-[36px] outline-none" />
                )}
                
                {/* Text Render */}
                {msgText && <span className="text-black break-words" style={{ whiteSpace: 'pre-wrap' }}>{msgText}</span>}
                
                {/* Timestamp & Read Receipt */}
                <div className={`text-[11px] text-[#8E8E93] flex items-center gap-1 mt-0.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
                  {timeMs ? new Date(timeMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                  {isOut && (
                    <svg viewBox="0 0 16 15" width="15" height="14" fill="currentColor" className="text-[#34B7F1] ml-0.5">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* iOS STYLE SMART INPUT AREA */}
      <div className="px-3 py-2 bg-[#F6F6F6] border-t border-[#C6C6C8]/60 flex items-end gap-2.5 pb-safe z-10 backdrop-blur-md">
        
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        
        {/* iOS + Attachment Button */}
        <button 
          onClick={() => fileInputRef.current.click()}
          className="mb-[5px] text-[#007AFF] hover:opacity-70 transition-opacity flex-shrink-0"
          title="Attach Media"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        {/* Text Input */}
        <div className="relative flex-1">
          <div className="bg-white border border-[#D1D1D6] rounded-[20px] flex items-end min-h-[38px] mb-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            {/* iOS Emoji Icon — attachment icon ki jagah, hamesha visible (jaisa iOS WhatsApp me hota hai) */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="p-2 pl-2.5 mb-[1px] text-[#8E8E93] hover:text-gray-600 transition flex-shrink-0"
              title="Emoji"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message"
              className="w-full max-h-[120px] min-h-[38px] bg-transparent border-none pl-1 pr-3 py-2 outline-none resize-none overflow-y-auto thin-scroll text-[16px] leading-[20px] placeholder-[#8E8E93]"
              rows="1"
            />
          </div>

          {/* Quick emoji popover */}
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-[46px] left-0 bg-white/95 backdrop-blur-md border border-[#E5E5EA] rounded-2xl shadow-lg p-2 grid grid-cols-8 gap-1 w-[280px] z-20"
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="text-[20px] leading-none p-1 rounded-lg hover:bg-[#F2F2F7] transition active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Smart Right Button */}
        <div className="mb-[4px] flex-shrink-0 flex items-center gap-3">
          {sending ? (
             <div className="w-8 h-8 flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-[#007AFF]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
             </div>
          ) : hasText ? (
            <button
              onClick={handleSend}
              className="w-[34px] h-[34px] rounded-full bg-[#007AFF] text-white flex items-center justify-center hover:bg-blue-600 transition transform active:scale-95 shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="ml-[2px] mt-[1px]">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            </button>
          ) : (
            <>
              <button className="text-[#007AFF] pb-[2px] hover:opacity-70 transition" title="Camera">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </button>
              <button className="text-[#007AFF] pb-[2px] pr-1 hover:opacity-70 transition" title="Microphone">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
