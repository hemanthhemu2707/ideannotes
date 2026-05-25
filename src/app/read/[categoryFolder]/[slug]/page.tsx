"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  Edit3, 
  Pin, 
  Heart, 
  Clock, 
  Calendar, 
  Hash, 
  List, 
  Check, 
  Copy,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Send,
  Trash2,
  User,
  Loader
} from 'lucide-react';
import hljs from 'highlight.js';
import { useToast } from '@/components/Toast';
import { Note } from '@/lib/notes';

// Copy Button Component for Code Blocks
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-md"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export default function ReadNote() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const categoryFolder = params.categoryFolder as string;
  const slug = params.slug as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  // Fetch session user on mount
  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Note Details
  useEffect(() => {
    if (!categoryFolder || !slug) return;

    fetch(`/api/notes/detail?categoryFolder=${categoryFolder}&slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          let fetchedNote = data.note;
          
          // Merge with localStorage favorites for guest view compatibility
          if (typeof window !== 'undefined') {
            const localFavs = JSON.parse(localStorage.getItem('devnotes-favorites') || '[]');
            if (localFavs.includes(fetchedNote.slug)) {
              fetchedNote = {
                ...fetchedNote,
                metadata: {
                  ...fetchedNote.metadata,
                  favorite: true
                }
              };
            }
          }
          
          setNote(fetchedNote);
          
          // Parse headings for Table of Contents
          const extracted = extractHeadings(data.note.content);
          setHeadings(extracted);
        } else {
          toast.error('Note not found.');
          router.push('/');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching note details:', err);
        toast.error('Failed to load note.');
        setLoading(false);
      });
  }, [categoryFolder, slug]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track Reading Scroll Progress
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const totalHeight = container.scrollHeight - container.clientHeight;
      if (totalHeight > 0) {
        const percent = (container.scrollTop / totalHeight) * 100;
        setScrollPercent(percent);
      }

      // Track active heading based on viewport position
      const headingsElements = headings.map(h => document.getElementById(h.id)).filter(Boolean);
      let currentActiveId = '';
      
      for (const el of headingsElements) {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160) {
            currentActiveId = el.id;
          }
        }
      }
      
      if (currentActiveId) {
        setActiveHeadingId(currentActiveId);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  // Extract headings from markdown content
  const extractHeadings = (text: string): HeadingItem[] => {
    const lines = text.split('\n');
    const headingList: HeadingItem[] = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].trim().replace(/[#*`[\]()]/g, '');
        // Create matching slugified ID
        const id = rawText
          .toLowerCase()
          .replace(/[\s_]+/g, '-')
          .replace(/[^\w-]/g, '');
          
        headingList.push({ id, text: rawText, level });
      }
    });

    return headingList;
  };

  // Toggle Pinned status
  const handleTogglePinned = async () => {
    if (!note) return;
    if (!isAdmin) {
      toast.error('Administrative access required to pin or favorite notes globally.');
      return;
    }
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
        setNote(data.note);
        toast.success(newPinned ? 'Note pinned!' : 'Note unpinned.');
      } else {
        toast.error(data.error || 'Failed to update note pinned state.');
      }
    } catch (e) {
      toast.error('Failed to toggle pin state.');
    }
  };

  // Toggle Favorite status
  const handleToggleFavorite = async () => {
    if (!note) return;
    
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
        
        setNote({
          ...note,
          metadata: {
            ...note.metadata,
            favorite: newFavorite
          }
        });
        toast.success(newFavorite ? 'Added to local favorites!' : 'Removed from local favorites.');
      } catch (e) {
        toast.error('Failed to save local favorite.');
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
        setNote(data.note);
        toast.success(newFavorite ? 'Added to favorites!' : 'Removed from favorites.');
      } else {
        toast.error(data.error || 'Failed to update note favorite state.');
      }
    } catch (e) {
      toast.error('Failed to toggle favorite state.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6 animate-pulse mt-8">
        <div className="h-6 bg-slate-800 rounded-lg w-1/4"></div>
        <div className="h-10 bg-slate-800 rounded-lg w-3/4"></div>
        <div className="flex gap-4">
          <div className="h-4 bg-slate-800 rounded-lg w-20"></div>
          <div className="h-4 bg-slate-800 rounded-lg w-24"></div>
        </div>
        <hr className="border-slate-850" />
        <div className="space-y-4">
          <div className="h-4 bg-slate-850 rounded-lg w-full"></div>
          <div className="h-4 bg-slate-850 rounded-lg w-5/6"></div>
          <div className="h-4 bg-slate-850 rounded-lg w-4/5"></div>
          <div className="h-32 bg-slate-900 rounded-xl w-full"></div>
        </div>
      </div>
    );
  }

  if (!note) return null;

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-app relative">
      {/* Dynamic Scroll Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-accent-app to-indigo-500 z-50 transition-all duration-75"
        style={{ width: `${scrollPercent}%` }}
      />

      {/* Navigation and Actions Fixed Header */}
      <header className="h-16 flex-shrink-0 bg-surface-app/80 backdrop-blur-md border-b border-border-app/40 px-6 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors border border-transparent hover:border-border-app"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted/60 font-semibold select-none">
            <Link href="/" className="hover:text-text-primary">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-text-muted truncate max-w-[120px]">{note.metadata.category}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Toggle Favorite */}
          <button
            onClick={handleToggleFavorite}
            className={`p-2.5 rounded-xl border transition-all ${
              note.metadata.favorite 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                : 'bg-surface-app border-border-app text-text-muted hover:text-text-primary'
            }`}
            title="Mark as Favorite"
          >
            <Heart className="w-4 h-4" />
          </button>

          {/* Toggle Pin */}
          <button
            onClick={handleTogglePinned}
            className={`p-2.5 rounded-xl border transition-all ${
              note.metadata.pinned 
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                : 'bg-surface-app border-border-app text-text-muted hover:text-text-primary'
            }`}
            title="Pin Note"
          >
            <Pin className="w-4 h-4" />
          </button>

          {/* Edit Note Button */}
          {isAdmin && (
            <Link
              href={`/modify/${note.categoryFolder}/${note.slug}`}
              className="p-2.5 sm:px-4 sm:py-2 bg-accent-app hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              title="Edit Note"
            >
              <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Edit Note</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main split canvas: Scrollable Content Pane + Fixed TOC Aside */}
      <div className="flex-1 flex flex-row overflow-hidden w-full">
        
        {/* Scrollable Reading Panel */}
        <div ref={scrollContainerRef} className="flex-grow overflow-y-auto h-full px-4 sm:px-6 py-6 sm:py-10">
          <div className="max-w-3xl mx-auto w-full">
            <article className="space-y-6 min-w-0">
              
              {/* Note Metadata Header */}
              <div className="space-y-4">
                <h1 className="text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
                  {note.metadata.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-text-muted select-none">
                  <span className="flex items-center gap-1.5 text-accent-app">
                    <BookOpen className="w-4 h-4" />
                    {note.metadata.category}
                  </span>
                  
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-text-muted/60" />
                    {note.readingTime} min read
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-text-muted/60" />
                    Last updated on {new Date(note.metadata.updatedDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {/* Tag Badges */}
                {note.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1.5 select-none">
                    {note.metadata.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className="text-[10px] text-accent-app flex items-center bg-accent-app/5 px-2.5 py-0.5 rounded-full border border-accent-app/10 font-bold"
                      >
                        <Hash className="w-3.5 h-3.5 mr-0.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-border-app/40 my-6" />

              {/* Render parsed Markdown with highlighted code custom renderers */}
              <div className="prose">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => {
                      const id = String(children).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                      return <h1 id={id}>{children}</h1>;
                    },
                    h2: ({ children }) => {
                      const id = String(children).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                      return <h2 id={id}>{children}</h2>;
                    },
                    h3: ({ children }) => {
                      const id = String(children).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                      return <h3 id={id}>{children}</h3>;
                    },
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeText = String(children).replace(/\n$/, '');
                      const isInline = !match;

                      if (!isInline) {
                        const lang = match[1];
                        let highlightedHtml = codeText;
                        try {
                          if (hljs.getLanguage(lang)) {
                            highlightedHtml = hljs.highlight(codeText, { language: lang }).value;
                          } else {
                            highlightedHtml = hljs.highlightAuto(codeText).value;
                          }
                        } catch (e) {
                          highlightedHtml = hljs.highlightAuto(codeText).value;
                        }
                        
                        return (
                          <div className="relative group my-5">
                            <pre className="!bg-black/35 !border !border-border-app/50 !rounded-2xl !p-3.5 sm:!p-5 overflow-x-auto">
                              <code 
                                className={`hljs ${className}`}
                                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                              />
                            </pre>
                            <CopyButton text={codeText} />
                          </div>
                        );
                      }

                      return (
                        <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded border border-border-app/40 text-accent-app font-mono" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {note.content}
                </ReactMarkdown>
              </div>

              {/* Experience Sharing Social Panel */}
              <CommentsSection noteSlug={note.slug} isAdmin={isAdmin} />
            </article>
          </div>
        </div>

        {/* Fixed Table of Contents (TOC) Aside */}
        <aside className="hidden lg:block w-64 flex-shrink-0 border-l border-border-app/25 h-full overflow-y-auto p-8 select-none">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex-item gap-1.5 mb-3 flex items-center">
              <List className="w-3.5 h-3.5 text-text-muted" />
              Table of Contents
            </h3>

            {headings.length === 0 ? (
              <p className="text-xs text-text-muted italic">No headings found in this document.</p>
            ) : (
              <div className="space-y-2 border-l border-border-app/55">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const element = document.getElementById(h.id);
                      if (element && scrollContainerRef.current) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`block text-xs py-1 transition-all pr-4 ${
                      h.level === 1 ? 'pl-4 font-bold' : h.level === 2 ? 'pl-7' : 'pl-10 text-[11px]'
                    } ${
                      activeHeadingId === h.id 
                        ? 'text-accent-app border-l border-accent-app -ml-px font-semibold' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

interface Comment {
  id: number;
  noteSlug: string;
  author: string;
  content: string;
  createdDate: string;
}

function CommentsSection({ noteSlug, isAdmin }: { noteSlug: string; isAdmin: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?noteSlug=${noteSlug}`);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [noteSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteSlug,
          author: isAdmin ? 'Admin' : author.trim() || 'Anonymous Developer',
          content: content.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setComments([data.comment, ...comments]);
        setContent('');
        toast.success('Experience shared successfully!');
      } else {
        toast.error(data.error || 'Failed to post comment.');
      }
    } catch (err) {
      toast.error('Connection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await fetch(`/api/comments?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setComments(comments.filter(c => c.id !== id));
        toast.success('Comment deleted.');
      } else {
        toast.error(data.error || 'Failed to delete comment.');
      }
    } catch (err) {
      toast.error('Failed to delete comment.');
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-border-app/40 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-app" />
          <span>Experience Sharing Board</span>
        </h3>
        <span className="text-xs text-text-muted font-bold bg-white/5 border border-border-app px-2.5 py-0.5 rounded-full">
          {comments.length} {comments.length === 1 ? 'experience' : 'experiences'}
        </span>
      </div>

      {/* Share Box Form */}
      <form onSubmit={handleSubmit} className="bg-surface-app/30 border border-border-app/40 rounded-2xl p-4 space-y-3.5 shadow-sm">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your interview tip, coding question, or custom experience here..."
          rows={3}
          disabled={submitting}
          className="w-full bg-black/20 border border-border-app/40 rounded-xl p-3 text-xs leading-relaxed text-text-primary placeholder-text-muted/40 focus:outline-none focus:border-accent-app/60 resize-none font-medium"
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {!isAdmin ? (
            <input
              type="text"
              placeholder="Your Name (e.g. Guest Developer)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={submitting}
              className="bg-black/20 border border-border-app/45 rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none focus:border-accent-app/60 max-w-[200px]"
            />
          ) : (
            <div className="text-[10px] text-emerald-450 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/15">
              Posting as Admin
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
          >
            {submitting ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Share Tip</span>
          </button>
        </div>
      </form>

      {/* Experience list */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-xs text-text-muted animate-pulse">
            Loading board logs...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted/50 border border-dashed border-border-app/30 rounded-xl">
            No experiences shared yet. Be the first to share your interview prep tip! ⚡
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const isCommentAdmin = comment.author.toLowerCase() === 'admin';
              const initial = comment.author ? comment.author.substring(0, 2).toUpperCase() : 'GD';

              return (
                <div 
                  key={comment.id}
                  className="bg-surface-app/20 hover:bg-surface-app/30 border border-border-app/40 rounded-2xl p-4 flex gap-4 transition-all shadow-sm relative group"
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                    isCommentAdmin 
                      ? 'bg-amber-500/10 border-2 border-amber-500/30 text-amber-400' 
                      : 'bg-accent-app/10 border border-accent-app/15 text-accent-app'
                  }`}>
                    {isCommentAdmin ? 'AD' : initial}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-text-primary leading-none">
                        {comment.author}
                      </span>
                      {isCommentAdmin && (
                        <span className="text-[8px] font-extrabold uppercase tracking-wider bg-amber-500/10 border border-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">
                          Creator
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted/60 font-medium">
                        {new Date(comment.createdDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-text-muted mt-2 leading-relaxed whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>

                  {/* Deletion scope for Admins */}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="absolute right-4 top-4 p-1 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                      title="Remove experience share log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
