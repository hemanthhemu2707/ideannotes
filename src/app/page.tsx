"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { 
  Pin, 
  Heart, 
  Clock, 
  BookOpen, 
  FileText, 
  Calendar, 
  ArrowRight,
  TrendingUp,
  FileCode,
  Layers,
  Database,
  Puzzle,
  Webhook,
  Shield,
  Network,
  CheckSquare,
  AlertCircle,
  ChevronRight,
  Briefcase,
  User
} from 'lucide-react';
import { Note } from '@/lib/notes';

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  'dotnet': { label: '.NET', icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-500/5' },
  'dotnet-core': { label: '.NET Core', icon: FileCode, color: 'text-indigo-400', bg: 'bg-indigo-500/5' },
  'entity-framework': { label: 'Entity Framework', icon: FileCode, color: 'text-violet-400', bg: 'bg-violet-500/5' },
  'react': { label: 'React', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
  'angular': { label: 'Angular', icon: Layers, color: 'text-red-400', bg: 'bg-red-500/5' },
  'javascript': { label: 'JavaScript', icon: Layers, color: 'text-yellow-400', bg: 'bg-yellow-500/5' },
  'sql': { label: 'SQL', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
  'design-patterns': { label: 'Design Patterns', icon: Puzzle, color: 'text-orange-400', bg: 'bg-orange-500/5' },
  'apis': { label: 'APIs', icon: Webhook, color: 'text-purple-400', bg: 'bg-purple-500/5' },
  'security': { label: 'Security', icon: Shield, color: 'text-rose-400', bg: 'bg-rose-500/5' },
  'system-design': { label: 'System Design', icon: Network, color: 'text-sky-400', bg: 'bg-sky-500/5' },
};

interface Schedule {
  id: number;
  company: string;
  role: string;
  scheduleDate: string;
  notes: string;
  completed: boolean;
}

interface ChecklistItem {
  id: number;
  status: 'Not Started' | 'In Progress' | 'Mastered';
}

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const notesRes = await fetch('/api/notes');
      const notesData = await notesRes.json();
      if (notesData.success) {
        let fetchedNotes = notesData.notes;
        
        // Merge with localStorage favorites
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

      const schedRes = await fetch('/api/schedules');
      const schedData = await schedRes.json();
      if (schedData.success) {
        // filter only non-completed upcoming ones
        setSchedules(schedData.schedules.filter((s: Schedule) => !s.completed));
      }

      const chkRes = await fetch('/api/checklist');
      const chkData = await chkRes.json();
      if (chkData.success) setChecklist(chkData.checklist);

      const expRes = await fetch('/api/interviews');
      const expData = await expRes.json();
      if (expData.success) setExperiences(expData.experiences);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pinnedNotes = notes.filter(n => n.metadata.pinned);
  const favoriteNotes = notes.filter(n => n.metadata.favorite && !n.metadata.pinned);
  const recentNotes = notes.slice(0, 4);

  // Stats calculation
  const totalNotes = notes.length;
  const totalPinned = pinnedNotes.length;
  const totalFavorites = notes.filter(n => n.metadata.favorite).length;
  const totalReadingTime = notes.reduce((acc, curr) => acc + curr.readingTime, 0);

  // Calculate note count per category
  const categoryCounts = Object.keys(CATEGORY_MAP).reduce((acc, cat) => {
    acc[cat] = notes.filter(n => n.categoryFolder === cat).length;
    return acc;
  }, {} as Record<string, number>);

  // Compute readiness score
  const getReadinessScore = () => {
    if (checklist.length === 0) return 0;
    const total = checklist.length;
    const mastered = checklist.filter(c => c.status === 'Mastered').length;
    const inProgress = checklist.filter(c => c.status === 'In Progress').length;
    return Math.round(((mastered * 1 + inProgress * 0.5) / total) * 100);
  };
  const readinessScore = getReadinessScore();

  // Schedule Countdown details mapping
  const getScheduleUrgency = (dateStr: string) => {
    const diffMs = new Date(dateStr).getTime() - Date.now();
    if (diffMs <= 0) return { label: 'Passed / Live', class: 'bg-slate-800 text-slate-400 border border-slate-700/50' };

    const diffHrs = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 24) {
      return { 
        label: `Starts in ${Math.floor(diffHrs)}h ${Math.floor((diffHrs % 1) * 60)}m`, 
        class: 'bg-red-500/10 text-red-400 border border-red-500/35 animate-pulse font-bold' 
      };
    } else if (diffDays < 3) {
      return { 
        label: `In ${diffDays}d ${Math.floor(diffHrs % 24)}h`, 
        class: 'bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold' 
      };
    } else {
      return { 
        label: `In ${diffDays} days`, 
        class: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
      };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8 animate-pulse select-none">
        <div className="space-y-3">
          <div className="h-8 bg-slate-800 rounded-lg w-1/3"></div>
          <div className="h-4 bg-slate-800 rounded-lg w-1/4"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-850 rounded-2xl glass-panel"></div>
          ))}
        </div>
      </div>
    );
  }

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-grow p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 sm:space-y-8 select-none"
    >
      {/* Header section with Readiness Badge */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-app/30 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-2.5">
            Workspace Dashboard 
            <span className="text-xs px-2.5 py-0.5 bg-accent-app/10 border border-accent-app/20 text-accent-app rounded-full font-bold">
              V1.2
            </span>
          </h1>
          <p className="text-xs md:text-sm text-text-muted">
            Ready to tackle today's software engineering interview prep? ⚡
          </p>
        </div>

        {/* Dynamic Mastery Score widget */}
        <Link 
          href="/schedules"
          className="glass-panel p-3 px-4 rounded-xl border border-border-app/40 flex items-center gap-3.5 hover:border-accent-app/40 transition-all cursor-pointer shadow-md shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-accent-app/10 border border-accent-app/15 flex items-center justify-center text-accent-app shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[9px] font-extrabold uppercase tracking-wider text-text-muted">Mastery Index</span>
            <span className="text-sm font-bold text-text-primary flex items-center gap-1.5 mt-0.5">
              {readinessScore}% Syllabus Prep
              <ChevronRight className="w-3.5 h-3.5 text-text-muted/60" />
            </span>
          </div>
        </Link>
      </motion.div>

      {/* Stats Counter Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Notes */}
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group border border-border-app/40 bg-surface-app/30">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-app/40 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="p-3 bg-accent-app/10 border border-accent-app/15 rounded-xl text-accent-app">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Notes</span>
            <span className="text-xl font-bold text-text-primary">{totalNotes}</span>
          </div>
        </div>

        {/* Pinned Notes */}
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group border border-border-app/40 bg-surface-app/30">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500/40 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/15 rounded-xl text-indigo-400">
            <Pin className="w-5 h-5 rotate-45" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Pinned Notes</span>
            <span className="text-xl font-bold text-text-primary">{totalPinned}</span>
          </div>
        </div>

        {/* Favorites */}
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group border border-border-app/40 bg-surface-app/30">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-rose-500/40 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="p-3 bg-rose-500/10 border border-rose-500/15 rounded-xl text-rose-400">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Favorites</span>
            <span className="text-xl font-bold text-text-primary">{totalFavorites}</span>
          </div>
        </div>

        {/* Est Study Time */}
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group border border-border-app/40 bg-surface-app/30">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500/40 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Est. Study Time</span>
            <span className="text-xl font-bold text-text-primary">{totalReadingTime} min</span>
          </div>
        </div>
      </motion.div>

      {/* Main split grid: Pinned notes + Schedule / checklists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Pinned & Favorite Notes */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Pinned Section */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Pin className="w-4.5 h-4.5 text-indigo-400 rotate-45 animate-bounce" />
              Pinned Reference Notes
            </h2>

            {pinnedNotes.length === 0 ? (
              <div className="glass-panel p-8 text-center text-text-muted rounded-2xl text-xs border-dashed border-border-app/60">
                No pinned notes. Select and pin key interview topics in the Control Center!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedNotes.map((note) => (
                  <Link 
                    key={note.slug} 
                    href={`/read/${note.categoryFolder}/${note.slug}`}
                    className="glass-panel p-5 rounded-2xl border border-border-app hover:border-accent-app/50 bg-surface-app/20 hover:bg-surface-app/40 hover:scale-[1.01] transition-all flex flex-col group h-full justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/15 uppercase tracking-wider">
                          {note.metadata.category}
                        </span>
                        <div className="flex gap-2">
                          {note.metadata.favorite && <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/25" />}
                          <Pin className="w-3.5 h-3.5 text-indigo-400 rotate-45" />
                        </div>
                      </div>
                      <h3 className="font-bold text-text-primary group-hover:text-accent-app transition-colors text-sm line-clamp-1">
                        {note.metadata.title}
                      </h3>
                      <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                        {note.content.substring(0, 120).replace(/[#*`[\]()]/g, '')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-4 pt-3 border-t border-border-app/40 w-full">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted/65" />
                        {note.readingTime} min
                      </span>
                      <span className="text-[10px] text-accent-app font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        Read Note <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

          {/* Favorites Section */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Heart className="w-4.5 h-4.5 text-rose-400 animate-pulse" />
              Favorite Topics
            </h2>

            {favoriteNotes.length === 0 ? (
              <div className="glass-panel p-8 text-center text-text-muted rounded-2xl text-xs border-dashed border-border-app/60">
                No favorite notes marked. Pin items to favorites during reading to see them here!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteNotes.map((note) => (
                  <Link 
                    key={note.slug} 
                    href={`/read/${note.categoryFolder}/${note.slug}`}
                    className="glass-panel p-5 rounded-2xl border border-border-app hover:border-accent-app/50 bg-surface-app/20 hover:bg-surface-app/40 hover:scale-[1.01] transition-all flex flex-col group h-full justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/15 uppercase tracking-wider">
                          {note.metadata.category}
                        </span>
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/25" />
                      </div>
                      <h3 className="font-bold text-text-primary group-hover:text-accent-app transition-colors text-sm line-clamp-1">
                        {note.metadata.title}
                      </h3>
                      <p className="text-xs text-text-muted line-clamp-2 mt-2 leading-relaxed">
                        {note.content.substring(0, 120).replace(/[#*`[\]()]/g, '')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-4 pt-3 border-t border-border-app/40 w-full">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted/65" />
                        {note.readingTime} min
                      </span>
                      <span className="text-[10px] text-accent-app font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        Read Note <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

          {/* Shared Interview Experiences Section */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Briefcase className="w-4.5 h-4.5 text-accent-app" />
                <span>Shared Interview Experiences</span>
              </h2>
              <Link href="/interviews" className="text-[10px] font-bold text-accent-app hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {experiences.length === 0 ? (
              <div className="glass-panel p-8 text-center text-text-muted rounded-2xl text-xs border-dashed border-border-app/60">
                No interview experiences shared yet. Click "View All" or go to the Interviews menu to share yours!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {experiences.slice(0, 4).map((exp) => (
                  <Link 
                    key={exp.id} 
                    href="/interviews"
                    className="glass-panel p-5 rounded-2xl border border-border-app hover:border-accent-app/50 bg-surface-app/20 hover:bg-surface-app/40 hover:scale-[1.01] transition-all flex flex-col group h-full justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-[9px] font-bold text-accent-app bg-accent-app/10 px-2 py-0.5 rounded-md border border-accent-app/15 uppercase tracking-wider">
                          {exp.companyName}
                        </span>
                        <span className="text-[9px] font-bold text-text-muted">
                          {exp.round}
                        </span>
                      </div>
                      <h3 className="font-bold text-text-primary group-hover:text-accent-app transition-colors text-sm line-clamp-1">
                        Questions list shared by {exp.interviewerName}
                      </h3>
                      <ul className="text-xs text-text-muted mt-2 space-y-1">
                        {exp.questions.slice(0, 2).map((q: any, qIdx: number) => (
                          <li key={q.id} className="truncate flex items-start gap-1">
                            <span className="text-accent-app font-bold">Q{qIdx + 1}:</span>
                            <span className="truncate">{q.questionText}</span>
                          </li>
                        ))}
                        {exp.questions.length > 2 && (
                          <li className="italic text-[10px] text-text-muted/65 pt-1">
                            + {exp.questions.length - 2} more questions
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-4 pt-3 border-t border-border-app/40 w-full">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted/65" />
                        <span>{new Date(exp.interviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </span>
                      <span className="text-[10px] text-accent-app font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        Explore Q&As <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Side: Timeline & Countdown Badges */}
        <div className="space-y-8">
          
          {/* Upcoming Interview Schedule Card */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-accent-app" />
                <span>Upcoming Timelines</span>
              </h2>
              <Link href="/schedules" className="text-[10px] font-bold text-accent-app hover:underline flex items-center gap-0.5">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-border-app bg-surface-app/30 space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">
                  No upcoming interviews. Good luck! 🎉
                </div>
              ) : (
                <div className="space-y-3.5">
                  {schedules.slice(0, 3).map((sched) => {
                    const urgency = getScheduleUrgency(sched.scheduleDate);
                    return (
                      <div key={sched.id} className="bg-black/10 p-3 rounded-xl border border-border-app/20 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <span className="block font-bold text-xs text-text-primary truncate">{sched.company}</span>
                            <span className="block text-[10px] text-text-muted mt-0.5 truncate">{sched.role}</span>
                          </div>
                          
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 ${urgency.class}`}>
                            {urgency.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Notes Timeline */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
              Recent Updates
            </h2>

            <div className="glass-panel p-5 rounded-2xl space-y-4 border border-border-app bg-surface-app/30">
              {recentNotes.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">
                  No notes created yet. Click "Write Note" to get started!
                </div>
              ) : (
                <div className="relative pl-4 space-y-4 border-l border-border-app/60">
                  {recentNotes.map((note) => (
                    <div key={note.slug} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-accent-app border border-bg-app group-hover:scale-125 transition-transform" />
                      
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-semibold text-text-muted flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-text-muted/60" />
                          {new Date(note.metadata.updatedDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <Link 
                          href={`/read/${note.categoryFolder}/${note.slug}`}
                          className="font-bold text-xs text-text-primary hover:text-accent-app transition-colors mt-0.5 truncate"
                        >
                          {note.metadata.title}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Categories Overview */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-indigo-400" />
              Quick Categories
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(CATEGORY_MAP).map(([key, cat]) => {
                const count = categoryCounts[key] || 0;
                const IconComponent = cat.icon;

                return (
                  <Link 
                    key={key} 
                    href={`/manage?category=${key}`}
                    className="glass-panel p-3 rounded-xl flex items-center gap-2.5 bg-surface-app/20 hover:bg-surface-app/40 hover:scale-[1.01] transition-all border border-border-app hover:border-accent-app/40 select-none group shadow-sm"
                  >
                    <div className={`p-2 rounded-lg ${cat.bg} ${cat.color} group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-text-primary truncate">{cat.label}</span>
                      <span className="text-[9px] text-text-muted mt-0.5">{count} notes</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
