'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Menu, 
  X, 
  Home, 
  Calendar, 
  PlusCircle, 
  Settings, 
  Lock, 
  Unlock, 
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Folder,
  Palette,
  FileText,
  MessageSquareCode
} from 'lucide-react';
import Sidebar from './Sidebar';
import LoginModal from './LoginModal';
import { Category } from '@/lib/notes';
import { useTheme } from './ThemeContext';
import { useToast } from './Toast';
import EmojiPicker from './EmojiPicker';

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

function CategoryTreeItemMobile({ 
  node, 
  depth, 
  pathname, 
  categoryCounts,
  onCloseDrawer,
  notes,
  isAdmin
}: { 
  node: CategoryTreeNode; 
  depth: number; 
  pathname: string; 
  categoryCounts: Record<string, number>;
  onCloseDrawer: () => void;
  notes: any[];
  isAdmin: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Hover & Subcategory Modal States
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [subCatName, setSubCatName] = useState('');

  const childNotes = notes.filter(note => note.categoryFolder === node.slug);
  const hasChildren = node.children.length > 0;
  const hasNotes = childNotes.length > 0;
  const isExpandable = hasChildren || hasNotes;
  
  const hasActiveDescendant = (n: CategoryTreeNode): boolean => {
    const isNoteActive = notes.some(note => 
      (note.categoryFolder === n.slug) && 
      (pathname === `/read/${note.categoryFolder}/${note.slug}` || pathname === `/modify/${note.categoryFolder}/${note.slug}`)
    );
    if (isNoteActive) return true;
    return n.children.some(child => hasActiveDescendant(child));
  };

  const [isExpanded, setIsExpanded] = useState(() => hasActiveDescendant(node));
  
  const isSelected = pathname.startsWith(`/read/${node.slug}`) || pathname.startsWith(`/modify/${node.slug}`);
  const noteCount = categoryCounts[node.slug] || 0;
  const IconComponent = node.parentSlug ? Folder : FolderOpen;

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
        toast.success(data.message || 'Successfully moved!');
        onCloseDrawer();
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to move item.');
      }
    } catch (err: any) {
      toast.error('Re-nesting failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-1" onMouseLeave={() => { setIsHovered(false); setMenuOpen(false); }}>
      <div
        draggable={isAdmin}
        onDragStart={(e) => handleDragStart(e, 'category', node.slug)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, node.slug)}
        onMouseEnter={() => setIsHovered(true)}
        onClick={(e) => {
          setIsHovered(true);
          if (isExpandable) {
            setIsExpanded(!isExpanded);
          }
        }}
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
          isDragOver 
            ? 'bg-accent-app/15 border-dashed border-accent-app scale-[1.01]' 
            : isSelected 
              ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-bold' 
              : 'text-text-muted hover:text-text-primary border-transparent hover:bg-white/4'
        } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 10}px` }}
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
          
          <Link 
            href={`/manage?category=${node.slug}`} 
            onClick={onCloseDrawer}
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent-app' : 'text-text-muted'}`} />
            <span className="truncate leading-none pt-0.5">{node.name}</span>
          </Link>
        </div>

        {/* Hover / Touch plus controls */}
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
                      onCloseDrawer();
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
              <span className="text-[10px] text-text-muted/60 bg-black/10 px-1.5 py-0.5 rounded border border-border-app/20 font-bold shrink-0">
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
            <CategoryTreeItemMobile
              key={child.slug}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              categoryCounts={categoryCounts}
              onCloseDrawer={onCloseDrawer}
              notes={notes}
              isAdmin={isAdmin}
            />
          ))}
          
          {/* 2. Render Child Notes */}
          {hasNotes && childNotes.map(n => {
            const isNoteSelected = pathname === `/read/${n.categoryFolder}/${n.slug}` || pathname === `/modify/${n.categoryFolder}/${n.slug}`;
            return (
              <Link
                key={n.slug}
                href={`/read/${n.categoryFolder}/${n.slug}`}
                onClick={onCloseDrawer}
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
                      onCloseDrawer();
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

      {/* Mobile Subfolder Addition Modal Overlay */}
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
                            onCloseDrawer();
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
                      onCloseDrawer();
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, themes } = useTheme();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    }
  };

  const fetchCategoriesAndCounts = async () => {
    try {
      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      
      const notesRes = await fetch('/api/notes');
      const notesData = await notesRes.json();

      if (catData.success && catData.categories) {
        setCategories(catData.categories);
        
        const counts: Record<string, number> = {};
        catData.categories.forEach((cat: Category) => {
          counts[cat.slug] = 0;
        });

        if (notesData.success && notesData.notes) {
          setNotes(notesData.notes);
          notesData.notes.forEach((note: any) => {
            const folder = note.categoryFolder;
            if (folder in counts) {
              counts[folder]++;
            } else {
              counts[folder] = 1;
            }
          });
        }
        setCategoryCounts(counts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkUserSession();
    fetchCategoriesAndCounts();
    setIsDrawerOpen(false); // Close drawer on route change
  }, [pathname]);

  const handleWriteClick = (e: React.MouseEvent) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      e.preventDefault();
      setIsLoginOpen(true);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      setCurrentUser(null);
      router.push('/');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = currentUser?.role === 'Admin';
  const isWritePage = pathname === '/add' || pathname.startsWith('/modify/') || pathname.startsWith('/read/');

  return (
    <div className="flex min-h-screen w-full bg-bg-app overflow-hidden">
      
      {/* 1. Desktop Sidebar */}
      {!isWritePage && (
        <Suspense fallback={
          <div className="hidden md:flex w-[260px] h-screen bg-surface-app border-r border-border-app flex items-center justify-center shrink-0">
            <div className="w-5 h-5 border-2 border-accent-app border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <Sidebar />
        </Suspense>
      )}

      {/* 2. Main content container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        
        {/* Mobile Header: fixed top at viewport */}
        {!isWritePage && (
          <header className="flex md:hidden items-center justify-between px-4 h-14 bg-surface-app/80 backdrop-blur-md border-b border-border-app/45 fixed top-0 left-0 right-0 z-40 select-none">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-accent-app to-indigo-500 flex items-center justify-center shadow-md">
                  <span className="font-extrabold text-[10px] text-white">DN</span>
                </div>
                <span className="font-bold text-xs text-text-primary tracking-wide">DevNotes Hub</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile Auth Button */}
              {isAdmin ? (
                <button 
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-emerald-450 hover:bg-emerald-500/10 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Unlock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Admin</span>
                </button>
              ) : (
                <button 
                  onClick={() => setIsLoginOpen(true)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-accent-app transition-all cursor-pointer flex items-center gap-1"
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Unlock</span>
                </button>
              )}
            </div>
          </header>
        )}

        {/* Dynamic Margin Top for Mobile Viewport to clear Header */}
        <main className={`flex-1 overflow-y-auto bg-bg-app flex flex-col relative ${
          !isWritePage ? 'pt-14 pb-16 md:pt-0 md:pb-0' : ''
        }`}>
          {children}
        </main>

        {/* 3. Mobile Bottom Navigation Bar */}
        {!isWritePage && (
          <nav className="flex md:hidden items-center justify-around h-16 bg-surface-app/90 backdrop-blur-md border-t border-border-app/45 fixed bottom-0 left-0 right-0 z-40 px-3 shadow-2xl">
            <Link 
              href="/"
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                pathname === '/' ? 'text-accent-app' : 'text-text-muted'
              }`}
            >
              <Home className="w-5.5 h-5.5" />
              <span>Dashboard</span>
            </Link>

            <Link 
              href="/schedules"
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                pathname === '/schedules' ? 'text-accent-app' : 'text-text-muted'
              }`}
            >
              <Calendar className="w-5.5 h-5.5" />
              <span>Schedules</span>
            </Link>

            <Link 
              href="/chat"
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                pathname === '/chat' ? 'text-accent-app' : 'text-text-muted'
              }`}
            >
              <MessageSquareCode className="w-5.5 h-5.5" />
              <span>AI Doubt</span>
            </Link>

            <Link 
              href="/add"
              onClick={handleWriteClick}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                pathname === '/add' ? 'text-accent-app' : 'text-text-muted'
              }`}
            >
              <PlusCircle className="w-5.5 h-5.5" />
              <span>Write</span>
            </Link>

            <Link 
              href="/manage"
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-all ${
                pathname === '/manage' ? 'text-accent-app' : 'text-text-muted'
              }`}
            >
              <Settings className="w-5.5 h-5.5" />
              <span>Control</span>
            </Link>
          </nav>
        )}
      </div>

      {/* 4. Sliding Category Filter Side Drawer (Mobile) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-sm h-full bg-surface-app border-r border-border-app flex flex-col p-5 shadow-2xl z-10">
            {/* Close button */}
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-accent-app to-indigo-500 flex items-center justify-center shadow-md">
                <span className="font-extrabold text-[10px] text-white">DN</span>
              </div>
              <span className="font-bold text-sm text-text-primary tracking-wide">Category Filters</span>
            </div>

            {/* Quick Themes inside Drawer */}
            <div className="mb-6 bg-black/10 p-3 rounded-xl border border-border-app/40 select-none">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-muted/60 uppercase tracking-widest mb-2">
                <Palette className="w-3.5 h-3.5 text-text-muted/50" />
                Mobile Theme
              </div>
              <div className="flex items-center justify-between">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{ backgroundColor: t.color }}
                    className={`w-5 h-5 rounded-full border cursor-pointer transition-all ${
                      theme === t.id ? 'border-text-primary scale-110 ring-2 ring-accent-app/50' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Category Listing */}
            <div className="flex-1 overflow-y-auto space-y-4">
              <h4 className="text-[10px] font-bold text-text-muted/65 uppercase tracking-widest flex items-center gap-1.5 px-1">
                <FolderOpen className="w-3.5 h-3.5 text-text-muted/60" />
                Select Category
              </h4>

              <div className="space-y-1.5">
                {(() => {
                  const tree = buildCategoryTree(categories);
                  return tree.map((rootNode) => (
                    <CategoryTreeItemMobile
                      key={rootNode.slug}
                      node={rootNode}
                      depth={0}
                      pathname={pathname}
                      categoryCounts={categoryCounts}
                      onCloseDrawer={() => setIsDrawerOpen(false)}
                      notes={notes}
                      isAdmin={isAdmin}
                    />
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Login Dialog */}
      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onSuccess={(user) => {
          setCurrentUser(user);
          router.refresh();
        }} 
      />

    </div>
  );
}
