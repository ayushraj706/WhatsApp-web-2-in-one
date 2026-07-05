'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const SLIDE_DURATION_MS = 5000;

export function StatusRail({ onOpen }) {
  const [posters, setPosters] = useState([]);

  useEffect(() => {
    api.getStatusPosters().then((res) => setPosters(res.posters)).catch(() => {});
  }, []);

  if (!posters.length) return null;

  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto border-b border-wa-divider bg-white">
      {posters.map((p) => (
        <button key={p.posterJid} onClick={() => onOpen(p.posterJid)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-14 h-14 rounded-full status-ring border-2 border-wa-green flex items-center justify-center text-sm font-medium bg-wa-green-dark text-white">
            {p.posterJid.split('@')[0].slice(-2)}
          </div>
          <span className="text-xs text-wa-text-secondary max-w-[60px] truncate">
            {p.posterJid.split('@')[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function StatusViewer({ posterJid, onClose }) {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!posterJid) return;
    api.getStatusItems(posterJid).then((res) => {
      setItems(res.items);
      setIndex(0);
    });
  }, [posterJid]);

  useEffect(() => {
    if (!items.length) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < items.length - 1) setIndex(index + 1);
      else onClose();
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, items, onClose]);

  if (!posterJid || !items.length) return null;
  const item = items[index];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex gap-1 px-3 pt-3">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < index ? '100%' : i === index ? '100%' : '0%', transition: i === index ? `width ${SLIDE_DURATION_MS}ms linear` : 'none' }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 text-white">
        <div className="w-8 h-8 rounded-full bg-wa-green-dark flex items-center justify-center text-xs">
          {posterJid.split('@')[0].slice(-2)}
        </div>
        <span className="text-sm">{posterJid.split('@')[0]}</span>
        <button onClick={onClose} className="ml-auto text-white/80 text-xl leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative" onClick={() => index < items.length - 1 && setIndex(index + 1)}>
        {item.mediaType?.includes('image') && <img src={item.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />}
        {item.mediaType?.includes('video') && (
          <video src={item.mediaUrl} autoPlay className="max-h-full max-w-full object-contain" />
        )}
        {!item.mediaUrl && item.text && (
          <p className="text-white text-2xl text-center px-8">{item.text}</p>
        )}
        <button
          className="absolute left-0 top-0 h-full w-1/3"
          onClick={(e) => {
            e.stopPropagation();
            if (index > 0) setIndex(index - 1);
          }}
        />
      </div>
    </div>
  );
}
