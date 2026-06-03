"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, 
  ArrowLeft, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  Code, 
  HelpCircle,
  Database,
  Terminal,
  Hash,
  X,
  Loader,
  PenTool,
  Check,
  Copy,
  Pin,
  Heart
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Category } from '@/lib/notes';
import CategoryComboBox from '@/components/CategoryComboBox';
import EmojiPicker from '@/components/EmojiPicker';
import { convertHtmlToMarkdown } from '@/lib/pasteHelper';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js';
import remarkGfm from 'remark-gfm';

const PreContext = React.createContext(false);

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
      className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-slate-100 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all duration-150"
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

function AddNoteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  // AI states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState<{ title: string; content: string; tags: string[] } | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // Mobile Tabbed view state
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Authenticate Admin on mount & Fetch Categories
  useEffect(() => {
    const loadInitData = async () => {
      try {
        const authRes = await fetch('/api/auth');
        const authData = await authRes.json();
        if (!authData.success || authData.user?.role !== 'Admin') {
          setIsAdmin(false);
          toast.error('Administrative access required to create notes.');
          router.push('/');
          return;
        }
        setIsAdmin(true);

        const catRes = await fetch('/api/categories');
        const catData = await catRes.json();
        if (catData.success && catData.categories) {
          setCategories(catData.categories);
          
          // Pre-select category if passed in URL query param
          const catParam = searchParams.get('category');
          if (catParam) {
            const matched = catData.categories.find(
              (c: Category) => c.slug === catParam || c.name.toLowerCase() === catParam.toLowerCase()
            );
            if (matched) {
              setCategory(matched.name);
            }
          }
        }
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
        router.push('/');
      }
    };

    loadInitData();
  }, [searchParams]);

  // Check for auto-saved drafts on mount
  useEffect(() => {
    if (isAdmin) {
      const savedDraft = localStorage.getItem('devnotes-draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.title || parsed.content || parsed.category) {
            setShowDraftBanner(true);
          }
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      }
    }
  }, [isAdmin]);

  // Periodic Auto-Save (Every 10 seconds)
  useEffect(() => {
    if (!isAdmin) return;
    if (!title && !content && !category && tags.length === 0) return;

    const interval = setInterval(() => {
      const draft = {
        title,
        category,
        content,
        tags,
        pinned,
        favorite,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('devnotes-draft', JSON.stringify(draft));
    }, 10000);

    return () => clearInterval(interval);
  }, [title, category, content, tags, pinned, favorite, isAdmin]);

  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem('devnotes-draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setTitle(parsed.title || '');
        setCategory(parsed.category || '');
        setContent(parsed.content || '');
        setTags(parsed.tags || []);
        setPinned(!!parsed.pinned);
        setFavorite(!!parsed.favorite);
        toast.info('Draft restored successfully!');
      } catch (e) {
        toast.error('Failed to restore draft.');
      }
    }
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem('devnotes-draft');
    setShowDraftBanner(false);
    toast.info('Draft discarded.');
  };

  // AI Note Generator Handler (uses explicit prompt, prompt input, or Title as fallback)
  const handleAiGenerate = async (explicitPrompt?: string) => {
    const promptSource = explicitPrompt || aiPrompt || title;
    
    if (!promptSource.trim()) {
      toast.error('Please type a prompt in the AI Assistant panel or enter a title first!');
      return;
    }

    setAiGenerating(true);
    toast.info('AI is drafting professional interview notes... 🚀');

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptSource.trim(),
          category: category || 'General'
        })
      });

      const data = await res.json();

      if (data.success) {
        setAiDraft({
          title: data.title,
          content: data.content,
          tags: data.tags || []
        });
        setShowAiPreview(true);
        toast.success('AI Draft completed! Review your changes.');
      } else {
        toast.error(data.error || 'Failed to generate note.');
      }
    } catch (e: any) {
      toast.error('AI generation failed: ' + e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  // Insert markdown helpers
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const selectedText = text.substring(start, end);
    const replacement = before + selectedText + after;
    
    setContent(text.substring(0, start) + replacement + text.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 50);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const markdown = convertHtmlToMarkdown(html);
      
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const newVal = text.substring(0, start) + markdown + text.substring(end);
      setContent(newVal);

      const newCursorPos = start + markdown.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Inject templates
  const injectTemplate = (type: 'di' | 'sql' | 'qa') => {
    if (type === 'di') {
      const diTemplate = `
\`\`\`csharp
public interface IMessageService
{
    void SendMessage(string msg);
}

public class EmailMessageService : IMessageService
{
    public void SendMessage(string msg) => Console.WriteLine($"Email sent: {msg}");
}
\`\`\`
`;
      insertMarkdown(diTemplate);
    } else if (type === 'sql') {
      const sqlTemplate = `
\`\`\`sql
SELECT EmployeeID, FirstName, LastName
FROM Employees
WHERE DepartmentID = 10
ORDER BY Salary DESC;
\`\`\`
`;
      insertMarkdown(sqlTemplate);
    } else if (type === 'qa') {
      const qaTemplate = `
<div class="interview-q">
<h4>Q: Question title?</h4>
<strong>Answer:</strong>
Clear explanation here.
</div>
`;
      insertMarkdown(qaTemplate);
    }
    toast.info('Template injected!');
  };

  // Tag Handling
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, i) => i !== indexToRemove));
  };

  // Submit Handler
  const handleSaveNote = async () => {
    if (!title.trim()) {
      toast.error('Title is required!');
      return;
    }
    if (!category) {
      toast.error('Please select a category!');
      return;
    }
    if (!content.trim()) {
      toast.error('Content is required!');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          content: content.trim(),
          tags,
          pinned,
          favorite
        })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Note saved successfully!');
        localStorage.removeItem('devnotes-draft');
        router.push(`/read/${data.note.categoryFolder}/${data.note.slug}`);
      } else {
        toast.error(data.error || 'Failed to save note.');
      }
    } catch (e: any) {
      toast.error('An error occurred: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex-1 w-full bg-bg-app flex flex-col min-h-screen justify-center items-center gap-3 select-none">
        <Loader className="w-8 h-8 text-accent-app animate-spin" />
        <span className="text-xs text-text-muted">Initializing writing workspace...</span>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex-1 w-full bg-bg-app flex flex-col min-h-screen text-text-primary">
      
      {/* AI Generating Overlay */}
      <AnimatePresence>
        {aiGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center select-none"
          >
            <div className="text-center space-y-4 flex flex-col items-center">
              <Loader className="w-10 h-10 text-accent-app animate-spin" />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-100 text-lg">AI Assistant Drafting...</h3>
                <p className="text-sm text-text-muted max-w-sm px-4">
                  Researching topic details, constructing code snippets, and organizing interview Q&A blocks...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft banner */}
      <AnimatePresence>
        {showDraftBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-accent-app/10 border-b border-accent-app/20 text-accent-app p-3 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold select-none"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 animate-pulse" />
              Unsaved draft detected! Would you like to restore your last session?
            </span>
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={handleRestoreDraft}
                className="px-3 py-1 bg-accent-app hover:opacity-90 text-white rounded-md transition-all cursor-pointer font-bold"
              >
                Restore
              </button>
              <button 
                onClick={handleDiscardDraft}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-705 text-slate-300 rounded-md transition-all cursor-pointer"
              >
                Discard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Header */}
      <header className="px-6 py-4 border-b border-border-app/40 flex items-center justify-between bg-black/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors border border-transparent hover:border-border-app cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-none font-sans">Distraction-Free Editor</h1>
            <span className="text-[10px] text-text-muted font-medium">Auto-save is active</span>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary bg-surface-app border border-border-app transition-all flex items-center gap-1.5 cursor-pointer"
            title={isPreview ? "Switch to Write Mode" : "Switch to Preview Mode"}
          >
            {isPreview ? (
              <>
                <EyeOff className="w-4 h-4 text-text-muted" />
                <span className="hidden sm:inline">Write Mode</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-text-muted" />
                <span className="hidden sm:inline">Preview Mode</span>
              </>
            )}
          </button>

          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setPinned(!pinned)}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold cursor-pointer flex items-center gap-1 ${
                pinned 
                  ? 'bg-indigo-650/10 border-indigo-500/30 text-indigo-400 font-bold' 
                  : 'bg-surface-app border-border-app text-text-muted hover:text-text-primary'
              }`}
              title="Pin Note"
            >
              <Pin className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Pin Note</span>
            </button>
            <button
              onClick={() => setFavorite(!favorite)}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold cursor-pointer flex items-center gap-1 ${
                favorite 
                  ? 'bg-rose-650/10 border-rose-500/30 text-rose-455 font-bold' 
                  : 'bg-surface-app border-border-app text-text-muted hover:text-text-primary'
              }`}
              title="Mark as Favorite"
            >
              <Heart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Favorite</span>
            </button>
          </div>

          <button
            onClick={handleSaveNote}
            disabled={saving}
            className="p-2 sm:px-4 sm:py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Save Note"
          >
            <Save className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Note'}</span>
          </button>
        </div>
      </header>

      {/* Mobile viewports tab switcher */}
      <div className="flex lg:hidden bg-black/20 border-b border-border-app/40 px-4 py-2 select-none justify-center gap-4 shrink-0 text-xs font-bold">
        <button
          onClick={() => setMobileTab('write')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'write' ? 'bg-accent-app/10 text-accent-app' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Write / Edit</span>
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'preview' ? 'bg-accent-app/10 text-accent-app' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Preview</span>
        </button>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-grow overflow-y-auto px-6 py-6 md:py-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
        
        {/* Left writing panel on mobile Tab */}
        <div className={`flex-col gap-6 flex-1 w-full ${
          mobileTab === 'write' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Collapsible AI Copilot Panel */}
          <div className="glass-panel p-4 rounded-2xl border border-border-app/50 bg-surface-app/35 space-y-3 shadow-md">
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className="w-full flex items-center justify-between font-bold text-xs text-text-primary hover:text-accent-app transition-colors select-none cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-app animate-pulse" />
                <span>AI Writer Copilot</span>
              </span>
              <span className="text-[9px] font-extrabold text-text-muted hover:text-text-primary bg-white/5 border border-border-app px-2 py-0.5 rounded-lg select-none">
                {isAiPanelOpen ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {isAiPanelOpen && (
              <div className="pt-2.5 space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block select-none">Describe the topic you want the AI to draft</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., Explain C# Dependency Injection lifecycles (Transient, Scoped, Singleton) with a detailed code demo, or Explain SQL Index seeks vs scans with covering index optimizations..."
                    rows={2}
                    className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 rounded-xl p-3 text-xs leading-relaxed text-text-primary placeholder-text-muted/40 focus:outline-none resize-none font-medium"
                  />
                </div>
                
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[9px] text-text-muted/65 italic leading-none select-none">
                    Uses official Gemini 1.5 Flash to automatically write rich notes, code demos, and Q&As.
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => handleAiGenerate()}
                    className="px-4 py-2 bg-accent-app hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Draft</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Title input with AI Drafting Button */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border-app/30 pb-2">
              <EmojiPicker onSelectEmoji={(emoji) => setTitle(prev => `${emoji} ${prev}`)} />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your note a title... (e.g. Clustered vs Non-Clustered Indexes)"
                className="flex-1 bg-transparent border-none text-text-primary placeholder-text-muted/40 text-xl md:text-2xl font-extrabold focus:outline-none focus:ring-0 p-0"
              />
              
              {title.trim().length > 2 && (
                <button
                  onClick={() => handleAiGenerate()}
                  className="px-3.5 py-1.5 bg-accent-app/10 border border-accent-app/20 text-accent-app hover:bg-accent-app/20 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-md"
                  title="Ask AI to automatically draft the study note content for this title!"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>✨ Auto-Draft</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Category Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Category</label>
                <CategoryComboBox
                  value={category}
                  onChange={setCategory}
                  categories={categories}
                />
              </div>

              {/* Tags Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Tags</label>
                <div className="w-full bg-surface-app border border-border-app rounded-xl p-2 flex items-center gap-2 flex-wrap min-h-[46px]">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] text-accent-app flex items-center bg-accent-app/5 px-2.5 py-0.5 rounded-md border border-accent-app/10">
                      <Hash className="w-2.5 h-2.5 mr-0.5" />
                      {tag}
                      <button type="button" onClick={() => removeTag(idx)} className="ml-1 text-text-muted hover:text-red-455 cursor-pointer">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder={tags.length === 0 ? "lifetimes, B-Tree, indexes" : ""}
                    className="flex-1 bg-transparent border-none text-xs text-text-primary focus:outline-none focus:ring-0 p-0 min-w-[80px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Markdown Toolbar */}
          {!isPreview && (
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-black/10 border border-border-app/40 rounded-xl shrink-0">
              <button onClick={() => insertMarkdown('**', '**')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="Bold"><Bold className="w-4 h-4" /></button>
              <button onClick={() => insertMarkdown('*', '*')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="Italic"><Italic className="w-4 h-4" /></button>
              <button onClick={() => insertMarkdown('# ', '\n')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="H1 Header"><Heading1 className="w-4 h-4" /></button>
              <button onClick={() => insertMarkdown('## ', '\n')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="H2 Header"><Heading2 className="w-4 h-4" /></button>
              <button onClick={() => insertMarkdown('- ', '\n')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="Bullet List"><List className="w-4 h-4" /></button>
              <button onClick={() => insertMarkdown('```\n', '\n```')} className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg cursor-pointer" title="Code Block"><Code className="w-4 h-4" /></button>
              
              <div className="h-6 w-px bg-border-app/40 mx-1" />
              
              {/* Quick Templates */}
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1">Templates:</span>
              <button onClick={() => injectTemplate('di')} className="px-2.5 py-1 text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all flex items-center gap-1 cursor-pointer">
                <Terminal className="w-3.5 h-3.5" />
                <span>.NET DI</span>
              </button>
              <button onClick={() => injectTemplate('sql')} className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer">
                <Database className="w-3.5 h-3.5" />
                <span>SQL Query</span>
              </button>
              <button onClick={() => injectTemplate('qa')} className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-all flex items-center gap-1 cursor-pointer">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Interview Q&A</span>
              </button>
            </div>
          )}

          {/* Text Area Writing Canvas */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Draft your study notes here using markdown... Or write a Title above and click '✨ Auto-Draft' to instantly generate high-quality notes!"
              className="flex-grow w-full bg-black/10 border border-border-app focus:border-accent-app/60 rounded-2xl p-5 text-sm leading-relaxed text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 resize-none font-mono min-h-[350px]"
            />
          </div>
        </div>

        {/* Right Preview Panel on mobile Tab */}
        <div className={`flex-col bg-black/10 p-5 rounded-2xl border border-border-app/40 prose flex-1 w-full ${
          mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
        }`}>
          <h2 className="text-xl font-bold text-text-primary border-none pb-0 mt-0">{title || 'Untitled Note'}</h2>
          <div className="text-[10px] font-bold text-text-muted bg-white/5 border border-border-app px-2 py-0.5 rounded w-max mt-2 uppercase tracking-wider">
            {category || 'Uncategorized'}
          </div>
          <hr className="my-4 border-border-app/40" />
          <div className="leading-relaxed text-sm text-text-muted">
            {content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => {
                    const id = String(children).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                    return <h1 id={id}>{children}</h1>;
                  },
                  h2: ({ children }) => {
                    const id = String(children).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                    return <h2 id={id}>{children}</h2>;
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-xl border border-border-app/40 bg-black/5">
                      <table className="min-w-full divide-y divide-border-app/40">
                        {children}
                      </table>
                    </div>
                  ),
                  pre: ({ children }) => {
                    return (
                      <PreContext.Provider value={true}>
                        {children}
                      </PreContext.Provider>
                    );
                  },
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeText = String(children).replace(/\n$/, '');
                    const inPre = React.useContext(PreContext);

                    if (inPre) {
                      const lang = match ? match[1] : 'text';
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
                        <div className="relative group my-4 rounded-xl overflow-hidden bg-[#090d16] border border-border-app/50 shadow-md">
                          <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/10">
                            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider font-mono">{lang}</span>
                            <CopyButton text={codeText} />
                          </div>
                          <pre className="p-4 max-h-[350px] overflow-y-auto text-xs text-text-primary/90 font-mono whitespace-pre-wrap break-all overflow-x-hidden">
                            <code 
                              className={`hljs ${className || ''}`}
                              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                            />
                          </pre>
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
                {content}
              </ReactMarkdown>
            ) : (
              <p className="italic text-xs text-text-muted/50">
                *No content drafted yet. Type a note title above and trigger AI Auto-Draft to write note instantly...*
              </p>
            )}
          </div>
        </div>

      </div>

      {/* AI Generated Draft Preview Modal */}
      <AnimatePresence>
        {showAiPreview && aiDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl max-h-[85vh] bg-surface-app border border-border-app/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border-app/40 bg-black/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-accent-app animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-sm text-text-primary">Review Generated AI Draft</h3>
                    <span className="text-[10px] text-text-muted">Accept changes to apply to your editor, or discard.</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowAiPreview(false);
                    setAiDraft(null);
                    toast.info('AI draft preview closed.');
                  }}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Draft Preview Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-black/5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block select-none">Generated Title</label>
                  <h1 className="text-xl font-extrabold text-text-primary">{aiDraft.title}</h1>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block select-none">Generated Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {aiDraft.tags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] text-accent-app bg-accent-app/5 px-2.5 py-0.5 rounded-md border border-accent-app/10 font-semibold select-none">
                        <Hash className="w-2.5 h-2.5 mr-0.5 inline-block -mt-0.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border-app/40 pt-4">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block select-none">Generated Note Content (Markdown)</label>
                  <div className="bg-black/20 border border-border-app/40 rounded-xl p-4 overflow-x-auto font-mono text-xs leading-relaxed max-h-[300px] text-text-primary whitespace-pre-wrap">
                    {aiDraft.content}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 border-t border-border-app/40 bg-black/10 flex items-center justify-end gap-3 select-none">
                <button
                  onClick={() => {
                    setShowAiPreview(false);
                    setAiDraft(null);
                    toast.info('AI draft discarded.');
                  }}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Discard Draft</span>
                </button>

                <button
                  onClick={() => {
                    setTitle(aiDraft.title);
                    setContent(aiDraft.content);
                    const mergedTags = Array.from(new Set([...tags, ...aiDraft.tags]));
                    setTags(mergedTags);
                    setShowAiPreview(false);
                    setAiDraft(null);
                    toast.success('AI draft successfully applied to editor!');
                  }}
                  className="px-5 py-2.5 bg-emerald-500 hover:opacity-90 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-100" />
                  <span>Allow Changes (Apply)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main page export wrapped in Suspense boundary
export default function AddNote() {
  return (
    <Suspense fallback={
      <div className="flex-1 w-full bg-bg-app flex flex-col min-h-screen justify-center items-center gap-3 select-none">
        <Loader className="w-8 h-8 text-accent-app animate-spin" />
        <span className="text-xs text-text-muted">Initializing writing workspace...</span>
      </div>
    }>
      <AddNoteContent />
    </Suspense>
  );
}
