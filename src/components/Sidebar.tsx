"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Folder,
  Search, 
  PlusCircle, 
  LayoutDashboard, 
  Settings, 
  Database, 
  Layers, 
  Shield, 
  Network, 
  Puzzle, 
  Webhook, 
  FileCode,
  FolderOpen,
  Lock,
  Unlock,
  LogOut,
  Palette,
  Calendar,
  Briefcase,
  FileText,
  X,
  MessageSquareCode,
  MessageSquare,
  Moon,
  Sun,
  Bell
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import LoginModal from './LoginModal';
import EmojiPicker from './EmojiPicker';
import { Category } from '@/lib/notes';
import { useTheme } from './ThemeContext';
import { useToast } from './Toast';

// Map categories to customized icons based on slug
const CATEGORY_ICONS: Record<string, any> = {
  'dotnet': FileCode,
  'dotnet-core': FileCode,
  'entity-framework': FileCode,
  'react': Layers,
  'angular': Layers,
  'javascript': Layers,
  'sql': Database,
  'design-patterns': Puzzle,
  'apis': Webhook,
  'security': Shield,
  'system-design': Network,
};

interface CategoryTreeNode {
  slug: string;
  name: string;
  icon: string;
  parentSlug?: string | null;
  children: CategoryTreeNode[];
}

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const map: Record<string, CategoryTreeNode> = {};
  const roots: CategoryTreeNode[] = [];

  categories.forEach(cat => {
    map[cat.slug] = { ...cat, children: [] };
  });

  categories.forEach(cat => {
    const node = map[cat.slug];
    if (cat.parentSlug && map[cat.parentSlug]) {
      map[cat.parentSlug].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CategoryTreeItem({ 
  node, 
  depth, 
  activeCategoryParam, 
  pathname, 
  categoryCounts, 
  isCollapsed,
  notes,
  isAdmin
}: { 
  node: CategoryTreeNode; 
  depth: number; 
  activeCategoryParam: string; 
  pathname: string; 
  categoryCounts: Record<string, number>; 
  isCollapsed: boolean;
  notes: any[];
  isAdmin: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isDragOver, setIsDragOver] = React.useState(false);
  
  // Hover & Subcategory Create Modal States
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isAddSubModalOpen, setIsAddSubModalOpen] = React.useState(false);
  const [subCatName, setSubCatName] = React.useState('');

  const childNotes = notes.filter(note => note.categoryFolder === node.slug);
  const hasChildren = node.children.length > 0;
  const hasNotes = childNotes.length > 0;
  const isExpandable = hasChildren || hasNotes;
  
  const hasActiveDescendant = (n: CategoryTreeNode): boolean => {
    if (n.slug === activeCategoryParam) return true;
    
    const isNoteActive = notes.some(note => 
      (note.categoryFolder === n.slug) && 
      (pathname === `/read/${note.categoryFolder}/${note.slug}` || pathname === `/modify/${note.categoryFolder}/${note.slug}`)
    );
    if (isNoteActive) return true;
    
    return n.children.some(child => hasActiveDescendant(child));
  };

  const [isExpanded, setIsExpanded] = React.useState(() => hasActiveDescendant(node));
  
  React.useEffect(() => {
    if (hasActiveDescendant(node)) {
      setIsExpanded(true);
    }
  }, [activeCategoryParam, pathname]);

  const isSelected = activeCategoryParam === node.slug;

  // HTML5 Drag and Drop event handlers
  const handleDragStart = (e: React.DragEvent, type: 'note' | 'category', slug: string) => {
    if (!isAdmin) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, slug }));
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsDragOver(true);
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent, targetCategorySlug: string) => {
    e.preventDefault();
    setIsDragOver(false);
    e.stopPropagation();
    if (!isAdmin) return;

    try {
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;
      
      const { type, slug } = JSON.parse(rawData);
      if (!type || !slug) return;
      
      // Prevent nesting category under itself
      if (type === 'category' && slug === targetCategorySlug) {
        toast.error('Cannot drag a category inside itself.');
        return;
      }

      toast.info(`Moving ${type}... 🚚`);
      
      const res = await fetch('/api/reorganize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draggedType: type,
          draggedSlug: slug,
          targetType: 'category',
          targetSlug: targetCategorySlug
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Item successfully reorganized!');
        // Refresh browser instantly to rebuild dynamic tree in place
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to re-organize notes structure.');
      }
    } catch (err: any) {
      toast.error('Re-nesting action failed: ' + err.message);
    }
  };

  const noteCount = categoryCounts[node.slug] || 0;
  const IconComponent = CATEGORY_ICONS[node.slug] || (node.parentSlug ? Folder : FolderOpen);

  if (isCollapsed) {
    return (
      <Link
        href={`/manage?category=${node.slug}`}
        title={`${node.name} (${noteCount} notes)`}
        className={`flex items-center justify-center p-2.5 rounded-xl transition-all border ${
          isSelected 
            ? 'bg-accent-app/5 border-accent-app/10 text-accent-app font-semibold' 
            : 'text-text-muted hover:text-text-primary hover:bg-white/4 border-transparent hover:border-border-app/50'
        }`}
      >
        <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent-app' : 'text-text-muted'}`} />
      </Link>
    );
  }

  return (
    <div className="space-y-1" onMouseLeave={() => { setIsHovered(false); setMenuOpen(false); }}>
      <div
        draggable={isAdmin}
        onDragStart={(e) => handleDragStart(e, 'category', node.slug)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, node.slug)}
        onMouseEnter={() => setIsHovered(true)}
        onClick={() => {
          if (isExpandable) {
            setIsExpanded(!isExpanded);
          }
        }}
        className={`flex items-center justify-between p-2 rounded-xl transition-all border text-xs font-semibold cursor-pointer ${
          isDragOver 
            ? 'bg-accent-app/15 border-dashed border-accent-app scale-[1.01]' 
            : isSelected 
              ? 'bg-accent-app/5 border-accent-app/10 text-accent-app font-bold' 
              : 'text-text-muted hover:text-text-primary hover:bg-white/4 border-transparent hover:border-border-app/50'
        } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExpandable ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 rounded hover:bg-white/10 text-text-muted/65 hover:text-text-primary shrink-0 transition-colors cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-4.5" />
          )}
          
          <Link href={`/manage?category=${node.slug}`} className="flex items-center gap-2 min-w-0 flex-1">
            <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent-app' : 'text-text-muted'}`} />
            <span className="truncate leading-none pt-0.5">{node.name}</span>
          </Link>
        </div>

        {/* Hover Plus Button / Note count */}
        <div className="flex items-center gap-1.5 shrink-0 select-none">
          {isHovered && isAdmin ? (
            <div className="relative shrink-0 flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 rounded-md bg-white/5 hover:bg-accent-app/20 text-text-muted hover:text-accent-app transition-all cursor-pointer shrink-0"
                title="Add Note or Subcategory"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
              
              {/* Floating Menu Popover */}
              {menuOpen && (
                <div className="absolute right-0 top-6.5 z-40 p-1.5 rounded-xl border border-slate-700/50 bg-slate-900 shadow-2xl w-36 select-none text-[10px] font-bold space-y-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      router.push(`/add?category=${node.slug}`);
                    }}
                    className="flex items-center gap-1.5 w-full p-1.5 rounded-lg hover:bg-white/5 text-left text-text-primary transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>Add Note</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setIsAddSubModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 w-full p-1.5 rounded-lg hover:bg-white/5 text-left text-text-primary transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Add Subfolder</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            noteCount > 0 && (
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border shrink-0 leading-none ${
                isSelected 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app' 
                  : 'bg-black/20 border-border-app/40 text-text-primary'
              }`}>
                {noteCount}
              </span>
            )
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-1">
          {/* 1. Render Child Categories */}
          {hasChildren && node.children.map(child => (
            <CategoryTreeItem
              key={child.slug}
              node={child}
              depth={depth + 1}
              activeCategoryParam={activeCategoryParam}
              pathname={pathname}
              categoryCounts={categoryCounts}
              isCollapsed={isCollapsed}
              notes={notes}
              isAdmin={isAdmin}
            />
          ))}
          
          {/* 2. Render Child Notes directly in the tree under their category */}
          {hasNotes && childNotes.map(n => {
            const isNoteSelected = pathname === `/read/${n.categoryFolder}/${n.slug}` || pathname === `/modify/${n.categoryFolder}/${n.slug}`;
            return (
              <Link
                key={n.slug}
                href={`/read/${n.categoryFolder}/${n.slug}`}
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, 'note', n.slug)}
                style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isAdmin) return;
                  e.currentTarget.classList.add('bg-accent-app/15', 'border-dashed', 'border-accent-app');
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  e.currentTarget.classList.remove('bg-accent-app/15', 'border-dashed', 'border-accent-app');
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove('bg-accent-app/15', 'border-dashed', 'border-accent-app');
                  if (!isAdmin) return;
                  
                  try {
                    const rawData = e.dataTransfer.getData('text/plain');
                    if (!rawData) return;
                    const { type, slug } = JSON.parse(rawData);
                    if (!type || !slug) return;
                    
                    if (type === 'category') {
                      toast.error('Categories cannot be placed inside notes.');
                      return;
                    }
                    
                    if (slug === n.slug) return; // dropped on itself
                    
                    toast.info('Reordering notes... 🚚');
                    const res = await fetch('/api/reorganize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        draggedType: 'note',
                        draggedSlug: slug,
                        targetType: 'note',
                        targetSlug: n.slug
                      })
                    });
                    
                    const data = await res.json();
                    if (data.success) {
                      toast.success(data.message || 'Notes reordered successfully!');
                      window.location.reload();
                    } else {
                      toast.error(data.error || 'Failed to reorder notes.');
                    }
                  } catch (err: any) {
                    toast.error('Reordering failed: ' + err.message);
                  }
                }}
                className={`flex items-center gap-2 py-1.5 pr-2.5 rounded-xl border text-[11px] font-medium transition-all ${
                  isNoteSelected
                    ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-bold'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/4 border-transparent hover:border-border-app/40'
                } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isNoteSelected ? 'text-accent-app' : 'text-text-muted/65'}`} />
                <span className="truncate leading-none pt-0.5">{n.metadata.title}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Inline Subfolder Addition Modal Overlay */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm bg-surface-app border border-slate-700/50 rounded-2xl p-5 space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-border-app/30 pb-2.5 select-none">
              <h3 className="font-extrabold text-xs text-text-primary flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-accent-app" />
                <span>New Subfolder under "{node.name}"</span>
              </h3>
              <button
                onClick={() => setIsAddSubModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block select-none">Folder Name</label>
                <div className="flex items-center gap-2.5">
                  <EmojiPicker onSelectEmoji={(emoji) => setSubCatName(prev => `${emoji} ${prev}`)} />
                  <input
                    type="text"
                    value={subCatName}
                    onChange={(e) => setSubCatName(e.target.value)}
                    placeholder="e.g. Memory Management, Basics"
                    className="bg-black/35 border border-border-app rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none w-full font-medium"
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && subCatName.trim()) {
                        e.preventDefault();
                        e.stopPropagation();
                        // trigger creation
                        try {
                          const res = await fetch('/api/categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: subCatName.trim(),
                              parentSlug: node.slug
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            toast.success('Subcategory successfully created!');
                            setIsAddSubModalOpen(false);
                            setSubCatName('');
                            window.location.reload();
                          } else {
                            toast.error(data.error || 'Failed to create subcategory.');
                          }
                        } catch (e) {
                          toast.error('An error occurred.');
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3.5 pt-2 select-none">
              <button
                onClick={() => setIsAddSubModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-705 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!subCatName.trim()) return;
                  try {
                    const res = await fetch('/api/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: subCatName.trim(),
                        parentSlug: node.slug
                      })
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success('Subcategory successfully created!');
                      setIsAddSubModalOpen(false);
                      setSubCatName('');
                      window.location.reload();
                    } else {
                      toast.error(data.error || 'Failed to create subcategory.');
                    }
                  } catch (e) {
                    toast.error('An error occurred.');
                  }
                }}
                disabled={!subCatName.trim()}
                className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  categories: Category[];
  notes: any[];
  categoryCounts: Record<string, number>;
  currentUser: { username: string; role: string } | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<{ username: string; role: string } | null>>;
  unreadCount: number;
  unreadGroups: any[];
  bellDropdownOpen: boolean;
  setBellDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({
  categories,
  notes,
  categoryCounts,
  currentUser,
  setCurrentUser,
  unreadCount,
  unreadGroups,
  bellDropdownOpen,
  setBellDropdownOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, setTheme, themes } = useTheme();
  const toast = useToast();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Toggle collapse state
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(null);
        router.push('/');
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWriteClick = (e: React.MouseEvent) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      e.preventDefault();
      setIsLoginOpen(true);
    }
  };

  // Active Category helper from query
  const activeCategoryParam = searchParams.get('category') || '';
  const isAdmin = currentUser?.role === 'Admin';

  return (
    <>
      <motion.aside
        animate={{ width: isCollapsed ? 68 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex h-screen bg-surface-app border-r border-border-app flex-col relative flex-shrink-0 z-30 select-none shadow-xl shadow-slate-950/20"
      >
        {/* Toggle Button */}
        <button
          onClick={handleToggleCollapse}
          className="absolute -right-3 top-6 bg-accent-app hover:opacity-90 text-white rounded-full p-1 border-2 border-bg-app z-40 transition-all shadow-lg cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Branding header */}
        <div className={`p-5 flex items-center justify-between border-b border-border-app/60 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-app to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-accent-app/20">
              <span className="font-extrabold text-sm text-slate-50">DN</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight text-text-primary tracking-wide">DevNotes Hub</span>
                <span className="text-[10px] font-semibold text-accent-app">INTERVIEW PREP</span>
              </div>
            )}
          </div>

          {/* Notification Bell (Expanded Sidebar) */}
          {!isCollapsed && currentUser && (
            <div className="relative">
              <button
                onClick={() => setBellDropdownOpen(!bellDropdownOpen)}
                className="p-1.5 rounded-lg text-text-muted hover:text-accent-app transition-all cursor-pointer relative flex items-center justify-center bg-white/5 border border-border-app/20"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[8px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setBellDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 z-50 w-72 bg-slate-900/95 backdrop-blur-md border border-border-app/50 rounded-xl shadow-2xl overflow-hidden text-left">
                    <div className="p-3 border-b border-border-app/40 bg-black/20 flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary">Unread Messages</span>
                      {unreadCount > 0 && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 font-extrabold px-1.5 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-border-app/20">
                      {unreadGroups.length === 0 ? (
                        <div className="p-4 text-center text-xs text-text-muted italic">
                          No unread notifications.
                        </div>
                      ) : (
                        unreadGroups.map(g => (
                          <Link
                            key={g.id}
                            href={`/group-chat?select=${g.id}`}
                            onClick={() => setBellDropdownOpen(false)}
                            className="block p-3 hover:bg-white/5 transition-colors text-left"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-accent-app truncate pr-2">#{g.name}</span>
                              <span className="text-[9px] bg-accent-app/25 text-accent-app font-extrabold px-1.5 py-0.5 rounded">
                                {g.unreadCount}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted truncate leading-snug">{g.snippet}</p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          
          {/* Main Quick Links */}
          <div className="space-y-1">
            {/* Search link */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 w-full p-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5 transition-all text-left text-sm font-medium border border-transparent hover:border-border-app/40 cursor-pointer"
            >
              <Search className="w-5 h-5 shrink-0 text-text-muted" />
              {!isCollapsed && <span className="flex-1 truncate">Quick Search</span>}
              {!isCollapsed && (
                <kbd className="text-[10px] text-text-muted/60 bg-black/40 border border-border-app px-1.5 py-0.5 rounded font-mono shrink-0">
                  Ctrl+K
                </kbd>
              )}
            </button>

            {/* Collapsed Bell Icon */}
            {isCollapsed && currentUser && (
              <div className="relative">
                <button
                  onClick={() => setBellDropdownOpen(!bellDropdownOpen)}
                  className="flex items-center justify-center w-full p-2.5 rounded-xl text-text-muted hover:text-accent-app transition-all border border-transparent hover:border-border-app/40 cursor-pointer relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500 text-white font-extrabold text-[8px] min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {bellDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellDropdownOpen(false)} />
                    <div className="fixed left-[72px] top-12 z-[9999] w-72 bg-slate-900/95 backdrop-blur-md border border-border-app/50 rounded-xl shadow-2xl overflow-hidden text-left">
                      <div className="p-3 border-b border-border-app/40 bg-black/20 flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary">Unread Messages</span>
                        {unreadCount > 0 && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 font-extrabold px-1.5 py-0.5 rounded-full">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-border-app/20">
                        {unreadGroups.length === 0 ? (
                          <div className="p-4 text-center text-xs text-text-muted italic">
                            No unread notifications.
                          </div>
                        ) : (
                          unreadGroups.map(g => (
                            <Link
                              key={g.id}
                              href={`/group-chat?select=${g.id}`}
                              onClick={() => setBellDropdownOpen(false)}
                              className="block p-3 hover:bg-white/5 transition-colors text-left"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-accent-app truncate pr-2">#{g.name}</span>
                                <span className="text-[9px] bg-accent-app/25 text-accent-app font-extrabold px-1.5 py-0.5 rounded">
                                  {g.unreadCount}
                                </span>
                              </div>
                              <p className="text-[10px] text-text-muted truncate leading-snug">{g.snippet}</p>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Dashboard Link */}
            <Link
              href="/"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${pathname === '/' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate">Dashboard</span>}
            </Link>

            {/* Interview Schedules Link */}
            <Link
              href="/schedules"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/schedules' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <Calendar className={`w-5 h-5 shrink-0 ${pathname === '/schedules' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate">Schedules & Prep</span>}
            </Link>

            {/* Interview Experiences Link */}
            <Link
              href="/interviews"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/interviews' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <Briefcase className={`w-5 h-5 shrink-0 ${pathname === '/interviews' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate">Interview Experiences</span>}
            </Link>

            {/* Real-time Group Chat Link */}
            <Link
              href="/group-chat"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/group-chat' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <MessageSquare className={`w-5 h-5 shrink-0 ${pathname === '/group-chat' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate flex-1">Community Chat</span>}
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>

            {/* AI Doubt Solver Link */}
            <Link
              href="/chat"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/chat' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <MessageSquareCode className={`w-5 h-5 shrink-0 ${pathname === '/chat' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate">Doubt Solver AI</span>}
            </Link>

            {/* Add Note Link */}
            <Link
              href={activeCategoryParam ? `/add?category=${activeCategoryParam}` : "/add"}
              onClick={handleWriteClick}
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/add'
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <PlusCircle className={`w-5 h-5 shrink-0 ${pathname === '/add' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && (
                <span className="flex-1 truncate flex items-center justify-between">
                  <span>Write Note</span>
                  {!isAdmin && <Lock className="w-3.5 h-3.5 text-text-muted/40 shrink-0" />}
                </span>
              )}
            </Link>

            {/* Manage Link */}
            <Link
              href="/manage"
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm font-medium border ${
                pathname === '/manage' 
                  ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-semibold' 
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-app/40'
              }`}
            >
              <Settings className={`w-5 h-5 shrink-0 ${pathname === '/manage' ? 'text-accent-app' : 'text-text-muted'}`} />
              {!isCollapsed && <span className="truncate">Control Center</span>}
            </Link>
          </div>

          {/* Category Navigation */}
          <div>
            {!isCollapsed && (
              <h4 
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent-app/60', 'bg-accent-app/5'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent-app/60', 'bg-accent-app/5'); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-accent-app/60', 'bg-accent-app/5');
                  if (!isAdmin) return;
                  try {
                    const rawData = e.dataTransfer.getData('text/plain');
                    if (!rawData) return;
                    const { type, slug } = JSON.parse(rawData);
                    if (type === 'category') {
                      toast.info('Moving folder to root level... 🚚');
                      const res = await fetch('/api/reorganize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          draggedType: 'category',
                          draggedSlug: slug,
                          targetType: 'root',
                          targetSlug: ''
                        })
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast.success('Successfully re-nested to root!');
                        window.location.reload();
                      } else {
                        toast.error(data.error || 'Failed to move folder.');
                      }
                    } else {
                      toast.error('Notes cannot be placed at the root level.');
                    }
                  } catch (err: any) {
                    toast.error('Re-nesting to root failed: ' + err.message);
                  }
                }}
                className="text-[10px] font-bold text-text-muted/65 uppercase tracking-widest px-3 py-1.5 mb-2 flex items-center gap-1.5 border border-dashed border-transparent transition-all rounded-lg select-none"
                title="Drag and drop categories here to move them to the root level"
              >
                <FolderOpen className="w-3.5 h-3.5 text-text-muted/60" />
                <span>Categories</span>
              </h4>
            )}
            
            <div className="space-y-1">
              {(() => {
                const tree = buildCategoryTree(categories);
                return tree.map((rootNode) => (
                  <CategoryTreeItem
                    key={rootNode.slug}
                    node={rootNode}
                    depth={0}
                    activeCategoryParam={activeCategoryParam}
                    pathname={pathname}
                    categoryCounts={categoryCounts}
                    isCollapsed={isCollapsed}
                    notes={notes}
                    isAdmin={isAdmin}
                  />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Dynamic Theme Selector */}
        <div className="border-t border-border-app/60 py-3.5 select-none shrink-0">
          {!isCollapsed ? (
            <div className="px-5">
              <button
                onClick={() => setTheme(theme === 'slate' ? 'light' : 'slate')}
                className="w-full flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-border-app/40 hover:bg-black/30 transition-all cursor-pointer text-xs font-semibold text-text-muted hover:text-text-primary"
              >
                <div className="flex items-center gap-2">
                  {theme === 'slate' ? (
                    <>
                      <Moon className="w-4 h-4 text-accent-app" />
                      <span>Dark Theme</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4 text-yellow-500" />
                      <span>White Theme</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-text-muted/60 uppercase font-bold bg-white/5 border border-border-app/40 px-1.5 py-0.5 rounded">
                  Toggle
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setTheme(theme === 'slate' ? 'light' : 'slate')}
              title={`Switch to ${theme === 'slate' ? 'White' : 'Dark'} Theme`}
              className="w-full flex justify-center py-2.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {theme === 'slate' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            </button>
          )}
        </div>

        {/* Persistent bottom user profile block */}
        <div className="p-4 border-t border-border-app bg-black/10 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-surface-app border border-border-app flex items-center justify-center shrink-0">
              {isAdmin ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-text-muted" />
              )}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-text-primary truncate">
                  {currentUser ? currentUser.username : 'Guest Reader'}
                </span>
                <span className="text-[10px] text-text-muted truncate">
                  {currentUser?.role === 'Admin' ? 'Admin Portal' : 'Approved Reader'}
                </span>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            currentUser ? (
              <button 
                onClick={handleLogout}
                title="Lock session"
                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={() => setIsLoginOpen(true)}
                title="Authenticate"
                className="px-2 py-1 bg-accent-app/10 hover:bg-accent-app/20 text-accent-app rounded-lg text-[10px] font-bold border border-accent-app/25 transition-all cursor-pointer"
              >
                Unlock
              </button>
            )
          )}
        </div>
      </motion.aside>

      {/* Login Dialog Box */}
      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onSuccess={(user) => {
          setCurrentUser(user);
          router.refresh();
        }} 
      />

      {/* Global Command Palette */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
