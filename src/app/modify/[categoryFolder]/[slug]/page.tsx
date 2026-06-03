"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ArrowLeft, 
  Save, 
  Sparkles, 
  Terminal, 
  Database, 
  HelpCircle, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List as ListIcon, 
  Code,
  Hash,
  X,
  Eye,
  EyeOff,
  PenTool,
  Loader,
  Check,
  Copy,
  Pin,
  Heart
} from 'lucide-react';
import hljs from 'highlight.js';
import { useToast } from '@/components/Toast';
import { Note, Category } from '@/lib/notes';
import CategoryComboBox from '@/components/CategoryComboBox';
import EmojiPicker from '@/components/EmojiPicker';
import { convertHtmlToMarkdown } from '@/lib/pasteHelper';

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

export default function ModifyNote() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const originalCategoryFolder = params.categoryFolder as string;
  const originalSlug = params.slug as string;

  const [note, setNote] = useState<Note | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  // Editor States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [favorite, setFavorite] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [enableAutosave, setEnableAutosave] = useState(true);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<string | null>(null);

  // Mobile Tabbed view state
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch initial note values & Categories
  useEffect(() => {
    if (!originalCategoryFolder || !originalSlug) return;

    const loadData = async () => {
      try {
        // 1. Verify Admin credentials
        const authRes = await fetch('/api/auth');
        const authData = await authRes.json();
        if (!authData.success || authData.user?.role !== 'Admin') {
          setIsAdmin(false);
          toast.error('Administrative access required to edit notes.');
          router.push(`/read/${originalCategoryFolder}/${originalSlug}`);
          return;
        }
        setIsAdmin(true);

        // 2. Fetch categories
        const catRes = await fetch('/api/categories');
        const catData = await catRes.json();
        if (catData.success) {
          setCategories(catData.categories);
        }

        // 3. Fetch note details
        const noteRes = await fetch(`/api/notes/detail?categoryFolder=${originalCategoryFolder}&slug=${originalSlug}`);
        const noteData = await noteRes.json();
        
        if (noteData.success && noteData.note) {
          const n = noteData.note;
          setNote(n);
          setTitle(n.metadata.title);
          setCategory(n.metadata.category);
          setContent(n.content);
          setTags(n.metadata.tags || []);
          setPinned(!!n.metadata.pinned);
          setFavorite(!!n.metadata.favorite);
        } else {
          toast.error('Note not found.');
          router.push('/');
        }
      } catch (err) {
        console.error('Error fetching note edit details:', err);
        toast.error('Failed to load note details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [originalCategoryFolder, originalSlug]);

  // Periodic Auto-Save (Every 12 seconds)
  useEffect(() => {
    if (!note || !enableAutosave || !isAdmin) return;
    if (title === note.metadata.title && content === note.content && category === note.metadata.category && tags.length === (note.metadata.tags?.length || 0)) return;

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
      localStorage.setItem(`devnotes-draft-${originalSlug}`, JSON.stringify(draft));
      const now = new Date().toLocaleTimeString();
      setLastAutosaveTime(now);
      console.log('Draft auto-saved successfully at', now);
    }, 12000);

    return () => clearInterval(interval);
  }, [title, category, content, tags, pinned, favorite, note, enableAutosave, isAdmin]);

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
WHERE DepartmentID = 10;
\`\`\`
`;
      insertMarkdown(sqlTemplate);
    } else if (type === 'qa') {
      const qaTemplate = `
<div class="interview-q">
<h4>Q: Question heading</h4>
<strong>Answer:</strong>
Answer detail here
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

  // Save Note Changes
  const handleSaveChanges = async () => {
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCategoryFolder,
          originalSlug,
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
        toast.success('Changes saved successfully!');
        localStorage.removeItem(`devnotes-draft-${originalSlug}`);
        router.push(`/read/${data.note.categoryFolder}/${data.note.slug}`);
      } else {
        toast.error(data.error || 'Failed to save changes.');
      }
    } catch (e: any) {
      toast.error('Failed to update note: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || isAdmin === null) {
    return (
      <div className="flex-grow p-8 max-w-5xl mx-auto w-full space-y-6 animate-pulse mt-8 flex flex-col justify-center items-center h-64 gap-3 select-none">
        <Loader className="w-8 h-8 text-accent-app animate-spin" />
        <span className="text-xs text-text-muted">Loading note edit canvas...</span>
      </div>
    );
  }

  if (!note || !isAdmin) return null;

  return (
    <div className="flex-1 w-full bg-bg-app flex flex-col min-h-screen text-text-primary">
      
      {/* Sticky Header with Options */}
      <header className="px-6 py-4 border-b border-border-app/40 flex items-center justify-between bg-black/10 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/read/${originalCategoryFolder}/${originalSlug}`)}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors border border-transparent hover:border-border-app cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-none">Split Layout Editor</h1>
            <span className="text-[10px] text-text-muted font-medium">Editing: {note.metadata.title}</span>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-4">
          
          {/* Auto save status indicator */}
          <div className="hidden sm:flex items-center gap-2 select-none">
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Auto-save</span>
            <button
              onClick={() => {
                setEnableAutosave(!enableAutosave);
                toast.info(enableAutosave ? 'Draft auto-save disabled.' : 'Draft auto-save active.');
              }}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                enableAutosave ? 'bg-accent-app' : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-slate-155 transition-transform ${
                enableAutosave ? 'translate-x-3.5' : 'translate-x-0'
              }`} />
            </button>
            {lastAutosaveTime && enableAutosave && (
              <span className="text-[9px] text-text-muted flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent-app animate-pulse" />
                Saved: {lastAutosaveTime}
              </span>
            )}
          </div>

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
              <span className="hidden sm:inline">Pinned</span>
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

          {/* Save Button */}
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="p-2 sm:px-4 sm:py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Save Changes"
          >
            <Save className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Toggle Bar (Visible only on < lg viewports) */}
      <div className="flex lg:hidden bg-black/20 border-b border-border-app/40 px-4 py-2 select-none justify-center gap-4 shrink-0 text-xs font-bold">
        <button
          onClick={() => setMobileTab('write')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'write'
              ? 'bg-accent-app/10 text-accent-app'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Write / Edit</span>
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'preview'
              ? 'bg-accent-app/10 text-accent-app'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Preview</span>
        </button>
      </div>

      {/* Editor Split Canvas Container */}
      <div className="flex-grow flex flex-col lg:flex-row h-[calc(100vh-108px)] lg:h-[calc(100vh-69px)] overflow-hidden w-full relative">
        
        {/* Left Side: Writing Canvas */}
        <div className={`w-full lg:w-1/2 flex flex-col border-r border-border-app/40 bg-surface-app/[0.02] h-full overflow-hidden ${
          mobileTab === 'write' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Metadata Block inputs */}
          <div className="p-5 border-b border-border-app/40 space-y-4 shrink-0">
            <div className="flex items-center gap-3">
              <EmojiPicker onSelectEmoji={(emoji) => setTitle(prev => `${emoji} ${prev}`)} />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of your note..."
                className="w-full bg-transparent border-none text-text-primary placeholder-text-muted/40 text-lg font-bold focus:outline-none focus:ring-0 p-0"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Category</label>
                <CategoryComboBox
                  value={category}
                  onChange={setCategory}
                  categories={categories}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Tags (Press Enter)</label>
                <div className="w-full bg-surface-app border border-border-app/60 rounded-xl px-2 py-1.5 flex items-center gap-1.5 flex-wrap min-h-[38px]">
                  {tags.map((tag, idx) => (
                    <span key={idx} className="text-[9px] text-accent-app flex items-center bg-accent-app/5 px-2 py-0.5 rounded-md border border-accent-app/10">
                      <Hash className="w-2.5 h-2.5 mr-0.5" />
                      {tag}
                      <button type="button" onClick={() => removeTag(idx)} className="ml-1 text-text-muted hover:text-red-400">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder={tags.length === 0 ? "lifetime, indexing..." : ""}
                    className="flex-1 bg-transparent border-none text-xs text-text-primary focus:outline-none focus:ring-0 p-0 min-w-[70px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="px-4 py-2 border-b border-border-app/40 bg-black/10 flex flex-wrap items-center gap-1 shrink-0 select-none">
            <button onClick={() => insertMarkdown('**', '**')} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 cursor-pointer" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('*', '*')} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 cursor-pointer" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('## ', '\n')} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 cursor-pointer" title="Heading"><Heading1 className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('- ', '\n')} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 cursor-pointer" title="List"><ListIcon className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('```\n', '\n```')} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 cursor-pointer" title="Code"><Code className="w-3.5 h-3.5" /></button>
            
            <div className="h-4 w-px bg-border-app/60 mx-1" />
            
            <button onClick={() => injectTemplate('di')} className="px-2 py-0.5 text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/25 flex items-center gap-0.5 cursor-pointer">
              <Terminal className="w-3 h-3" /> .NET DI
            </button>
            <button onClick={() => injectTemplate('sql')} className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/25 flex items-center gap-0.5 cursor-pointer">
              <Database className="w-3 h-3" /> SQL
            </button>
            <button onClick={() => injectTemplate('qa')} className="px-2 py-0.5 text-[9px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded hover:bg-purple-500/25 flex items-center gap-0.5 cursor-pointer">
              <HelpCircle className="w-3 h-3" /> Q&A
            </button>
          </div>

          {/* Editor Textarea */}
          <div className="flex-1 overflow-hidden relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Edit note markdown..."
              className="w-full h-full bg-transparent border-none text-sm leading-relaxed text-text-primary placeholder-text-muted/40 focus:outline-none focus:ring-0 p-5 resize-none font-mono overflow-y-auto"
            />
          </div>
        </div>

        {/* Right Side: Real-Time Live Preview */}
        <div className={`w-full lg:w-1/2 flex flex-col bg-black/10 h-full overflow-hidden ${
          mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Preview Title bar */}
          <div className="px-5 py-3 border-b border-border-app/40 bg-black/20 shrink-0 select-none flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Live Document Preview</span>
            <span className="text-[10px] text-accent-app flex items-center gap-1 font-bold">
              <Eye className="w-3.5 h-3.5 animate-pulse" /> Synchronized
            </span>
          </div>

          {/* Preview Panel body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 prose">
            <h1 className="text-xl md:text-2xl font-bold text-text-primary border-none pb-0 mt-0">{title || 'Untitled Note'}</h1>
            <div className="text-[9px] font-bold text-text-muted bg-white/5 border border-border-app px-2 py-0.5 rounded w-max mt-2">
              {category || 'Uncategorized'}
            </div>
            <hr className="my-4 border-border-app/40" />
            
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
                    <code className="text-xs bg-white/5 px-1 py-0.5 rounded border border-border-app/40 text-accent-app font-mono" {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

      </div>
    </div>
  );
}
