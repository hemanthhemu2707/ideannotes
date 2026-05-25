"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const PICKER_EMOJIS = [
  '🚀', '💾', '⚡', '⚛️', '🛡️', '🌐', '🧩', '🕸️', '💻', '📚', 
  '🔧', '🛠️', '🔥', '📦', '🧠', '🧪', '⏱️', '📊', '📝', '🎨', 
  '🔒', '🔓', '⚙️', '📌', '💡', '📁', '📂', '🔍', '🏷️', '🌟', 
  '🎉', '🐛', '🚨', '❓', '💬', '🏆', '💎', '📈', '✨'
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  className?: string;
}

export default function EmojiPicker({ onSelectEmoji, className = '' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Insert Emoji"
        className="p-2 rounded-xl text-text-muted hover:text-text-primary bg-surface-app border border-border-app/60 hover:border-accent-app/40 transition-all cursor-pointer flex items-center justify-center shrink-0 hover:scale-105"
      >
        <Smile className="w-4 h-4 text-text-muted hover:text-accent-app" />
      </button>

      {isOpen && (
        <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 z-50 p-3 rounded-2xl glass-panel border border-slate-700/60 shadow-2xl w-56 bg-slate-900/90 backdrop-blur-md">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 border-b border-border-app/30 pb-1.5 select-none">
            Pick Developer Emoji
          </div>
          <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {PICKER_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  setIsOpen(false);
                }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
