'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, ChevronDown, Folder, FolderOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from '@/lib/notes';

interface CategoryComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
}

export default function CategoryComboBox({ value, onChange, categories }: CategoryComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute full paths for each category based on parent-child relations
  const categoryPaths = React.useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach(cat => {
      map[cat.slug] = cat;
    });

    const getFullPath = (cat: Category): string => {
      if (cat.parentSlug && map[cat.parentSlug]) {
        return `${getFullPath(map[cat.parentSlug])} / ${cat.name}`;
      }
      return cat.name;
    };

    return categories.map(cat => ({
      ...cat,
      fullPath: getFullPath(cat)
    })).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [categories]);

  // Filter paths based on search term
  const filteredPaths = React.useMemo(() => {
    if (!search.trim()) return categoryPaths;
    const query = search.toLowerCase();
    return categoryPaths.filter(item => 
      item.fullPath.toLowerCase().includes(query) || 
      item.name.toLowerCase().includes(query)
    );
  }, [categoryPaths, search]);

  const handleSelect = (path: string) => {
    onChange(path);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateNew = () => {
    if (!search.trim()) return;
    onChange(search.trim());
    setIsOpen(false);
    setSearch('');
  };

  const isExactMatch = categoryPaths.some(
    item => item.fullPath.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className="relative w-full select-none">
      {/* Input Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface-app border border-border-app rounded-xl p-3 flex items-center justify-between text-xs font-semibold text-text-primary cursor-pointer hover:border-accent-app/50 transition-colors"
      >
        <span className={value ? 'text-text-primary' : 'text-text-muted/40 font-medium'}>
          {value || 'Select a subject directory... (e.g. Backend / C# / Exception Handling)'}
        </span>
        <div className="flex items-center gap-1.5 text-text-muted/65">
          {value && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded hover:bg-white/10 hover:text-text-primary shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
        </div>
      </div>

      {/* Autocomplete Dropdown List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 w-full rounded-xl glass-panel border border-border-app shadow-2xl p-2.5 overflow-hidden flex flex-col bg-surface-app max-h-80"
          >
            {/* Search Input Filter bar */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-black/25 rounded-lg border border-border-app/40 shrink-0 mb-2">
              <Search className="w-4 h-4 text-text-muted/50 shrink-0" />
              <input
                type="text"
                placeholder="Search directories or define new path..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 p-0"
                autoFocus
              />
            </div>

            {/* List options */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
              {filteredPaths.length === 0 && (
                <div className="text-center py-6 text-xs text-text-muted/55">
                  No directory structures found matching your search.
                </div>
              )}

              {filteredPaths.map((item) => {
                const isSelected = value.toLowerCase() === item.fullPath.toLowerCase() || value.toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={item.slug}
                    onClick={() => handleSelect(item.fullPath)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-accent-app/10 border-accent-app/20 text-accent-app'
                        : 'text-text-muted hover:text-text-primary hover:bg-white/4 border-transparent hover:border-border-app/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.parentSlug ? (
                        <Folder className="w-3.5 h-3.5 text-text-muted/50 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-accent-app/70 shrink-0" />
                      )}
                      <span className="truncate">{item.fullPath}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent-app shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Create Directory Action */}
            {search.trim() && !isExactMatch && (
              <div className="border-t border-border-app/40 pt-2 mt-2 shrink-0">
                <button
                  onClick={handleCreateNew}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold text-accent-app hover:bg-accent-app/10 transition-colors border border-dashed border-accent-app/30"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="truncate">Create new subject directory: "{search.trim()}"</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
