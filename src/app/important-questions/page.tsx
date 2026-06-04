'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Plus,
  ArrowLeft,
  MessageCircle,
  User,
  Clock,
  Send,
  X,
  Search,
  BookOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Lock,
  Edit,
  Trash2,
  Save,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Category {
  slug: string;
  name: string;
  parentSlug?: string | null;
  icon?: string;
}

interface CategoryTreeNode {
  slug: string;
  name: string;
  parentSlug?: string | null;
  children: CategoryTreeNode[];
}

interface Question {
  id: number;
  categorySlug: string;
  questionText: string;
  createdBy: string;
  createdDate: string;
  answersCount: number;
}

interface Answer {
  id: number;
  questionId: number;
  username: string;
  answerText: string;
  createdDate: string;
  updatedDate: string;
}

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const map: Record<string, CategoryTreeNode> = {};
  const roots: CategoryTreeNode[] = [];

  categories.forEach(cat => {
    map[cat.slug] = { slug: cat.slug, name: cat.name, parentSlug: cat.parentSlug, children: [] };
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

function CategoryTreeNodeView({ 
  node, 
  depth, 
  selectedSlug, 
  onSelect, 
  questionCounts 
}: { 
  node: CategoryTreeNode; 
  depth: number; 
  selectedSlug: string; 
  onSelect: (slug: string) => void;
  questionCounts: Record<string, number>;
}) {
  const hasChildren = node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedSlug === node.slug;
  const count = questionCounts[node.slug] || 0;
  
  return (
    <div className="space-y-1">
      <div 
        onClick={() => {
          onSelect(node.slug);
        }}
        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
          isSelected 
            ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-bold' 
            : 'text-text-muted hover:text-text-primary border-transparent hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 12 + 10}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0.5 rounded hover:bg-white/10 text-text-muted/65 hover:text-text-primary shrink-0 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4.5" />
          )}
          <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-accent-app' : 'text-text-muted'}`} />
          <span className="truncate leading-none pt-0.5">{node.name}</span>
        </div>
        {count > 0 && (
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/20 text-text-muted/70 border border-border-app/20 shrink-0">
            {count}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map(child => (
            <CategoryTreeNodeView 
              key={child.slug} 
              node={child} 
              depth={depth + 1} 
              selectedSlug={selectedSlug} 
              onSelect={onSelect}
              questionCounts={questionCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImportantQuestionsPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>('all');
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Mobile layout state: 'categories' | 'questions' | 'answers'
  const [mobileActivePanel, setMobileActivePanel] = useState<'categories' | 'questions' | 'answers'>('categories');

  // Add Question Modal State
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCategorySlug, setNewQuestionCategorySlug] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Write Answer State
  const [newAnswerText, setNewAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerEditorTab, setAnswerEditorTab] = useState<'write' | 'preview'>('write');

  // Fetch session
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  // Fetch all categories and questions
  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, qRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/important-questions')
      ]);
      const [catData, qData] = await Promise.all([
        catRes.json(),
        qRes.json()
      ]);

      if (catData.success && catData.categories) {
        setCategories(catData.categories);
      }
      if (qData.success && qData.questions) {
        setQuestions(qData.questions);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load questions database.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch answers for active question
  const fetchAnswers = async (questionId: number) => {
    setAnswersLoading(true);
    try {
      const res = await fetch(`/api/important-questions/answers?questionId=${questionId}`);
      const data = await res.json();
      if (data.success && data.answers) {
        setAnswers(data.answers);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load answers.');
    } finally {
      setAnswersLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchData();
  }, []);

  // Compute question counts per category slug
  const questionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      counts[q.categorySlug] = (counts[q.categorySlug] || 0) + 1;
    });
    return counts;
  }, [questions]);

  // Handle category selection
  const handleSelectCategory = (slug: string) => {
    setActiveCategorySlug(slug);
    setMobileActivePanel('questions');
  };

  // Handle question click
  const handleSelectQuestion = (q: Question) => {
    setActiveQuestion(q);
    fetchAnswers(q.id);
    // Find if user already wrote an answer to preload editor
    const myAns = answers.find(ans => user && ans.username.toLowerCase() === user.username.toLowerCase());
    setNewAnswerText(myAns ? myAns.answerText : '');
    setMobileActivePanel('answers');
  };

  // Filter questions based on Category and Search Term
  const filteredQuestions = React.useMemo(() => {
    return questions.filter(q => {
      // Category filter
      if (activeCategorySlug !== 'all') {
        // Match exact or check if the category active is parent category of the question's category
        const isExact = q.categorySlug === activeCategorySlug;
        if (!isExact) {
          const childSlugs = categories
            .filter(c => c.parentSlug === activeCategorySlug)
            .map(c => c.slug);
          if (!childSlugs.includes(q.categorySlug)) return false;
        }
      }

      // Search term filter
      if (searchTerm.trim() !== '') {
        const text = q.questionText.toLowerCase();
        return text.includes(searchTerm.toLowerCase());
      }

      return true;
    });
  }, [questions, activeCategorySlug, searchTerm, categories]);

  // Submit Question Handler
  const handleCreateQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login first to submit questions.');
      return;
    }
    if (!newQuestionCategorySlug || newQuestionCategorySlug === '') {
      toast.error('Please select a category folder.');
      return;
    }
    if (!newQuestionText || newQuestionText.trim() === '') {
      toast.error('Please enter question description.');
      return;
    }

    setSubmittingQuestion(true);
    try {
      const res = await fetch('/api/important-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorySlug: newQuestionCategorySlug,
          questionText: newQuestionText
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Question added successfully!');
        setNewQuestionText('');
        setIsAddQuestionOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to submit question.');
      }
    } catch {
      toast.error('Network error. Failed to add question.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Submit Answer Handler
  const handleCreateAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeQuestion) return;
    if (!newAnswerText || newAnswerText.trim() === '') {
      toast.error('Answer text cannot be empty.');
      return;
    }

    setSubmittingAnswer(true);
    try {
      const res = await fetch('/api/important-questions/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          answerText: newAnswerText
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Answer saved successfully!');
        setNewAnswerText('');
        fetchAnswers(activeQuestion.id);
        
        // Update local questions count count count count
        setQuestions(prev => prev.map(q => {
          if (q.id === activeQuestion.id) {
            // If it was already answered by user, answersCount stays same, else +1
            const alreadyAnswered = answers.some(ans => ans.username.toLowerCase() === user.username.toLowerCase());
            return {
              ...q,
              answersCount: alreadyAnswered ? q.answersCount : q.answersCount + 1
            };
          }
          return q;
        }));
      } else {
        toast.error(data.error || 'Failed to submit answer.');
      }
    } catch {
      toast.error('Network error. Failed to save answer.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // Delete Question Handler
  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this question? This will delete all answers under it.')) return;
    try {
      const res = await fetch(`/api/important-questions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Question deleted.');
        fetchData();
        if (activeQuestion?.id === id) {
          setActiveQuestion(null);
          setMobileActivePanel('questions');
        }
      } else {
        toast.error(data.error || 'Failed to delete.');
      }
    } catch {
      toast.error('Network error.');
    }
  };

  // Delete Answer Handler
  const handleDeleteAnswer = async (answerId: number) => {
    if (!window.confirm('Delete this answer?')) return;
    try {
      const res = await fetch(`/api/important-questions/answers?id=${answerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Answer deleted.');
        if (activeQuestion) {
          fetchAnswers(activeQuestion.id);
          // decrement count locally
          setQuestions(prev => prev.map(q => {
            if (q.id === activeQuestion.id) {
              return { ...q, answersCount: Math.max(0, q.answersCount - 1) };
            }
            return q;
          }));
        }
      } else {
        toast.error(data.error || 'Failed to delete.');
      }
    } catch {
      toast.error('Network error.');
    }
  };

  const activeCategoryName = categories.find(c => c.slug === activeCategorySlug)?.name || 'All Categories';
  const myAnswer = user ? answers.find(ans => ans.username.toLowerCase() === user.username.toLowerCase()) : null;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-bg-app text-text-primary">
      
      {/* 1. LEFT PANEL: Category Tree (desktop-permanent / mobile-toggleable) */}
      <div className={`${mobileActivePanel === 'categories' ? 'flex' : 'hidden'} md:flex w-full md:w-80 shrink-0 border-r border-border-app/45 flex-col h-full bg-surface-app/20 backdrop-blur-md`}>
        <div className="p-4 border-b border-border-app/40 flex items-center justify-between">
          <h1 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-accent-app" />
            <span>Questions Explorer</span>
          </h1>
          
          <button
            onClick={() => {
              if (!user) {
                toast.error('Authentication required. Redirecting to login...');
                window.location.href = '/login?redirect=/important-questions';
                return;
              }
              setNewQuestionCategorySlug(activeCategorySlug !== 'all' ? activeCategorySlug : '');
              setIsAddQuestionOpen(true);
            }}
            className="px-3 py-1.5 bg-accent-app hover:opacity-90 text-white text-[11px] font-bold rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Q</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-3.5 space-y-2">
          {/* All Categories Option */}
          <div 
            onClick={() => handleSelectCategory('all')}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
              activeCategorySlug === 'all' 
                ? 'bg-accent-app/10 border-accent-app/20 text-accent-app font-bold' 
                : 'text-text-muted hover:text-text-primary border-transparent hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-4.5" />
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>All Questions</span>
            </div>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/20 text-text-muted border border-border-app/20">
              {questions.length}
            </span>
          </div>

          <div className="h-px bg-border-app/40 my-2" />

          {/* Render category tree view recursively */}
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-text-muted gap-2">
              <div className="w-4 h-4 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
              <span>Loading folders...</span>
            </div>
          ) : (
            (() => {
              const tree = buildCategoryTree(categories);
              return tree.map(node => (
                <CategoryTreeNodeView 
                  key={node.slug} 
                  node={node} 
                  depth={0} 
                  selectedSlug={activeCategorySlug} 
                  onSelect={handleSelectCategory}
                  questionCounts={questionCounts}
                />
              ));
            })()
          )}
        </div>
      </div>

      {/* 2. CENTER PANEL: Questions List (mobile panel 2) */}
      <div className={`${mobileActivePanel === 'questions' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full bg-black/5 border-r border-border-app/45`}>
        {/* Panel Header */}
        <div className="p-4 border-b border-border-app/40 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Back to Categories Mobile Button */}
              <button
                onClick={() => setMobileActivePanel('categories')}
                className="md:hidden p-1 mr-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <h2 className="text-sm font-extrabold text-text-primary truncate">
                {activeCategoryName}
              </h2>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  toast.error('Authentication required. Redirecting to login...');
                  window.location.href = '/login?redirect=/important-questions';
                  return;
                }
                setNewQuestionCategorySlug(activeCategorySlug !== 'all' ? activeCategorySlug : '');
                setIsAddQuestionOpen(true);
              }}
              className="md:hidden px-2.5 py-1 bg-accent-app hover:opacity-90 text-white text-[10px] font-bold rounded-lg transition-all"
            >
              Add Q
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 rounded-xl py-2 pl-8 pr-3 text-base md:text-xs focus:outline-none placeholder-text-muted/40 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-text-muted/40 absolute left-3 top-3" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Questions list flow */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-xs text-text-muted gap-2">
              <div className="w-6 h-6 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
              <span>Loading questions...</span>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-16 text-text-muted text-xs border border-dashed border-border-app/50 rounded-2xl p-6">
              No questions found under this folder. Click "Add Q" to submit one!
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isCreator = user && q.createdBy.toLowerCase() === user.username.toLowerCase();
              const isAdmin = user && user.role === 'Admin';
              
              return (
                <div 
                  key={q.id}
                  onClick={() => handleSelectQuestion(q)}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-2.5 relative overflow-hidden cursor-pointer transition-all ${
                    activeQuestion?.id === q.id
                      ? 'bg-accent-app/10 border-accent-app/40 shadow-sm'
                      : 'bg-surface-app/30 border-border-app/30 hover:border-border-app/60 hover:bg-surface-app/45'
                  }`}
                >
                  {activeQuestion?.id === q.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-app" />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-xs sm:text-sm text-text-primary leading-relaxed flex-grow">
                      {q.questionText}
                    </p>
                    
                    {/* Delete Question button */}
                    {(isAdmin || isCreator) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestion(q.id);
                        }}
                        className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors shrink-0 cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-app/15">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-[80px] font-semibold">{q.createdBy}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span>{new Date(q.createdDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-accent-app bg-accent-app/5 border border-accent-app/15 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{q.answersCount} Answers</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. RIGHT PANEL: Answers Details Panel (mobile panel 3) */}
      <div className={`${mobileActivePanel === 'answers' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full bg-black/10 overflow-hidden`}>
        {activeQuestion ? (
          <div className="flex-grow flex flex-col h-full overflow-hidden">
            {/* Active Question Header */}
            <div className="p-4 sm:p-5 border-b border-border-app/45 bg-surface-app/10 flex flex-col gap-3.5 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMobileActivePanel('questions');
                    setActiveQuestion(null);
                    setAnswers([]);
                  }}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                  title="Back to Questions"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-[10px] uppercase font-bold text-accent-app tracking-widest leading-none pt-0.5">
                  Question Discussion View
                </span>
              </div>

              <div className="bg-surface-app/20 p-4 rounded-xl border border-border-app/40">
                <p className="font-extrabold text-sm sm:text-base text-text-primary leading-relaxed">
                  {activeQuestion.questionText}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-text-muted mt-3 pt-2 border-t border-border-app/15">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-indigo-400" />
                    <span className="font-semibold text-text-primary/80">{activeQuestion.createdBy}</span>
                  </span>
                  <span>•</span>
                  <span>Posted {new Date(activeQuestion.createdDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* Discussion Thread list */}
            <div className="flex-grow overflow-y-auto p-4 sm:p-5 space-y-4">
              <h3 className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-accent-app" />
                <span>Answers Thread</span>
              </h3>

              {answersLoading && answers.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-xs text-text-muted gap-2">
                  <div className="w-4 h-4 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
                  <span>Loading answers...</span>
                </div>
              ) : answers.length === 0 ? (
                <div className="text-center py-10 text-text-muted/60 text-xs italic">
                  No answers submitted yet. Be the first to answer this question!
                </div>
              ) : (
                answers.map(ans => {
                  const isMe = user && ans.username.toLowerCase() === user.username.toLowerCase();
                  const isAdmin = user && user.role === 'Admin';
                  
                  return (
                    <div key={ans.id} className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2.5 ${
                      isMe 
                        ? 'bg-accent-app/5 border-accent-app/20' 
                        : 'bg-surface-app/30 border-border-app/30'
                    }`}>
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-0 text-[10px] text-text-muted border-b border-border-app/15 pb-2">
                        <span className="flex items-center gap-1 font-bold">
                          <User className={`w-3 h-3 ${isMe ? 'text-accent-app' : 'text-indigo-400'}`} />
                          <span className={isMe ? 'text-accent-app' : 'text-text-primary/90'}>
                            {isMe ? 'Your Answer' : ans.username}
                          </span>
                        </span>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(ans.updatedDate).toLocaleDateString()}</span>
                          </span>

                          {(isMe || isAdmin) && (
                            <button
                              onClick={() => handleDeleteAnswer(ans.id)}
                              className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5 cursor-pointer text-[9px]"
                              title="Delete Answer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="prose max-w-none text-text-primary/95 leading-relaxed font-normal pt-1 break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          pre: ({ children }) => <pre className="p-3 my-2 rounded-lg bg-black/30 border border-border-app/40 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{children}</pre>,
                          code: ({ children }) => <code className="bg-white/5 border border-border-app/45 rounded px-1 text-accent-app text-[11px] font-mono">{children}</code>
                        }}>
                          {ans.answerText}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Write Answer Form */}
              {user ? (
                <div className="bg-surface-app/30 border border-accent-app/25 rounded-2xl p-4 mt-6 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-accent-app uppercase tracking-wider">
                      {myAnswer ? 'Edit Your Answer (Markdown Supported)' : 'Write Your Answer (Markdown Supported)'}
                    </span>

                    {/* Write/Preview Switcher */}
                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-border-app/35 select-none text-[9px]">
                      <button
                        type="button"
                        onClick={() => setAnswerEditorTab('write')}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                          answerEditorTab === 'write'
                            ? 'bg-accent-app text-white shadow-sm'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswerEditorTab('preview')}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                          answerEditorTab === 'preview'
                            ? 'bg-accent-app text-white shadow-sm'
                            : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {answerEditorTab === 'write' ? (
                    <textarea
                      value={newAnswerText}
                      onChange={(e) => setNewAnswerText(e.target.value)}
                      placeholder="Share your detailed answer or code solution..."
                      rows={4}
                      className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 rounded-xl p-3 text-base md:text-xs leading-relaxed text-text-primary focus:outline-none font-mono resize-y"
                    />
                  ) : (
                    <div className="prose max-w-none p-3.5 bg-black/25 rounded-xl border border-border-app/20 text-xs text-text-muted leading-relaxed font-normal min-h-[100px] break-words">
                      {newAnswerText.trim() ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          pre: ({ children }) => <pre className="p-3 my-2 rounded-lg bg-black/30 border border-border-app/40 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{children}</pre>,
                          code: ({ children }) => <code className="bg-white/5 border border-border-app/45 rounded px-1 text-accent-app text-[11px] font-mono">{children}</code>
                        }}>
                          {newAnswerText}
                        </ReactMarkdown>
                      ) : (
                        <span className="italic text-text-muted/40">*Type something in the Write tab to see it here...*</span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-1.5 border-t border-border-app/15">
                    {newAnswerText.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setNewAnswerText('')}
                        className="px-3.5 py-1.5 rounded-xl border border-border-app/40 text-text-muted hover:text-text-primary text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Clear
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateAnswerSubmit}
                      disabled={submittingAnswer}
                      className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-accent-app/10"
                    >
                      {submittingAnswer ? (
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
                <div className="p-4 text-center text-xs text-text-muted border border-dashed border-border-app/50 rounded-xl bg-surface-app/10">
                  Please{' '}
                  <Link href={`/login?redirect=/important-questions`} className="text-accent-app hover:underline font-bold">
                    Log In
                  </Link>{' '}
                  to write answers.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <div className="w-16 h-16 rounded-full bg-surface-app border border-border-app flex items-center justify-center text-text-muted mb-4 shadow-inner">
              <HelpCircle className="w-7 h-7 text-text-muted/70" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">No Question Selected</h2>
            <p className="text-xs text-text-muted max-w-sm mt-1">
              Select a question from the middle list to read answers and join the discussion thread!
            </p>
          </div>
        )}
      </div>

      {/* 4. ADD QUESTION MODAL */}
      <AnimatePresence>
        {isAddQuestionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!submittingQuestion) setIsAddQuestionOpen(false);
              }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative z-10 w-full max-w-lg bg-surface-app border border-border-app rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-border-app/40 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-accent-app" />
                  <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                    Add Important Question
                  </h2>
                </div>
                
                <button
                  type="button"
                  disabled={submittingQuestion}
                  onClick={() => setIsAddQuestionOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateQuestionSubmit} className="py-4 space-y-4 flex-grow overflow-y-auto">
                {/* Category Selector */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                    Choose Folder (Category / Subfolder) *
                  </label>
                  <select
                    required
                    value={newQuestionCategorySlug}
                    onChange={(e) => setNewQuestionCategorySlug(e.target.value)}
                    className="w-full bg-black/25 border border-border-app/40 text-text-primary rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-accent-app/60 cursor-pointer"
                  >
                    <option value="" disabled className="text-text-muted bg-slate-900">-- Select Folder --</option>
                    {categories.map(c => {
                      const parent = categories.find(p => p.slug === c.parentSlug);
                      const prefix = parent ? `${parent.name} > ` : '';
                      return (
                        <option key={c.slug} value={c.slug} className="text-text-primary bg-slate-900">
                          {prefix}{c.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Question Description Text */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                    Question Title / Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Type the question. Keep it concise, e.g. What is the difference between IQueryable and IEnumerable?"
                    className="w-full bg-black/25 border border-border-app/40 text-text-primary focus:border-accent-app/60 rounded-xl p-3 text-base md:text-xs font-semibold focus:outline-none resize-none"
                  />
                </div>
              </form>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-border-app/40 flex justify-end gap-3 shrink-0 select-none">
                <button
                  type="button"
                  disabled={submittingQuestion}
                  onClick={() => setIsAddQuestionOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={submittingQuestion || !newQuestionText.trim() || !newQuestionCategorySlug}
                  onClick={handleCreateQuestionSubmit}
                  className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingQuestion ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Save Question</span>
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
