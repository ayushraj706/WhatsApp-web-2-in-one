import { useSession, signIn } from "next-auth/react";

/**
 * Minimal shell — plug in Sidebar + ChatWindow (built out the same way
 * as MessageBubble/SwipeToReply) once you wire up your chat list state.
 */
export default function Home() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-wa-bg text-white">
        <h1 className="text-2xl font-semibold">WA SaaS Clone</h1>
        <button onClick={() => signIn("google")} className="rounded bg-wa-accent px-4 py-2">
          Continue with Google
        </button>
        <button onClick={() => signIn("github")} className="rounded bg-gray-700 px-4 py-2">
          Continue with GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-wa-bg text-white">
      {/* <Sidebar /> <ChatWindow /> go here, wired to lib/socket.js */}
      <p className="m-auto">Welcome, {session.user?.name} — chat UI mounts here.</p>
    </div>
  );
}
