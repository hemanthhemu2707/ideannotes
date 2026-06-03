"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquareCode, 
  Send, 
  Trash2, 
  Sparkles, 
  User, 
  Loader, 
  Check, 
  Copy, 
  Code,
  ArrowRight,
  Database,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
  Bookmark
} from 'lucide-react';
import { useToast } from '@/components/Toast';

const PreContext = React.createContext(false);

// Code Copy Button helper
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

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const TOPICS = [
  { id: 'General', name: 'General Doubt', icon: HelpCircle, color: 'text-indigo-400 bg-indigo-500/10' },
  { id: 'dotnet', name: 'C# / .NET Core', icon: Code, color: 'text-purple-400 bg-purple-500/10' },
  { id: 'sql', name: 'SQL Database', icon: Database, color: 'text-emerald-400 bg-emerald-500/10' },
  { id: 'react', name: 'React / Next.js', icon: Layers, color: 'text-sky-400 bg-sky-500/10' },
  { id: 'system-design', name: 'System Design', icon: Zap, color: 'text-amber-400 bg-amber-500/10' }
];

const SUGGESTIONS = [
  { text: 'Explain Transient vs Scoped vs Singleton with lifetime examples.', topic: 'dotnet' },
  { text: 'How do Clustered vs Non-Clustered indexes look in a B-Tree structure?', topic: 'sql' },
  { text: 'What is a captive dependency in .NET DI container, and how do we resolve it?', topic: 'dotnet' },
  { text: 'Explain React 19 Server Actions vs standard client-side API fetches.', topic: 'react' },
  { text: 'How do you design a Mutex lock caching strategy to prevent cache stampede?', topic: 'system-design' }
];

export default function DoubtSolverChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('General');
  const [loading, setLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ username: string; email: string; role?: string } | null>(null);
  const [savingNoteIdx, setSavingNoteIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Load session & restore chat from local session storage if available
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.success && data.user) {
          setSessionUser(data.user);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSession();

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('doubt-solver-thread');
      if (stored) {
        try {
          const parsed = JSON.parse(stored).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(parsed);
        } catch {
          // ignore error
        }
      }
    }
  }, []);

  // Sync scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('doubt-solver-thread', JSON.stringify(messages));
    }
  }, [messages]);

  // Save Bot Answer as a Study Note (Admin only)
  const handleSaveAsNote = async (text: string, index: number) => {
    if (!sessionUser || sessionUser.role !== 'Admin') {
      toast.error('Administrative access required to save study notes.');
      return;
    }

    setSavingNoteIdx(index);

    try {
      // Find the user query that prompted this answer
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const userQuery = prevMsg && prevMsg.role === 'user' ? prevMsg.text : '';
      
      // Generate clean title from the user query
      const cleanQuery = userQuery.trim().replace(/[?#*`[\]()]/g, '');
      const titleExcerpt = cleanQuery.length > 50 ? cleanQuery.slice(0, 47) + '...' : cleanQuery;
      const noteTitle = titleExcerpt ? `AI Doubt: ${titleExcerpt}` : `AI Doubt Note (${selectedTopic})`;

      // Map topic to standard category slug
      let categorySlug = 'general';
      if (selectedTopic === 'dotnet') categorySlug = 'dotnet-core';
      else if (selectedTopic === 'sql') categorySlug = 'sql';
      else if (selectedTopic === 'react') categorySlug = 'react';
      else if (selectedTopic === 'system-design') categorySlug = 'system-design';

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          category: categorySlug,
          content: text.trim(),
          tags: ['AI Doubt', selectedTopic],
          pinned: false,
          favorite: false
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully saved as study note under '${categorySlug}'! 📝`);
      } else {
        toast.error(data.error || 'Failed to save note.');
      }
    } catch (e: any) {
      toast.error('Error saving study note: ' + e.message);
    } finally {
      setSavingNoteIdx(null);
    }
  };

  // Trigger Send Message
  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || input).trim();
    if (!query || loading) return;

    const userMessage: Message = {
      role: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Map state history to endpoint format
      const historyPayload = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          history: historyPayload,
          topic: selectedTopic
        })
      });

      const data = await res.json();
      if (data.success && data.text) {
        const botMessage: Message = {
          role: 'model',
          text: data.text,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        toast.error(data.error || 'The Doubt Solver AI was unable to process your request.');
      }
    } catch {
      toast.error('Network failure. Please inspect connection to Gemini engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearThread = () => {
    if (messages.length === 0) return;
    if (!window.confirm('Are you sure you want to clear this entire conversational thread?')) return;
    setMessages([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('doubt-solver-thread');
    }
    toast.success('Thread history successfully reset.');
  };

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full max-w-5xl mx-auto p-3 sm:p-5 select-none relative">
      
      {/* Decorative background blur */}
      <div className="absolute top-10 left-1/3 w-80 h-80 rounded-full bg-accent-app/5 blur-[90px] pointer-events-none" />

      {/* Glassmorphic Header */}
      <div className="glass-panel p-4 rounded-2xl border border-border-app flex items-center justify-between shadow-lg mb-4 shrink-0 bg-surface-app/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-app/10 border border-accent-app/15 flex items-center justify-center text-accent-app shadow-inner">
            <MessageSquareCode className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-text-primary flex items-center gap-1.5 leading-none">
              Doubt Solver AI
              <span className="text-[9px] font-extrabold uppercase bg-accent-app/10 border border-accent-app/15 text-accent-app px-2 py-0.5 rounded-full tracking-wider flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                Gemini 2.5
              </span>
            </h1>
            <p className="text-[10px] md:text-xs text-text-muted mt-1 font-medium leading-none">
              Chat globally with our Senior Software Architect & Mentor.
            </p>
          </div>
        </div>

        <button
          onClick={handleClearThread}
          disabled={messages.length === 0}
          className="p-2.5 rounded-xl border border-border-app hover:bg-red-500/10 hover:border-red-500/20 text-text-muted hover:text-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-border-app disabled:hover:text-text-muted cursor-pointer transition-all"
          title="Clear Thread History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Topic selection chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1.5 scrollbar-none shrink-0 select-none">
        {TOPICS.map(topic => {
          const Icon = topic.icon;
          const isSelected = selectedTopic === topic.id;
          return (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                isSelected 
                  ? 'bg-accent-app border-accent-app text-white shadow-md shadow-accent-app/10 scale-102' 
                  : 'bg-surface-app/30 border-border-app/50 text-text-muted hover:text-text-primary hover:border-border-app'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : topic.color.split(' ')[0]}`} />
              <span>{topic.name}</span>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Log Area */}
      <div className="flex-1 glass-panel border border-border-app/40 rounded-2xl p-4 sm:p-5 overflow-y-auto mb-4 bg-surface-app/10 shadow-inner flex flex-col space-y-5 scrollbar-thin">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 sm:p-12 space-y-6 max-w-md mx-auto my-auto select-none">
            <div className="w-16 h-16 rounded-2xl bg-accent-app/5 border border-accent-app/10 flex items-center justify-center text-accent-app shadow-lg shadow-accent-app/[0.02]">
              <Sparkles className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-sm sm:text-base font-extrabold text-text-primary">
                Resolve Your Engineering Doubts Instantly
              </h2>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Our senior architect is ready. Select a topic category and type a question, or pick one of these popular revision prompts below:
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-2">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedTopic(s.topic);
                    handleSendMessage(s.text);
                  }}
                  className="w-full p-3 bg-surface-app/40 hover:bg-surface-app/60 border border-border-app/60 rounded-xl text-left text-xs font-bold text-text-muted hover:text-accent-app flex items-center justify-between group transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <span className="truncate pr-4">{s.text}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted/40 group-hover:text-accent-app group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Bubble Logs */
          <>
            {messages.map((msg, idx) => {
              const isBot = msg.role === 'model';
              const initial = isBot ? 'AI' : (sessionUser?.username?.substring(0, 2).toUpperCase() || 'ME');
              return (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${isBot ? 'self-start' : 'self-end flex-row-reverse'}`}
                >
                  {/* Bubble Avatar */}
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-[10px] shadow-sm select-none border ${
                    isBot 
                      ? 'bg-accent-app/15 border-accent-app/20 text-accent-app' 
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}>
                    {initial}
                  </div>

                  {/* Bubble Box */}
                  <div className="space-y-1 w-full">
                    <div className={`flex items-center justify-between gap-3 text-[10px] text-text-muted select-none ${!isBot && 'flex-row-reverse'}`}>
                      <div className={`flex items-center gap-1.5 ${!isBot && 'flex-row-reverse'}`}>
                        <span className="font-extrabold text-text-primary/95">{isBot ? 'Doubt Solver AI' : (sessionUser?.username || 'You')}</span>
                        <span>•</span>
                        <span>
                          {msg.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {isBot && sessionUser?.role === 'Admin' && (
                        <button
                          onClick={() => handleSaveAsNote(msg.text, idx)}
                          disabled={savingNoteIdx !== null}
                          className="flex items-center gap-1 px-2 py-0.5 bg-accent-app/10 hover:bg-accent-app/20 border border-accent-app/15 hover:border-accent-app/30 text-accent-app rounded-md transition-all cursor-pointer font-bold select-none text-[9px] hover:scale-102 active:scale-98 shadow-sm"
                          title="Save this answer as a key study note in your library"
                        >
                          {savingNoteIdx === idx ? (
                            <>
                              <Loader className="w-2.5 h-2.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-2.5 h-2.5 text-accent-app" />
                              <span>Save as Study Note</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className={`rounded-2xl p-3.5 text-xs leading-relaxed border ${
                      isBot 
                        ? 'bg-surface-app/40 border-border-app/50 text-text-primary/95' 
                        : 'bg-accent-app/10 border-accent-app/20 text-text-primary'
                    }`}>
                      {isBot ? (
                        /* Rich Markdown parser for Bot responses */
                        <div className="prose prose-chat">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-4 rounded-xl border border-border-app/40 bg-black/10">
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
                                    <div className="relative group my-4 rounded-xl overflow-hidden bg-black/35 border border-border-app/40 shadow-md">
                                      <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/10">
                                        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider font-mono">{lang}</span>
                                        <CopyButton text={codeText} />
                                      </div>
                                      <pre className="p-3 max-h-[300px] overflow-y-auto text-xs text-text-primary/95 font-mono whitespace-pre-wrap break-all overflow-x-hidden">
                                        <code 
                                          className={`hljs ${className || ''}`}
                                          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                                        />
                                      </pre>
                                    </div>
                                  );
                                }

                                return (
                                  <code className="bg-black/20 text-accent-app font-bold font-mono px-1.5 py-0.5 rounded border border-border-app/40">
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Processing State Bubble indicator */}
            {loading && (
              <div className="flex gap-3 max-w-[80%] self-start">
                <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-[10px] bg-accent-app/15 border border-accent-app/20 text-accent-app shadow-sm select-none">
                  AI
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted select-none">
                    <span className="font-extrabold text-text-primary/95 font-sans">Doubt Solver AI</span>
                    <span>•</span>
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                  <div className="bg-surface-app/40 border border-border-app/50 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader className="w-3.5 h-3.5 text-accent-app animate-spin" />
                    <span className="text-[11px] text-text-muted font-bold font-sans">Synthesizing solution...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Interactive suggestions chips (Quick triggers while active) */}
      {messages.length > 0 && !loading && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 shrink-0 select-none scrollbar-none">
          {SUGGESTIONS.filter(s => s.topic === selectedTopic || selectedTopic === 'General').map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s.text)}
              className="px-3 py-1.5 bg-black/25 hover:bg-black/40 border border-border-app/50 hover:border-accent-app/30 rounded-full text-[10px] font-bold text-text-muted hover:text-accent-app transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>{s.text.replace(/with lifetime examples| captive dependency/g, '')}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input box Form panel */}
      <div className="glass-panel p-3 border border-border-app rounded-2xl bg-surface-app/25 shrink-0 shadow-lg">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Ask Doubt Solver AI a question about ${selectedTopic === 'General' ? 'Software Engineering' : TOPICS.find(t => t.id === selectedTopic)?.name}...`}
            disabled={loading}
            rows={1}
            className="flex-1 bg-black/25 border border-border-app/40 rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted/40 focus:outline-none focus:border-accent-app/60 resize-none font-medium max-h-[60px] min-h-[38px] leading-relaxed scrollbar-none"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 bg-accent-app hover:opacity-90 disabled:opacity-40 text-white rounded-xl shadow-md shadow-accent-app/10 flex items-center justify-center shrink-0 transition-all cursor-pointer border border-accent-app/10"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <div className="flex items-center gap-1.5 text-[9px] text-text-muted/50 mt-2 pl-1 select-none font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
          <span>Security Sandbox Active. Responses are generated in real-time. Code blocks can be copied securely.</span>
        </div>
      </div>
    </div>
  );
}
