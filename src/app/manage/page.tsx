"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Trash2, 
  Pin, 
  Heart, 
  Clock, 
  Grid, 
  List, 
  FileText, 
  RefreshCcw, 
  AlertTriangle,
  FolderOpen,
  PlusCircle,
  Settings,
  Archive,
  Folder,
  Edit2,
  CheckCircle,
  FolderPlus,
  X
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Note, Category } from '@/lib/notes';
import { emojiSearchMatch } from '@/lib/emojiSearch';
import EmojiPicker from '@/components/EmojiPicker';

function ManageNotesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // UI States
  const [currentTab, setCurrentTab] = useState<'active' | 'trash' | 'categories'>('active');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Category CRUD states
  const [newCatName, setNewCatName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Selection states (for bulk actions)
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  
  // Modal dialog states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<{ categoryFolder: string; slug: string; permanent: boolean } | null>(null);
  
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkPinModalOpen, setBulkPinModalOpen] = useState(false);
  const [bulkUnpinModalOpen, setBulkUnpinModalOpen] = useState(false);
  
  // Category delete modal
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [pendingDeleteCategorySlug, setPendingDeleteCategorySlug] = useState<string | null>(null);

  // Sync category query parameter from sidebar clicks
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) {
      setSelectedCategory(cat);
      setCurrentTab('active');
    }
  }, [searchParams]);

  // Fetch Notes, Trash & Categories & Check Admin Status
  const fetchData = async () => {
    setLoading(true);
    try {
      const authRes = await fetch('/api/auth');
      const authData = await authRes.json();
      const adminPrivileged = authData.success && authData.user?.role === 'Admin';
      setIsAdmin(adminPrivileged);

      const activeRes = await fetch('/api/notes');
      const activeData = await activeRes.json();
      
      const trashRes = await fetch('/api/notes?trash=true');
      const trashData = await trashRes.json();

      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();

      if (activeData.success) {
        let fetchedNotes = activeData.notes;
        
        // Merge localStorage favorites for Guest display support
        if (typeof window !== 'undefined') {
          const localFavs = JSON.parse(localStorage.getItem('devnotes-favorites') || '[]');
          fetchedNotes = fetchedNotes.map((n: Note) => {
            if (localFavs.includes(n.slug)) {
              return {
                ...n,
                metadata: {
                  ...n.metadata,
                  favorite: true
                }
              };
            }
            return n;
          });
        }
        
        setNotes(fetchedNotes);
      }
      if (trashData.success) setTrashNotes(trashData.notes);
      if (catData.success) setCategories(catData.categories);
    } catch (e) {
      toast.error('Failed to load notes inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter notes dynamically
  const filteredNotes = notes.filter((n) => {
    const matchesSearch = searchQuery === '' || 
      emojiSearchMatch(n.metadata.title, searchQuery) ||
      emojiSearchMatch(n.metadata.category, searchQuery) ||
      n.metadata.tags.some(t => emojiSearchMatch(t, searchQuery));

    const matchesCategory = selectedCategory === '' || n.categoryFolder === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const filteredTrashNotes = trashNotes.filter((n) => {
    return searchQuery === '' || 
      emojiSearchMatch(n.metadata.title, searchQuery) ||
      emojiSearchMatch(n.metadata.category, searchQuery);
  });

  // Handle Checkbox Selection
  const handleSelectNote = (slug: string) => {
    if (!isAdmin) return;
    if (selectedSlugs.includes(slug)) {
      setSelectedSlugs(selectedSlugs.filter(s => s !== slug));
    } else {
      setSelectedSlugs([...selectedSlugs, slug]);
    }
  };

  const handleSelectAll = () => {
    if (!isAdmin) return;
    const visibleNotes = currentTab === 'active' ? filteredNotes : filteredTrashNotes;
    if (selectedSlugs.length === visibleNotes.length) {
      setSelectedSlugs([]);
    } else {
      setSelectedSlugs(visibleNotes.map(n => n.slug));
    }
  };

  // Toggle Pinned status in list
  const handleTogglePinned = async (note: Note) => {
    if (!isAdmin) return;
    const newPinned = !note.metadata.pinned;
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCategoryFolder: note.categoryFolder,
          originalSlug: note.slug,
          title: note.metadata.title,
          category: note.metadata.category,
          content: note.content,
          tags: note.metadata.tags,
          pinned: newPinned,
          favorite: note.metadata.favorite
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(newPinned ? 'Note pinned!' : 'Note unpinned.');
        fetchData();
      }
    } catch (e) {
      toast.error('Failed to change pin state.');
    }
  };

  // Toggle Favorite status in list
  const handleToggleFavorite = async (note: Note) => {
    const newFavorite = !note.metadata.favorite;
    
    if (!isAdmin) {
      try {
        const localFavs = JSON.parse(localStorage.getItem('devnotes-favorites') || '[]');
        let updatedFavs = [...localFavs];
        if (newFavorite) {
          if (!updatedFavs.includes(note.slug)) {
            updatedFavs.push(note.slug);
          }
        } else {
          updatedFavs = updatedFavs.filter(s => s !== note.slug);
        }
        localStorage.setItem('devnotes-favorites', JSON.stringify(updatedFavs));
        toast.success(newFavorite ? 'Marked as favorite locally!' : 'Removed from local favorites.');
        fetchData();
      } catch (e) {
        toast.error('Failed to toggle local favorite.');
      }
      return;
    }

    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCategoryFolder: note.categoryFolder,
          originalSlug: note.slug,
          title: note.metadata.title,
          category: note.metadata.category,
          content: note.content,
          tags: note.metadata.tags,
          pinned: note.metadata.pinned,
          favorite: newFavorite
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(newFavorite ? 'Marked as favorite!' : 'Removed from favorites.');
        fetchData();
      }
    } catch (e) {
      toast.error('Failed to change favorite state.');
    }
  };

  // Single Note Delete Action (Soft or Permanent)
  const triggerDeleteNote = (categoryFolder: string, slug: string, permanent: boolean) => {
    if (!isAdmin) return;
    setPendingDeleteNote({ categoryFolder, slug, permanent });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteNote || !isAdmin) return;
    const { categoryFolder, slug, permanent } = pendingDeleteNote;

    try {
      const res = await fetch(`/api/notes?categoryFolder=${categoryFolder}&slug=${slug}&permanent=${permanent}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(permanent ? 'Note permanently deleted.' : 'Note moved to trash.');
        setSelectedSlugs([]);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete note.');
      }
    } catch (e) {
      toast.error('An error occurred during deletion.');
    } finally {
      setPendingDeleteNote(null);
    }
  };

  // Restore Note from Trash
  const handleRestoreNote = async (slug: string) => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/notes/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Note successfully restored!');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to restore note.');
      }
    } catch (e) {
      toast.error('Error restoring note.');
    }
  };

  // Bulk Actions Handlers
  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    let successCount = 0;
    const permanent = currentTab === 'trash';
    
    for (const slug of selectedSlugs) {
      const noteToDelete = (permanent ? trashNotes : notes).find(n => n.slug === slug);
      if (noteToDelete) {
        try {
          const res = await fetch(`/api/notes?categoryFolder=${noteToDelete.categoryFolder}&slug=${slug}&permanent=${permanent}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) successCount++;
        } catch (e) {
          console.error('Error bulk deleting:', e);
        }
      }
    }

    toast.success(`Batch complete: deleted ${successCount} notes.`);
    setSelectedSlugs([]);
    fetchData();
  };

  const handleBulkPinToggle = async (pinState: boolean) => {
    if (!isAdmin) return;
    let successCount = 0;
    for (const slug of selectedSlugs) {
      const noteToUpdate = notes.find(n => n.slug === slug);
      if (noteToUpdate) {
        try {
          const res = await fetch('/api/notes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalCategoryFolder: noteToUpdate.categoryFolder,
              originalSlug: noteToUpdate.slug,
              title: noteToUpdate.metadata.title,
              category: noteToUpdate.metadata.category,
              content: noteToUpdate.content,
              tags: noteToUpdate.metadata.tags,
              pinned: pinState,
              favorite: noteToUpdate.metadata.favorite
            })
          });
          const data = await res.json();
          if (data.success) successCount++;
        } catch (e) {
          console.error('Error bulk pinning:', e);
        }
      }
    }

    toast.success(`Batch complete: updated ${successCount} notes.`);
    setSelectedSlugs([]);
    fetchData();
  };

  // Category CRUD Execution
  const handleAddCategory = async () => {
    if (!isAdmin) return;
    const name = newCatName.trim();
    if (!name) return;

    setAddingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Category "${name}" created successfully!`);
        setNewCatName('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create category.');
      }
    } catch (e) {
      toast.error('An error occurred.');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleStartRenameCategory = (cat: Category) => {
    if (!isAdmin) return;
    setEditingCategorySlug(cat.slug);
    setEditCatName(cat.name);
  };

  const handleSaveRenameCategory = async (oldSlug: string) => {
    if (!isAdmin) return;
    const newName = editCatName.trim();
    if (!newName) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSlug, newName })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Category successfully renamed!');
        setEditingCategorySlug(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to rename category.');
      }
    } catch (e) {
      toast.error('An error occurred.');
    }
  };

  const triggerDeleteCategory = (slug: string) => {
    if (!isAdmin) return;
    setPendingDeleteCategorySlug(slug);
    setDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!pendingDeleteCategorySlug || !isAdmin) return;
    try {
      const res = await fetch(`/api/categories?slug=${pendingDeleteCategorySlug}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Category and its directories purged successfully.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete category.');
      }
    } catch (e) {
      toast.error('An error occurred.');
    } finally {
      setPendingDeleteCategorySlug(null);
    }
  };

  if (loading && notes.length === 0) {
    return (
      <div className="flex-grow p-8 max-w-6xl mx-auto w-full space-y-6 animate-pulse mt-8">
        <div className="h-8 bg-slate-800 rounded-lg w-1/4"></div>
        <div className="h-10 bg-slate-800 rounded-lg w-full"></div>
        <div className="h-96 bg-slate-850 rounded-2xl"></div>
      </div>
    );
  }

  const allSelected = selectedSlugs.length > 0 && selectedSlugs.length === (currentTab === 'active' ? filteredNotes.length : filteredTrashNotes.length);
  const getNoteCount = (catSlug: string) => {
    return notes.filter(n => n.categoryFolder === catSlug).length;
  };

  return (
    <div className="flex-grow p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 sm:space-y-8 select-none">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-text-primary flex items-center gap-2">
            <Settings className="w-6 h-6 text-accent-app" />
            Control Center
          </h1>
          <p className="text-xs md:text-sm text-text-muted">
            Search, batch-modify, delete, pin, and manage all developer notes and categories.
          </p>
        </div>

        {/* Quick Add Button */}
        {isAdmin && (
          <Link
            href={selectedCategory ? `/add?category=${selectedCategory}` : "/add"}
            className="px-4 py-2.5 bg-accent-app hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-accent-app/10 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer font-sans"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Write New Note</span>
          </Link>
        )}
      </div>

      {/* Guest Mode Restriction Warning Banner */}
      {!isAdmin && (
        <div className="flex gap-3.5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-400 font-semibold shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <strong className="block text-sm font-bold">Read-Only Guest Mode Active</strong>
            <span className="block mt-0.5 text-text-muted">
              You are currently viewing the workspace as a guest. CRUD operations, toggling pins, favorite modifications, and category changes are restricted. Please sign in as Administrator to gain access.
            </span>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-border-app/40 gap-4 sm:gap-6 select-none text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => {
            setCurrentTab('active');
            setSelectedSlugs([]);
          }}
          className={`pb-3 font-extrabold tracking-wider uppercase border-b-2 transition-all relative flex items-center gap-2 cursor-pointer ${
            currentTab === 'active' 
              ? 'text-accent-app border-accent-app font-bold' 
              : 'text-text-muted border-transparent hover:text-text-primary'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Active Notes ({notes.length})</span>
        </button>

        <button
          onClick={() => {
            setCurrentTab('trash');
            setSelectedSlugs([]);
          }}
          className={`pb-3 font-extrabold tracking-wider uppercase border-b-2 transition-all relative flex items-center gap-2 cursor-pointer ${
            currentTab === 'trash' 
              ? 'text-accent-app border-accent-app font-bold' 
              : 'text-text-muted border-transparent hover:text-text-primary'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Trash Bin ({trashNotes.length})</span>
        </button>

        <button
          onClick={() => {
            setCurrentTab('categories');
            setSelectedSlugs([]);
          }}
          className={`pb-3 font-extrabold tracking-wider uppercase border-b-2 transition-all relative flex items-center gap-2 cursor-pointer ${
            currentTab === 'categories' 
              ? 'text-accent-app border-accent-app font-bold' 
              : 'text-text-muted border-transparent hover:text-text-primary'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Categories Manager ({categories.length})</span>
        </button>
      </div>

      {/* Filter and Control Actions Toolbar */}
      {currentTab !== 'categories' && (
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center gap-2 bg-black/20 border border-border-app rounded-xl px-3.5 py-2 max-w-sm w-full">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, tags, or category..."
                className="bg-transparent border-none text-xs text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 p-0 flex-1"
              />
            </div>

            {currentTab === 'active' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-surface-app border border-border-app rounded-xl px-3 py-2 text-xs font-semibold text-text-muted focus:outline-none focus:ring-0"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            )}

            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  router.replace('/manage');
                }}
                className="text-xs text-accent-app hover:opacity-90 font-semibold underline underline-offset-2 cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>

          {currentTab === 'active' && (
            <div className="flex items-center gap-1.5 p-1 bg-black/20 border border-border-app rounded-xl self-end md:self-auto select-none">
              <button
                onClick={() => setViewLayout('grid')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewLayout === 'grid' 
                    ? 'bg-surface-app text-accent-app' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('table')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewLayout === 'table' 
                    ? 'bg-surface-app text-accent-app' 
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions Panel Overlay */}
      <AnimatePresence>
        {selectedSlugs.length > 0 && currentTab !== 'categories' && isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-app border border-accent-app/20 text-sm font-semibold select-none shadow-md shadow-slate-950/20"
          >
            <span className="text-text-muted text-xs">
              Selected <strong className="text-accent-app">{selectedSlugs.length}</strong> items:
            </span>

            <div className="flex gap-2 flex-wrap">
              {currentTab === 'active' && (
                <>
                  <button
                    onClick={() => setBulkPinModalOpen(true)}
                    className="px-3 py-1.5 bg-accent-app/10 border border-accent-app/25 text-accent-app rounded-xl hover:bg-accent-app/20 text-xs font-bold transition-all cursor-pointer"
                  >
                    Bulk Pin
                  </button>
                  <button
                    onClick={() => setBulkUnpinModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-705 text-xs font-bold transition-all cursor-pointer"
                  >
                    Bulk Unpin
                  </button>
                </>
              )}
              
              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{currentTab === 'active' ? 'Delete Selected' : 'Purge Selected'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content View Grid / Table / Categories */}
      {currentTab === 'active' ? (
        filteredNotes.length === 0 ? (
          <div className="glass-panel p-16 text-center text-text-muted rounded-2xl border border-dashed border-border-app/40 flex flex-col items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-text-muted/40" />
            <p className="text-xs">No active notes found matching your selection.</p>
            {isAdmin && (
              <Link href="/add" className="text-xs text-accent-app font-bold hover:underline">
                Create a new note now
              </Link>
            )}
          </div>
        ) : viewLayout === 'grid' ? (
          /* Active Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNotes.map((note) => (
              <div
                key={note.slug}
                className={`glass-panel rounded-2xl border p-5 flex flex-col justify-between group relative transition-all ${
                  selectedSlugs.includes(note.slug)
                    ? 'border-accent-app bg-accent-app/[0.02] shadow-accent-app/5'
                    : 'border-border-app hover:border-border-app/80'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-4 left-4 z-10 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedSlugs.includes(note.slug)}
                      onChange={() => handleSelectNote(note.slug)}
                      className="w-4.5 h-4.5 rounded bg-black/30 border-border-app text-accent-app focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                )}

                <div className={isAdmin ? "pl-6" : ""}>
                  <div className="flex items-center justify-between gap-2 mb-2 select-none">
                    <span className="text-[10px] font-bold text-text-primary bg-black/25 px-2 py-0.5 rounded border border-border-app/50 uppercase tracking-wider">
                      {note.metadata.category}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => isAdmin && handleTogglePinned(note)} 
                        disabled={!isAdmin}
                        className={`text-text-muted transition-colors ${isAdmin ? 'hover:text-indigo-400 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        <Pin className={`w-3.5 h-3.5 rotate-45 ${note.metadata.pinned ? 'text-indigo-400 fill-indigo-400/20' : ''}`} />
                      </button>
                      <button 
                        onClick={() => isAdmin && handleToggleFavorite(note)} 
                        disabled={!isAdmin}
                        className={`text-text-muted transition-colors ${isAdmin ? 'hover:text-rose-450 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${note.metadata.favorite ? 'text-rose-500 fill-rose-500/30' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <Link href={`/read/${note.categoryFolder}/${note.slug}`} className="block font-bold text-text-primary group-hover:text-accent-app transition-colors text-sm truncate mt-1">
                    {note.metadata.title}
                  </Link>

                  <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                    {note.content.substring(0, 100).replace(/[#*`[\]()]/g, '')}
                  </p>
                </div>

                <div className={`flex items-center justify-between text-[11px] text-text-muted mt-5 pt-3 border-t border-border-app/40 ${isAdmin ? "pl-6" : ""}`}>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-text-muted/60" />
                    {note.readingTime} min
                  </span>
                  
                  <div className="flex items-center gap-3">
                    <Link href={`/read/${note.categoryFolder}/${note.slug}`} className="hover:text-text-primary font-bold transition-colors">
                      Read
                    </Link>
                    {isAdmin && (
                      <>
                        <Link href={`/modify/${note.categoryFolder}/${note.slug}`} className="hover:text-accent-app font-bold transition-colors">
                          Edit
                        </Link>
                        <button
                          onClick={() => triggerDeleteNote(note.categoryFolder, note.slug, false)}
                          className="text-text-muted hover:text-red-400 font-bold transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Tabular Row List Layout */
          <div className="glass-panel rounded-2xl border border-border-app overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-black/10 border-b border-border-app text-text-muted font-bold uppercase tracking-wider">
                    {isAdmin && (
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded bg-black/20 border-border-app text-accent-app focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="p-4">Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Modified</th>
                    <th className="p-4 w-40 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((note) => (
                    <tr
                      key={note.slug}
                      className={`hover:bg-white/3 border-b border-border-app/40 transition-colors ${
                        selectedSlugs.includes(note.slug) ? 'bg-accent-app/[0.01]' : ''
                      }`}
                    >
                      {isAdmin && (
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedSlugs.includes(note.slug)}
                            onChange={() => handleSelectNote(note.slug)}
                            className="w-4 h-4 rounded bg-black/20 border-border-app text-accent-app focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-4 font-bold text-text-primary">
                        <div className="flex items-center gap-2 min-w-0">
                          {note.metadata.pinned && <Pin className="w-3.5 h-3.5 text-indigo-400 rotate-45 shrink-0" />}
                          {note.metadata.favorite && <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/30 shrink-0" />}
                          <Link href={`/read/${note.categoryFolder}/${note.slug}`} className="hover:text-accent-app truncate">
                            {note.metadata.title}
                          </Link>
                        </div>
                      </td>
                      <td className="p-4 text-text-muted font-semibold">{note.metadata.category}</td>
                      <td className="p-4 text-text-muted font-semibold">{note.readingTime} mins</td>
                      <td className="p-4 text-text-muted/60">
                        {new Date(note.metadata.updatedDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-3 font-semibold text-text-muted">
                        <Link href={`/read/${note.categoryFolder}/${note.slug}`} className="hover:text-text-primary">
                          View
                        </Link>
                        {isAdmin && (
                          <>
                            <Link href={`/modify/${note.categoryFolder}/${note.slug}`} className="hover:text-accent-app">
                              Edit
                            </Link>
                            <button
                              onClick={() => triggerDeleteNote(note.categoryFolder, note.slug, false)}
                              className="hover:text-red-400 cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : currentTab === 'trash' ? (
        /* Soft-Deleted Trash Window */
        filteredTrashNotes.length === 0 ? (
          <div className="glass-panel p-16 text-center text-text-muted rounded-2xl border border-dashed border-border-app/40 flex flex-col items-center gap-3">
            <Archive className="w-10 h-10 text-text-muted/40" />
            <p className="text-xs">The trash bin is completely empty.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-border-app overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="bg-black/10 border-b border-border-app text-text-muted font-bold uppercase tracking-wider">
                    {isAdmin && (
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded bg-black/20 border-border-app text-accent-app focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="p-4">Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Deleted Date</th>
                    <th className="p-4 w-48 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrashNotes.map((note) => (
                    <tr
                      key={note.slug}
                      className={`hover:bg-white/3 border-b border-border-app/40 transition-colors ${
                        selectedSlugs.includes(note.slug) ? 'bg-accent-app/[0.01]' : ''
                      }`}
                    >
                      {isAdmin && (
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedSlugs.includes(note.slug)}
                            onChange={() => handleSelectNote(note.slug)}
                            className="w-4 h-4 rounded bg-black/20 border-border-app text-accent-app focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-4 font-bold text-text-primary truncate">{note.metadata.title}</td>
                      <td className="p-4 text-text-muted font-semibold">{note.metadata.category}</td>
                      <td className="p-4 text-text-muted/65">
                        {new Date(note.metadata.updatedDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-3 font-semibold">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => handleRestoreNote(note.slug)}
                              className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 inline-flex hover:underline cursor-pointer"
                            >
                              <RefreshCcw className="w-3.5 h-3.5 animate-spin-reverse" />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => triggerDeleteNote('recently-deleted', note.slug, true)}
                              className="text-red-500 hover:text-red-400 hover:underline cursor-pointer font-bold"
                            >
                              Delete Forever
                            </button>
                          </>
                        ) : (
                          <span className="text-text-muted/40 font-normal">Read-Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* DYNAMIC CATEGORY MANAGER PANEL */
        <div className="space-y-6">
          {/* Add Category Panel (Admin Only) */}
          {isAdmin && (
            <div className="glass-panel p-5 rounded-2xl border border-border-app max-w-xl shadow-lg flex items-center gap-3">
              <EmojiPicker onSelectEmoji={(emoji) => setNewCatName(prev => `${emoji} ${prev}`)} />
              <div className="p-2.5 bg-accent-app/10 border border-accent-app/20 rounded-xl text-accent-app shrink-0">
                <FolderPlus className="w-5.5 h-5.5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Write new Category title... (e.g. Docker, Microservices)"
                  className="w-full bg-transparent border-none text-xs text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 p-0"
                />
              </div>
              
              <button
                onClick={handleAddCategory}
                disabled={addingCategory || !newCatName.trim()}
                className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                {addingCategory ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          )}

          {/* Categories Grid list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const activeCount = getNoteCount(cat.slug);
              const isEditing = editingCategorySlug === cat.slug;

              return (
                <div
                  key={cat.slug}
                  className="glass-panel p-5 rounded-2xl border border-border-app hover:border-border-app/80 shadow-lg flex flex-col justify-between h-40 group relative bg-surface-app/20"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-[10px] text-text-muted/50 bg-black/25 border border-border-app px-2 py-0.5 rounded font-mono">
                        slug: /{cat.slug}
                      </span>
                      
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-app/10 border border-accent-app/20 text-accent-app">
                        {activeCount} active notes
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 pt-2">
                        <EmojiPicker onSelectEmoji={(emoji) => setEditCatName(prev => `${emoji} ${prev}`)} />
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameCategory(cat.slug)}
                          className="bg-black/35 border border-border-app rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRenameCategory(cat.slug)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategorySlug(null)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-extrabold text-sm text-text-primary pt-1 group-hover:text-accent-app transition-colors">
                        {cat.name}
                      </h3>
                    )}
                  </div>

                  {/* Actions footer (Admin only) */}
                  <div className="flex items-center justify-end gap-4 border-t border-border-app/40 pt-3 select-none text-[11px] font-bold">
                    {isAdmin ? (
                      <>
                        {!isEditing && (
                          <button
                            onClick={() => handleStartRenameCategory(cat)}
                            className="text-text-muted hover:text-accent-app flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>
                        )}
                        <button
                          onClick={() => triggerDeleteCategory(cat.slug)}
                          className="text-text-muted hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-text-muted/40 font-normal">Restricted Category Edit</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modals */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={pendingDeleteNote?.permanent ? "Permanently Delete Note?" : "Move Note to Trash?"}
        description={
          pendingDeleteNote?.permanent
            ? "Are you absolutely sure you want to permanently delete this note from the remote database? This action is irreversible."
            : "This note will be moved to the database trash bin. You will be able to restore it anytime in the Recently Deleted folder."
        }
        confirmText={pendingDeleteNote?.permanent ? "Delete Permanently" : "Move to Trash"}
        isDanger={true}
      />

      <Modal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title={currentTab === 'trash' ? "Permanently Purge Selected?" : "Move Selected to Trash?"}
        description={
          currentTab === 'trash'
            ? `Are you sure you want to permanently delete these ${selectedSlugs.length} notes from the database? This action cannot be undone.`
            : `Are you sure you want to move these ${selectedSlugs.length} notes to the trash bin?`
        }
        confirmText="Confirm Batch Delete"
        isDanger={true}
      />

      <Modal
        isOpen={bulkPinModalOpen}
        onClose={() => setBulkPinModalOpen(false)}
        onConfirm={() => handleBulkPinToggle(true)}
        title="Pin Selected Notes?"
        description={`Are you sure you want to pin all the ${selectedSlugs.length} selected notes to the top of your dashboard?`}
        confirmText="Pin Notes"
      />

      <Modal
        isOpen={bulkUnpinModalOpen}
        onClose={() => setBulkUnpinModalOpen(false)}
        onConfirm={() => handleBulkPinToggle(false)}
        title="Unpin Selected Notes?"
        description={`Are you sure you want to unpin all the ${selectedSlugs.length} selected notes?`}
        confirmText="Unpin Notes"
      />

      <Modal
        isOpen={deleteCategoryModalOpen}
        onClose={() => setDeleteCategoryModalOpen(false)}
        onConfirm={handleConfirmDeleteCategory}
        title="Permanently Delete Category?"
        description={`WARNING! Deleting this category from the database will permanently cascade-delete notes or soft-delete them from CategorySlug. Active notes inside this category will have their category field set to null and moved to the trash bin. Proceed?`}
        confirmText="Delete Category & Purge"
        isDanger={true}
      />
    </div>
  );
}

// Main page export wrapped in Suspense boundary
export default function ManageNotes() {
  return (
    <Suspense fallback={
      <div className="flex-grow p-8 max-w-6xl mx-auto w-full space-y-6 animate-pulse mt-8">
        <div className="h-8 bg-slate-800 rounded-lg w-1/4"></div>
        <div className="h-10 bg-slate-800 rounded-lg w-full"></div>
        <div className="h-96 bg-slate-850 rounded-2xl"></div>
      </div>
    }>
      <ManageNotesContent />
    </Suspense>
  );
}
