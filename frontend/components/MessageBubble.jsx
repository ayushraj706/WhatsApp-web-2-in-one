import SwipeToReply from "./SwipeToReply";

/**
 * Renders a single chat bubble. If the sender revoked ("delete for
 * everyone") the message, we DO NOT hide it — we keep the original
 * content visible and attach a small 🚫 marker + caption, per the
 * Anti-Delete spec.
 */
export default function MessageBubble({ message, isOwn, onReply }) {
  const { content, timestamp, status, isDeletedBySender, type, mediaUrl } = message;

  return (
    <SwipeToReply message={message} onReply={onReply}>
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} px-3 py-1`}>
        <div
          className={`relative max-w-[75%] rounded-lg px-3 py-2 text-sm text-white shadow
            ${isOwn ? "bg-wa-bubbleOut" : "bg-wa-bubbleIn"}
            ${isDeletedBySender ? "border border-red-500/40" : ""}`}
        >
          {isDeletedBySender && (
            <div className="mb-1 flex items-center gap-1 text-[11px] text-red-400">
              <span>🚫</span>
              <span>Sender attempted to delete this message</span>
            </div>
          )}

          {type === "image" && mediaUrl && (
            <img src={mediaUrl} alt="attachment" className="mb-1 rounded-md max-h-64 object-cover" />
          )}

          <p className="whitespace-pre-wrap break-words">{content}</p>

          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-300">
            <span>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {isOwn && <ReadReceipt status={status} />}
          </div>
        </div>
      </div>
    </SwipeToReply>
  );
}

function ReadReceipt({ status }) {
  // WhatsApp-style ticks: single = sent, double gray = delivered, double blue = read
  if (status === "read") return <span className="text-blue-400">✓✓</span>;
  if (status === "delivered") return <span className="text-gray-400">✓✓</span>;
  return <span className="text-gray-400">✓</span>;
}
