import { useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

/**
 * SwipeToReply — wraps a message bubble. Swipe right (or drag on
 * desktop) past the threshold to trigger quote-reply, mirroring
 * WhatsApp's native gesture. Also supports long-press for the
 * same action (mobile-friendly fallback).
 */
export default function SwipeToReply({ message, onReply, children }) {
  const controls = useAnimation();
  const [dragging, setDragging] = useState(false);
  const threshold = 60; // px swipe distance required to trigger reply
  const longPressTimer = useRef(null);

  const handleDragEnd = async (_, info) => {
    setDragging(false);
    if (info.offset.x > threshold) {
      onReply(message);
    }
    await controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
  };

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => onReply(message), 500);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  return (
    <div className="relative select-none">
      {/* Reply icon revealed as the bubble is dragged */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-2 text-wa-accent opacity-70 pointer-events-none">
        ↩︎
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 80 }}
        dragElastic={0.15}
        animate={controls}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        className={`relative z-10 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
