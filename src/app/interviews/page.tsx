'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  User,
  Plus,
  Trash2,
  Edit3,
  Save,
  MessageSquare,
  HelpCircle,
  Eye,
  ArrowLeft,
  Check,
  X,
  Clock,
  ChevronRight,
  Copy,
  Lock,
  Unlock,
  Building,
  Sparkles,
  BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { useToast } from '@/components/Toast';

interface Answer {
  id: number;
  username: string;
  answerText: string;
  updatedDate: string;
}

interface Question {
  id: number;
  questionText: string;
  answers: Answer[];
}

interface InterviewExperience {
  id: number;
  companyName: string;
  round: string;
  interviewDate: string;
  interviewerName: string;
  createdDate: string;
  questions: Question[];
}

interface NewQuestionInput {
  questionText: string;
  answerText: string;
  tab: 'write' | 'preview';
}

// Sub-component: Copy button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-text-muted hover:text-text-primary transition-all flex items-center gap-1 cursor-pointer border border-white/5"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-450" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

// Markdown renderer for Q&A answers
const PreContext = React.createContext<boolean>(false);
function SafeMarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold border-b border-border-app/40 pb-1 my-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold border-b border-border-app/20 pb-0.5 my-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold my-1.5">{children}</h3>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4 rounded-lg border border-border-app/40 bg-black/10">
            <table className="min-w-full divide-y divide-border-app/40 text-xs">
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
        code({ className, children, ...props }) {
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
              <div className="relative group my-3 rounded-lg overflow-hidden bg-[#090d16] border border-border-app/50 shadow-md">
                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
                  <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider font-mono">{lang}</span>
                  <CopyButton text={codeText} />
                </div>
                <pre className="p-3 max-h-[250px] overflow-y-auto text-[11px] text-text-primary/90 font-mono whitespace-pre-wrap break-all overflow-x-hidden">
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
  );
}

export default function InterviewExperiencesPage() {
  const [experiences, setExperiences] = useState<InterviewExperience[]>([]);
  const [selectedExp, setSelectedExp] = useState<InterviewExperience | null>(null);
  const [mobileActivePanel, setMobileActivePanel] = useState<'list' | 'details'>('list');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Share Form state
  const [companyName, setCompanyName] = useState('');
  const [round, setRound] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [questions, setQuestions] = useState<NewQuestionInput[]>([
    { questionText: '', answerText: '', tab: 'write' }
  ]);
  const [suggestedRoundText, setSuggestedRoundText] = useState('');
  const [roundsFetchLoading, setRoundsFetchLoading] = useState(false);
  const [savingExperience, setSavingExperience] = useState(false);

  // User manual edit tracking for Suggested Round
  const isRoundManuallyEdited = useRef(false);

  // Interactive Collaborative Answering State (keyed by questionId)
  const [answeringQuestionId, setAnsweringQuestionId] = useState<number | null>(null);
  const [activeAnswerText, setActiveAnswerText] = useState('');
  const [activeAnswerTab, setActiveAnswerTab] = useState<'write' | 'preview'>('write');
  const [savingAnswerId, setSavingAnswerId] = useState<number | null>(null);

  const toast = useToast();

  // Load Session and experiences
  const loadData = async () => {
    setLoading(true);
    try {
      const authRes = await fetch('/api/auth');
      const authData = await authRes.json();
      if (authData.success && authData.user) {
        setUser(authData.user);
      } else {
        setUser(null);
      }

      const expRes = await fetch('/api/interviews');
      const expData = await expRes.json();
      if (expData.success) {
        setExperiences(expData.experiences);
        // Pre-select first experience if none is selected
        if (expData.experiences.length > 0 && !selectedExp) {
          setSelectedExp(expData.experiences[0]);
          setMobileActivePanel('list');
        } else if (selectedExp) {
          // Refresh active experience mapping
          const updated = expData.experiences.find((e: InterviewExperience) => e.id === selectedExp.id);
          if (updated) setSelectedExp(updated);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load interview experiences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check rounds on company name change/blur
  const handleCompanyChange = async (name: string) => {
    setCompanyName(name);
    if (name.trim() === '') {
      setSuggestedRoundText('');
      return;
    }

    setRoundsFetchLoading(true);
    try {
      const res = await fetch(`/api/interviews/rounds?companyName=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success) {
        if (data.rounds.length > 0) {
          setSuggestedRoundText(`Found existing rounds: ${data.rounds.join(', ')}. Suggested next: ${data.suggestedRound}`);
        } else {
          setSuggestedRoundText(`New company! Suggested: ${data.suggestedRound}`);
        }
        
        // Prefill suggested round if user has not typed in the field yet
        if (!isRoundManuallyEdited.current) {
          setRound(data.suggestedRound);
        }
      }
    } catch {
      // ignore silently
    } finally {
      setRoundsFetchLoading(false);
    }
  };

  // Submit shared experience
  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in first to share experiences.');
      return;
    }

    if (!companyName || !round || !interviewDate) {
      toast.error('Please fill out Company Name, Round, and Date.');
      return;
    }

    const validQuestions = questions.filter(q => q.questionText.trim() !== '');
    if (validQuestions.length === 0) {
      toast.error('Please provide at least one question.');
      return;
    }

    setSavingExperience(true);
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          round,
          interviewDate,
          questions: validQuestions.map(q => ({
            questionText: q.questionText,
            answerText: q.answerText
          }))
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Interview experience shared successfully! 🎉');
        setIsShareModalOpen(false);
        // Reset form
        setCompanyName('');
        setRound('');
        setInterviewDate('');
        setQuestions([{ questionText: '', answerText: '', tab: 'write' }]);
        setSuggestedRoundText('');
        isRoundManuallyEdited.current = false;
        
        // Reload list and select new experience
        await loadData();
      } else {
        toast.error(data.error || 'Failed to share experience.');
      }
    } catch {
      toast.error('Server error. Failed to share experience.');
    } finally {
      setSavingExperience(false);
    }
  };

  // Submit a collaborative answer
  const handleAnswerSubmit = async (questionId: number) => {
    if (!user) {
      toast.error('Please log in to answer questions.');
      return;
    }

    if (activeAnswerText.trim() === '') {
      toast.error('Answer text cannot be empty.');
      return;
    }

    setSavingAnswerId(questionId);
    try {
      const res = await fetch('/api/interviews/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answerText: activeAnswerText
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Answer saved successfully!');
        setAnsweringQuestionId(null);
        setActiveAnswerText('');
        // Reload list and update state
        await loadData();
      } else {
        toast.error(data.error || 'Failed to save answer.');
      }
    } catch {
      toast.error('Server error. Failed to save answer.');
    } finally {
      setSavingAnswerId(null);
    }
  };

  // Delete a shared experience
  const handleDeleteExperience = async (id: number) => {
    if (!confirm('Are you sure you want to delete this interview experience? All associated questions and answers will be permanently deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/interviews?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Interview experience deleted.');
        setSelectedExp(null);
        setMobileActivePanel('list');
        await loadData();
      } else {
        toast.error(data.error || 'Failed to delete experience.');
      }
    } catch {
      toast.error('Server error. Failed to delete experience.');
    }
  };

  // Start answering or editing an answer
  const startAnswering = (q: Question) => {
    if (!user) {
      toast.error('Please unlock/login to submit answers.');
      return;
    }
    const myExistingAnswer = q.answers.find(a => a.username.toLowerCase() === user.username.toLowerCase());
    setAnsweringQuestionId(q.id);
    setActiveAnswerText(myExistingAnswer ? myExistingAnswer.answerText : '');
    setActiveAnswerTab('write');
  };

  // Filters listing
  const filteredExperiences = experiences.filter(exp => {
    const cleanSearch = searchTerm.toLowerCase().trim();
    if (cleanSearch === '') return true;
    return (
      exp.companyName.toLowerCase().includes(cleanSearch) ||
      exp.round.toLowerCase().includes(cleanSearch) ||
      exp.interviewerName.toLowerCase().includes(cleanSearch) ||
      exp.questions.some(q => q.questionText.toLowerCase().includes(cleanSearch))
    );
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-bg-app">
      {/* LEFT PANEL: Sidebar/Experiences List */}
      <div className={`${mobileActivePanel === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 shrink-0 border-r border-border-app/45 flex-col h-full bg-surface-app/20 backdrop-blur-md`}>
        {/* Panel Header & Controls */}
        <div className="p-4 border-b border-border-app/40 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-accent-app" />
              <span>Experiences Shared</span>
            </h1>
            <button
              onClick={() => {
                if (!user) {
                  toast.error('Authentication required to share experience.');
                  return;
                }
                setIsShareModalOpen(true);
              }}
              className="px-3 py-1.5 bg-accent-app hover:opacity-90 text-white text-[11px] font-bold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Share Exp</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company, round, questions..."
              className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 rounded-xl py-2 pl-3 pr-8 text-base md:text-xs focus:outline-none placeholder-text-muted/40 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-grow overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted text-xs">
              <div className="w-6 h-6 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
              <span>Loading experiences...</span>
            </div>
          ) : filteredExperiences.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-xs border border-dashed border-border-app/50 rounded-2xl p-4">
              {searchTerm ? 'No matches found.' : 'No interview experiences shared yet. Be the first to share one!'}
            </div>
          ) : (
            filteredExperiences.map((exp) => (
              <div
                key={exp.id}
                onClick={() => {
                  setSelectedExp(exp);
                  setMobileActivePanel('details');
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col gap-2 group relative overflow-hidden ${
                  selectedExp?.id === exp.id
                    ? 'bg-accent-app/10 border-accent-app/40 shadow-sm'
                    : 'bg-surface-app/30 border-border-app/30 hover:border-border-app/60 hover:bg-surface-app/45'
                }`}
              >
                {/* Visual accent left indicator */}
                {selectedExp?.id === exp.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-app" />
                )}

                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs text-text-primary group-hover:text-accent-app transition-colors truncate">
                      {exp.companyName}
                    </h3>
                    <span className="text-[10px] font-semibold text-text-muted block mt-0.5">
                      {exp.round}
                    </span>
                  </div>

                  <span className="text-[9px] font-bold text-text-muted bg-white/5 border border-border-app/20 px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0">
                    <BookOpen className="w-2.5 h-2.5" />
                    {exp.questions.length} Q
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] text-text-muted pt-2 border-t border-border-app/20">
                  <span className="flex items-center gap-1">
                    <User className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate max-w-[80px]">{exp.interviewerName}</span>
                  </span>
                  
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 shrink-0" />
                    <span>{new Date(exp.interviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Details & Answering Section */}
      <div className={`${mobileActivePanel === 'details' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full bg-black/10 overflow-hidden`}>
        {selectedExp ? (
          <div className="flex-grow flex flex-col h-full overflow-hidden">
            {/* Header Details Panel */}
            <div className="p-4 sm:p-5 border-b border-border-app/45 bg-surface-app/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => {
                      setMobileActivePanel('list');
                      setSelectedExp(null);
                    }}
                    className="md:hidden p-1 mr-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                    title="Back to List"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-app/20 to-indigo-500/20 border border-accent-app/30 flex items-center justify-center font-bold text-sm text-accent-app">
                    {selectedExp.companyName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-text-primary leading-tight">
                      {selectedExp.companyName}
                    </h2>
                    <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase">
                      {selectedExp.round}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-accent-app" />
                  <div>
                    <span className="block text-[9px] text-text-muted/65 leading-none font-medium">Interview Date</span>
                    <span className="font-semibold text-text-primary text-[10px] sm:text-[11px]">
                      {new Date(selectedExp.interviewDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-border-app/40" />

                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="block text-[9px] text-text-muted/65 leading-none font-medium">Shared By</span>
                    <span className="font-semibold text-text-primary text-[10px] sm:text-[11px]">
                      {selectedExp.interviewerName}
                    </span>
                  </div>
                </div>

                {(user?.role === 'Admin' || selectedExp.interviewerName.toLowerCase() === user?.username.toLowerCase()) && (
                  <>
                    <div className="hidden sm:block w-px h-8 bg-border-app/40" />
                    <button
                      onClick={() => handleDeleteExperience(selectedExp.id)}
                      className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/45 text-rose-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Delete Experience"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] sm:text-xs">Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Questions list & collaborative answers */}
            <div className="flex-grow overflow-y-auto p-3.5 sm:p-6 space-y-6 max-w-4xl w-full mx-auto">
              <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-4">
                <HelpCircle className="w-4.5 h-4.5 text-accent-app" />
                <span>Interview Questions & Collaborative Answers</span>
              </h3>

              {selectedExp.questions.map((q, idx) => {
                const myAnswer = user ? q.answers.find(ans => ans.username.toLowerCase() === user.username.toLowerCase()) : null;
                const otherAnswers = q.answers.filter(ans => !user || ans.username.toLowerCase() !== user.username.toLowerCase());
                const isEditingThis = answeringQuestionId === q.id;

                return (
                  <div key={q.id} className="glass-panel p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border-app/40 bg-surface-app/10 space-y-4">
                    {/* Question Header */}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-accent-app/10 border border-accent-app/20 text-xs font-bold text-accent-app shrink-0 mt-0.5">
                        Q{idx + 1}
                      </span>
                      <p className="font-bold text-sm text-text-primary leading-relaxed">
                        {q.questionText}
                      </p>
                    </div>

                    {/* Answers block */}
                    <div className="space-y-3.5 pl-3 sm:pl-9">
                      {/* List of answers */}
                      {q.answers.length === 0 && !isEditingThis && (
                        <p className="text-xs text-text-muted/50 italic py-1">
                          No answers written yet for this question.
                        </p>
                      )}

                      {/* Display other people's answers (Read-only) */}
                      {otherAnswers.map(ans => (
                        <div key={ans.id} className="bg-black/20 rounded-xl p-3.5 sm:p-4 border border-border-app/30 space-y-2">
                          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-0 text-[10px] text-text-muted border-b border-border-app/15 pb-2">
                            <span className="flex items-center gap-1 font-bold">
                              <User className="w-3 h-3 text-indigo-400" />
                              <span>{ans.username}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(ans.updatedDate).toLocaleDateString()}</span>
                            </span>
                          </div>
                          
                          <div className="prose max-w-none text-xs text-text-primary/90 leading-relaxed font-normal pt-1">
                            <SafeMarkdownRenderer content={ans.answerText} />
                          </div>
                        </div>
                      ))}

                      {/* Display my answer */}
                      {myAnswer && !isEditingThis && (
                        <div className="bg-accent-app/5 rounded-xl p-3.5 sm:p-4 border border-accent-app/20 space-y-2">
                          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-0 text-[10px] text-accent-app border-b border-accent-app/10 pb-2 font-semibold">
                            <span className="flex items-center gap-1 font-bold">
                              <User className="w-3 h-3" />
                              <span>Your Answer</span>
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(myAnswer.updatedDate).toLocaleDateString()}</span>
                              </span>
                              <button
                                onClick={() => startAnswering(q)}
                                className="text-[10px] font-bold text-accent-app hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="prose max-w-none text-xs text-text-primary/95 leading-relaxed font-normal pt-1">
                            <SafeMarkdownRenderer content={myAnswer.answerText} />
                          </div>
                        </div>
                      )}

                      {/* Submit/Edit answer editor field */}
                      {isEditingThis ? (
                        <div className="bg-surface-app/30 border border-accent-app/30 rounded-xl p-3.5 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-accent-app uppercase tracking-wider">
                              {myAnswer ? 'Edit Your Answer (Markdown Supported)' : 'Write Your Answer (Markdown Supported)'}
                            </span>
                            
                            {/* Editor tabs */}
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-border-app/35 select-none text-[10px]">
                              <button
                                onClick={() => setActiveAnswerTab('write')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                                  activeAnswerTab === 'write'
                                    ? 'bg-accent-app text-white shadow-sm'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                              >
                                Write
                              </button>
                              <button
                                onClick={() => setActiveAnswerTab('preview')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                                  activeAnswerTab === 'preview'
                                    ? 'bg-accent-app text-white shadow-sm'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                              >
                                Preview
                              </button>
                            </div>
                          </div>

                          {activeAnswerTab === 'write' ? (
                            <textarea
                              value={activeAnswerText}
                              onChange={(e) => setActiveAnswerText(e.target.value)}
                              placeholder="Type your detailed answer... supports Markdown (tables, code snippets, lists)"
                              rows={4}
                              className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 rounded-lg p-3 text-base md:text-xs leading-relaxed text-text-primary focus:outline-none font-mono resize-y"
                            />
                          ) : (
                            <div className="prose max-w-none p-3 bg-black/25 rounded-lg border border-border-app/20 text-xs text-text-muted leading-relaxed font-normal min-h-[100px]">
                              {activeAnswerText.trim() ? (
                                <SafeMarkdownRenderer content={activeAnswerText} />
                              ) : (
                                <span className="italic text-text-muted/40">*Answer preview is empty...*</span>
                              )}
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAnsweringQuestionId(null);
                                setActiveAnswerText('');
                              }}
                              className="px-3 py-1.5 rounded-lg border border-border-app/40 text-text-muted hover:text-text-primary text-[10px] font-bold cursor-pointer transition-all hover:bg-white/5"
                            >
                              Cancel
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleAnswerSubmit(q.id)}
                              disabled={savingAnswerId !== null}
                              className="px-3.5 py-1.5 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              {savingAnswerId === q.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save Answer</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Render add answer button if not editing and I have not answered
                        !myAnswer && user && (
                          <button
                            onClick={() => startAnswering(q)}
                            className="mt-2 px-3 py-1.5 bg-accent-app/10 border border-accent-app/20 hover:bg-accent-app/20 text-accent-app text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Your Answer</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <div className="w-16 h-16 rounded-full bg-surface-app border border-border-app flex items-center justify-center text-text-muted mb-4 shadow-inner">
              <Briefcase className="w-7 h-7 text-text-muted/70" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">No Experience Selected</h2>
            <p className="text-xs text-text-muted max-w-sm mt-1">
              Select a shared experience from the left list to review detailed questions and collaborative answers!
            </p>
          </div>
        )}
      </div>

      {/* SHARE INTERVIEW EXPERIENCE FORM MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!savingExperience) setIsShareModalOpen(false);
              }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Modal Body container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative z-10 w-full max-w-3xl glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-app bg-surface-app/40 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-border-app/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-app animate-pulse" />
                  <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                    Share Interview Experience
                  </h2>
                </div>
                
                <button
                  type="button"
                  disabled={savingExperience}
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scroll Area */}
              <form onSubmit={handleShareSubmit} className="flex-grow overflow-y-auto py-4 space-y-5 pr-1.5">
                {/* 1. Interviewer / User Name & Date row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                      Submitted By
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={user?.username || ''}
                        disabled
                        className="w-full bg-black/40 border border-border-app/40 text-text-muted rounded-xl py-2.5 px-3 text-xs font-bold cursor-not-allowed"
                      />
                      <Lock className="w-3.5 h-3.5 text-text-muted/40 absolute right-3 top-3.5" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                      Interview Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full bg-black/25 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2.5 px-3 text-base md:text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Company Name & Round suggester row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                      Interview Company Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => handleCompanyChange(e.target.value)}
                        placeholder="e.g., Microsoft, Google, Amazon..."
                        className="w-full bg-black/25 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2.5 px-3 text-base md:text-xs font-semibold focus:outline-none"
                      />
                      {roundsFetchLoading && (
                        <div className="w-4.5 h-4.5 border-2 border-accent-app border-t-transparent rounded-full animate-spin absolute right-3 top-3" />
                      )}
                    </div>
                    {suggestedRoundText && (
                      <span className="text-[9px] text-accent-app font-bold select-none leading-relaxed block pt-0.5">
                        {suggestedRoundText}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                      Interview Round *
                    </label>
                    <input
                      type="text"
                      required
                      value={round}
                      onChange={(e) => {
                        isRoundManuallyEdited.current = true;
                        setRound(e.target.value);
                      }}
                      placeholder="e.g. 1st Round, Technical Round"
                      className="w-full bg-black/25 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2.5 px-3 text-base md:text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Questions List Section */}
                <div className="space-y-3 pt-2.5">
                  <div className="flex items-center justify-between border-b border-border-app/40 pb-2">
                    <h3 className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest">
                      Interview Questions & Answers List
                    </h3>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setQuestions([...questions, { questionText: '', answerText: '', tab: 'write' }]);
                      }}
                      className="px-2.5 py-1 bg-accent-app/10 border border-accent-app/20 hover:bg-accent-app/20 text-accent-app text-[9px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Question</span>
                    </button>
                  </div>

                  {questions.map((q, idx) => {
                    const setQuestionText = (text: string) => {
                      const updated = [...questions];
                      updated[idx].questionText = text;
                      setQuestions(updated);
                    };

                    const setAnswerText = (text: string) => {
                      const updated = [...questions];
                      updated[idx].answerText = text;
                      setQuestions(updated);
                    };

                    const setQuestionTab = (tab: 'write' | 'preview') => {
                      const updated = [...questions];
                      updated[idx].tab = tab;
                      setQuestions(updated);
                    };

                    const removeQuestion = () => {
                      if (questions.length === 1) {
                        toast.error('You must include at least one question.');
                        return;
                      }
                      setQuestions(questions.filter((_, i) => i !== idx));
                    };

                    return (
                      <div key={idx} className="bg-black/15 border border-border-app/30 rounded-xl p-4 space-y-3 relative group/item">
                        {/* Question label & delete button */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-accent-app uppercase tracking-wider select-none">
                            Question #{idx + 1}
                          </span>

                          <button
                            type="button"
                            onClick={removeQuestion}
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                            title="Remove Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Question Text Input */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-text-muted uppercase tracking-widest block">Question Title *</label>
                          <input
                            type="text"
                            required
                            value={q.questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="e.g. Write a function to check if a binary tree is balanced..."
                            className="w-full bg-black/20 border border-border-app/35 focus:border-accent-app/50 text-text-primary rounded-lg py-2 px-3 text-base md:text-xs focus:outline-none"
                          />
                        </div>

                        {/* Optional Answer Markdown Editor */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[8px] font-bold text-text-muted uppercase tracking-widest block">Your Answer (Optional - Markdown Supported)</label>
                            
                            {/* Editor tabs */}
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-border-app/35 select-none text-[9px]">
                              <button
                                type="button"
                                onClick={() => setQuestionTab('write')}
                                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                  q.tab === 'write'
                                    ? 'bg-accent-app text-white shadow-sm'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                              >
                                Write
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuestionTab('preview')}
                                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                  q.tab === 'preview'
                                    ? 'bg-accent-app text-white shadow-sm'
                                    : 'text-text-muted hover:text-text-primary'
                                }`}
                              >
                                Preview
                              </button>
                            </div>
                          </div>

                          {q.tab === 'write' ? (
                            <textarea
                              value={q.answerText}
                              onChange={(e) => setAnswerText(e.target.value)}
                              placeholder="Provide your optional answer code or explanation..."
                              rows={3}
                              className="w-full bg-black/20 border border-border-app/35 focus:border-accent-app/50 rounded-lg p-2.5 text-base md:text-xs leading-relaxed text-text-primary focus:outline-none font-mono resize-y"
                            />
                          ) : (
                            <div className="prose max-w-none p-2.5 bg-black/25 rounded-lg border border-border-app/20 text-xs text-text-muted leading-relaxed min-h-[70px]">
                              {q.answerText.trim() ? (
                                <SafeMarkdownRenderer content={q.answerText} />
                              ) : (
                                <span className="italic text-text-muted/30">*Answer preview is empty...*</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </form>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-border-app/40 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  disabled={savingExperience}
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-355 transition-all border border-slate-700/50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                
                <button
                  type="button"
                  onClick={handleShareSubmit}
                  disabled={savingExperience}
                  className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-accent-app/10 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingExperience ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Experience</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
