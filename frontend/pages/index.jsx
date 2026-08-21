import { useSession, signIn } from "next-auth/react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";

export default function Home() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-wa-bg text-white">
        <h1 className="text-3xl font-bold tracking-wider">BaseKey</h1>
        <p className="text-gray-400 mb-4">Unlock your social media potential</p>
        
        <button 
          onClick={() => signIn("google")} 
          className="rounded bg-wa-accent px-6 py-2 font-medium hover:bg-green-600 transition"
        >
          Continue with Google
        </button>
        <button 
          onClick={() => signIn("github")} 
          className="rounded bg-gray-700 px-6 py-2 font-medium hover:bg-gray-600 transition"
        >
          Continue with GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-wa-bg text-white overflow-hidden">
      {/* Sidebar - Left Side (Chats List, AI Settings, etc.) */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-800 flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Chat Window - Right Side (Active Chat, Messaging) */}
      <div className="hidden md:flex flex-1 flex-col relative">
        <ChatWindow />
      </div>
    </div>
  );
}
