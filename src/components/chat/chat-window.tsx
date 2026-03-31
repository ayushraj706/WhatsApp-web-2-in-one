"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Send, Paperclip, ArrowLeft, MoreVertical, 
    Download, Check, CheckCheck, Zap, 
    ImageIcon, Video, Music, FileText, Sticker as StickerIcon 
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { getChatMessages, sendChatMessage, sendMediaMessage } from "@/app/dashboard/chat/actions";

interface Message {
    keyId: string;
    content: string;
    fromMe: boolean;
    timestamp: string;
    type: string;
    status: string; // 1: sent, 2: delivered, 3: read
    pushName?: string;
    mediaUrl?: string;
    remoteJid?: string;
}

interface ChatWindowProps {
    sessionId: string;
    jid: string;
    name?: string;
    onBack?: () => void;
    onInteractiveOpen?: () => void; // Interactive button handler
}

export function ChatWindow({ sessionId, jid, name, onBack, onInteractiveOpen }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadType, setUploadType] = useState<string>("image");

    const scrollToBottom = (smooth = true) => {
        scrollRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const data = await getChatMessages(sessionId, jid);
            setMessages((data as any) || []);
            setTimeout(() => scrollToBottom(false), 100);
        } catch (error) {
            console.error("Failed to load messages", error);
        }
    }

    useEffect(() => {
        fetchMessages();
        const newSocket = io({ path: "/api/socket/io", addTrailingSlash: false });
        newSocket.on("connect", () => newSocket.emit("join-session", sessionId));
        newSocket.on("message.update", (newMessages: Message[]) => {
            setMessages((prev) => {
                const combined = [...prev, ...newMessages.filter(m => m.remoteJid === jid)];
                const unique = Array.from(new Map(combined.map(m => [m.keyId, m])).values());
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });
        });
        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, [sessionId, jid]);

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        try {
            await sendChatMessage(sessionId, jid, newMessage);
            setNewMessage("");
            setTimeout(() => fetchMessages(), 800);
        } catch (e: any) {
            toast.error(e.message || "Failed to send message");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", uploadType);
        formData.append("sessionId", sessionId);
        formData.append("jid", jid);
        try {
            toast.info("Uploading to Cloudinary...");
            await sendMediaMessage(formData);
            toast.success("Sent!");
            setTimeout(() => fetchMessages(), 1000);
        } catch (error: any) {
            toast.error("Media upload failed");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const StatusIcon = ({ status }: { status: string }) => {
        const s = parseInt(status);
        if (s === 3) return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
        if (s === 2) return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
        return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    };

    const displayName = name || jid.split('@')[0];

    return (
        <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden">
            {/* --- Fixed Header --- */}
            <div className="h-16 px-4 border-b bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-full" onClick={onBack}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarFallback className="bg-primary text-white font-bold">
                            {displayName.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <h3 className="text-sm font-bold text-foreground truncate leading-tight">{displayName}</h3>
                        <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Online</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground"><Phone className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                </div>
            </div>

            {/* --- Messages Area (Scrollable) --- */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 styled-scrollbar" style={{
                backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
                backgroundRepeat: 'repeat',
                backgroundSize: '400px'
            }}>
                <div className="max-w-4xl mx-auto space-y-1">
                    {messages.map((msg, idx) => (
                        <div key={msg.keyId} className={cn("flex w-full mb-1", msg.fromMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "relative max-w-[85%] sm:max-w-[70%] px-2.5 py-1.5 rounded-lg shadow-md",
                                msg.fromMe 
                                    ? "bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none text-gray-800 dark:text-gray-100" 
                                    : "bg-white dark:bg-[#202c33] rounded-tl-none text-gray-800 dark:text-gray-100 border border-black/5"
                            )}>
                                {/* Media Handling */}
                                {msg.mediaUrl && (
                                    <div className="mb-1 rounded-md overflow-hidden bg-black/5">
                                        {msg.type === 'IMAGE' && <img src={msg.mediaUrl} className="max-h-72 w-full object-cover cursor-pointer hover:opacity-90" />}
                                        {msg.type === 'VIDEO' && <video src={msg.mediaUrl} controls className="max-h-72 w-full" />}
                                        {msg.type === 'AUDIO' && <audio src={msg.mediaUrl} controls className="w-full h-10 p-1" />}
                                    </div>
                                )}

                                <div className="flex flex-col">
                                    <span className="text-[13.5px] leading-relaxed pr-10">{msg.content}</span>
                                    <div className="flex items-center justify-end gap-1 -mt-1 self-end">
                                        <span className="text-[9px] opacity-60">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.fromMe && <StatusIcon status={msg.status} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* --- Fixed Input Area --- */}
            <div className="px-3 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t z-20 flex-shrink-0">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:bg-black/5">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2 mb-2 rounded-2xl" side="top" align="start">
                            <div className="grid grid-cols-1 gap-1">
                                <Button variant="ghost" className="justify-start gap-3 h-10" onClick={() => { setUploadType('image'); fileInputRef.current?.click(); }}>
                                    <ImageIcon className="h-4 w-4 text-blue-500" /> Photo
                                </Button>
                                <Button variant="ghost" className="justify-start gap-3 h-10" onClick={() => { setUploadType('video'); fileInputRef.current?.click(); }}>
                                    <Video className="h-4 w-4 text-purple-500" /> Video
                                </Button>
                                <Button variant="ghost" className="justify-start gap-3 h-10" onClick={() => { setUploadType('document'); fileInputRef.current?.click(); }}>
                                    <FileText className="h-4 w-4 text-emerald-500" /> Document
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="flex-1 relative">
                        <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                            className="h-10 rounded-full border-none bg-white dark:bg-[#2a3942] pl-4 pr-10 focus-visible:ring-0 shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-full text-primary hover:bg-primary/10"
                            onClick={onInteractiveOpen}
                        >
                            <Zap className="h-5 w-5 fill-current" />
                        </Button>
                        <Button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            size="icon"
                            className="h-10 w-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white shadow-md transition-transform active:scale-95"
                        >
                            <Send className="h-5 w-5 ml-0.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
