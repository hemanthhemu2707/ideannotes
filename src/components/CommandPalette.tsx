"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, FileText, CornerDownLeft, Sparkles, Hash } from 'lucide-react';
import { Note } from '@/lib/notes';
import { emojiSearchMatch } from '@/lib/emojiSearch';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Toggle command palette on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // wait, handled by parent
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch all notes when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setLoading(true);
      
      // Focus input on load
      setTimeout(() => inputRef.current?.focus(), 100);

      fetch('/api/notes')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setNotes(data.notes);
            setFilteredNotes(data.notes.slice(0, 5)); // show recent 5 initially
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching notes index:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  // Filter notes on query change
  useEffect(() => {
    if (!query) {
      setFilteredNotes(notes.slice(0, 5));
      setSelectedIndex(0);
      return;
    }

    const filtered = notes.filter((note) => {
      const titleMatch = emojiSearchMatch(note.metadata.title, query);
      const categoryMatch = emojiSearchMatch(note.metadata.category, query);
      const tagMatch = note.metadata.tags.some((tag) => emojiSearchMatch(tag, query));
      const contentMatch = emojiSearchMatch(note.content, query);
      
      return titleMatch || categoryMatch || tagMatch || contentMatch;
    });

    setFilteredNotes(filtered);
    setSelectedIndex(0);
  }, [query, notes]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredNotes.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredNotes.length) % Math.max(1, filteredNotes.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredNotes[selectedIndex]) {
          handleSelectNote(filteredNotes[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (resultsRef.current && filteredNotes.length > 0) {
      const activeEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredNotes]);

  const handleSelectNote = (note: Note) => {
    onClose();
    router.push(`/read/${note.categoryFolder}/${note.slug}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          {/* Overlay Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Palette container */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl glass-panel shadow-2xl border border-slate-700/50 flex flex-col max-h-[60vh]"
          >
            {/* Search Input Box */}
            <div className="flex items-center gap-3 px-4 border-b border-slate-800 py-3.5 bg-slate-900/40">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, tags, contents... (e.g. Transient, Index Seek, Server Component)"
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0"
              />
              <div className="text-[10px] font-semibold text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                ESC
              </div>
            </div>

            {/* Results Window */}
            <div className="flex-1 overflow-y-auto p-2" ref={resultsRef}>
              {loading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Indexing notes...</span>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No notes match your query. Try searching for something else.
                </div>
              ) : (
                filteredNotes.map((note, index) => (
                  <div
                    key={`${note.categoryFolder}-${note.slug}`}
                    onClick={() => handleSelectNote(note)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                      index === selectedIndex
                        ? 'bg-slate-800/80 border border-blue-500/20 text-slate-100'
                        : 'hover:bg-slate-800/40 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${
                        index === selectedIndex ? 'bg-blue-600/25 text-blue-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        {/* Title and Category */}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{note.metadata.title}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-800 rounded border border-slate-700/60 text-slate-400 shrink-0">
                            {note.metadata.category}
                          </span>
                        </div>
                        
                        {/* Content Snippet */}
                        <p className="text-xs text-slate-400 truncate mt-1">
                          {note.content.substring(0, 100).replace(/[#*`[\]()]/g, '')}
                        </p>

                        {/* Matching Tags */}
                        {note.metadata.tags.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {note.metadata.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] text-blue-400 flex items-center bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10">
                                <Hash className="w-2 h-2 mr-0.5" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Keyboard Nav Hint */}
                    {index === selectedIndex && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-900 border border-slate-700 px-2 py-1 rounded shrink-0">
                        <span className="text-xs">Open</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Quick Tips Footer */}
            <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="text-[10px] font-bold bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">↑↓</span> Move</span>
                <span className="flex items-center gap-1"><span className="text-[10px] font-bold bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">↵</span> Select</span>
                <span className="flex items-center gap-1"><span className="text-[10px] font-bold bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">ESC</span> Exit</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Quick revision</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
