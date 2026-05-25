'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  CheckSquare, 
  Clock, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Loader, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Settings
} from 'lucide-react';
import { useToast } from '@/components/Toast';

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
  title: string;
  categorySlug: string;
  categoryName: string;
  topic: string;
  status: 'Not Started' | 'In Progress' | 'Mastered';
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modals / Form State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  
  // Schedule Form fields
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);

  // Checklist Form fields
  const [chkTitle, setChkTitle] = useState('');
  const [chkTopic, setChkTopic] = useState('');
  const [chkCategory, setChkCategory] = useState('');
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  const toast = useToast();

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      setIsAdmin(data.success && data.user?.role === 'Admin');
    } catch {
      setIsAdmin(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const schedRes = await fetch('/api/schedules');
      const schedData = await schedRes.json();
      if (schedData.success) setSchedules(schedData.schedules);

      const chkRes = await fetch('/api/checklist');
      const chkData = await chkRes.json();
      if (chkData.success) setChecklist(chkData.checklist);

      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      if (catData.success) setCategories(catData.categories);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchData();
  }, []);

  // Countdown Helper
  const getCountdownDetails = (dateStr: string, completed: boolean) => {
    if (completed) return { label: 'Completed', level: 'completed', class: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };

    const diffMs = new Date(dateStr).getTime() - Date.now();
    if (diffMs <= 0) return { label: 'Passed / Started', level: 'passed', class: 'bg-slate-800 text-slate-400 border border-slate-700/50' };
    
    const diffHrs = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHrs / 24);
    
    if (diffHrs < 24) {
      const hrs = Math.floor(diffHrs);
      const mins = Math.floor((diffHrs % 1) * 60);
      return { 
        label: `Starts in ${hrs}h ${mins}m`, 
        level: 'danger',
        class: 'bg-red-500/10 text-red-400 border border-red-500/35 animate-pulse font-bold',
        pulse: true
      };
    } else if (diffDays < 3) {
      return { 
        label: `In ${diffDays}d ${Math.floor(diffHrs % 24)}h`, 
        level: 'warning',
        class: 'bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold'
      };
    } else {
      return { 
        label: `In ${diffDays} days`, 
        level: 'success',
        class: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      };
    }
  };

  // Preparation Percentage Calculation
  const calculatePrepStats = () => {
    if (checklist.length === 0) return { percent: 0, mastered: 0, inProgress: 0, total: 0 };
    const total = checklist.length;
    const mastered = checklist.filter(c => c.status === 'Mastered').length;
    const inProgress = checklist.filter(c => c.status === 'In Progress').length;
    const score = ((mastered * 1 + inProgress * 0.5) / total) * 100;
    return {
      percent: Math.round(score),
      mastered,
      inProgress,
      total
    };
  };

  const prepStats = calculatePrepStats();

  // Create or Update Schedule
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !role || !scheduleDate) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      const method = editingScheduleId ? 'PUT' : 'POST';
      const body = editingScheduleId 
        ? { id: editingScheduleId, company, role, scheduleDate, notes: scheduleNotes }
        : { company, role, scheduleDate, notes: scheduleNotes };

      const res = await fetch('/api/schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingScheduleId ? 'Schedule updated.' : 'Schedule added.');
        setIsScheduleModalOpen(false);
        setCompany('');
        setRole('');
        setScheduleDate('');
        setScheduleNotes('');
        setEditingScheduleId(null);
        fetchData();
      } else {
        toast.error(data.error || 'Operation failed.');
      }
    } catch {
      toast.error('Failed to save schedule.');
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Schedule removed.');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete.');
      }
    } catch {
      toast.error('Error removing schedule.');
    }
  };

  // Mark Completed
  const toggleScheduleCompleted = async (sched: Schedule) => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sched.id,
          company: sched.company,
          role: sched.role,
          scheduleDate: sched.scheduleDate,
          notes: sched.notes,
          completed: !sched.completed
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(sched.completed ? 'Schedule marked active.' : 'Interview marked completed! 🎉');
        fetchData();
      }
    } catch {
      toast.error('Failed to toggle status.');
    }
  };

  // Cycle Checklist Status (Admin only)
  const handleChecklistStatusCycle = async (item: ChecklistItem) => {
    if (!isAdmin) {
      toast.error('Admin permission required to toggle topic statuses.');
      return;
    }

    const statusCycle: Record<string, 'Not Started' | 'In Progress' | 'Mastered'> = {
      'Not Started': 'In Progress',
      'In Progress': 'Mastered',
      'Mastered': 'Not Started'
    };
    const nextStatus = statusCycle[item.status];

    try {
      const res = await fetch('/api/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Topic updated to ${nextStatus}.`);
        fetchData();
      }
    } catch {
      toast.error('Failed to update status.');
    }
  };

  // Add Checklist Guide Topic
  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkTitle || !chkTopic) {
      toast.error('Checklist title and topic description are required.');
      return;
    }

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chkTitle,
          topic: chkTopic,
          categorySlug: chkCategory || null,
          status: 'Not Started'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Checklist guide topic added.');
        setIsChecklistModalOpen(false);
        setChkTitle('');
        setChkTopic('');
        setChkCategory('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save checklist.');
    }
  };

  // Delete Checklist guide
  const handleDeleteChecklistItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this topic checklist?')) return;
    try {
      const res = await fetch(`/api/checklist?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Topic deleted.');
        fetchData();
      }
    } catch {
      toast.error('Error removing topic.');
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-10 space-y-8 select-none">
      
      {/* Viewport fixed reading / schedule stats header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-app/40 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary">
            Schedules & Prep Guides
          </h1>
          <p className="text-xs md:text-sm text-text-muted mt-1">
            Keep track of interview timelines, countdowns, and preparation topics.
          </p>
        </div>
        
        {/* Dynamic mastery score indicator */}
        <div className="glass-panel p-4 rounded-2xl border border-border-app/40 flex items-center gap-4 shrink-0 shadow-lg">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            {/* SVG circle meter */}
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="transparent" stroke="var(--accent-app)" strokeWidth="4" 
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - prepStats.percent / 100)}`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <span className="absolute text-xs font-bold text-text-primary">{prepStats.percent}%</span>
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-accent-app flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Readiness Score
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {prepStats.mastered} Mastered • {prepStats.inProgress} In Progress
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader className="w-8 h-8 text-accent-app animate-spin" />
          <span className="text-xs text-text-muted">Loading schedule and checklist data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT: Interview Schedules */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent-app" />
                <span>Interview Timeline</span>
              </h2>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingScheduleId(null);
                    setCompany('');
                    setRole('');
                    setScheduleDate('');
                    setScheduleNotes('');
                    setIsScheduleModalOpen(true);
                  }}
                  className="p-1 rounded-lg bg-accent-app/10 border border-accent-app/20 text-accent-app hover:bg-accent-app/20 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="border border-border-app/40 rounded-2xl p-6 text-center text-text-muted text-xs bg-surface-app/20">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-text-muted/30" />
                  No upcoming interview schedules.
                </div>
              ) : (
                schedules.map((sched) => {
                  const countdown = getCountdownDetails(sched.scheduleDate, sched.completed);
                  return (
                    <motion.div
                      key={sched.id}
                      layoutId={`sched-${sched.id}`}
                      className={`glass-panel border rounded-2xl p-4 shadow-md transition-all flex flex-col justify-between gap-4 ${
                        sched.completed 
                          ? 'border-emerald-500/10 opacity-70 bg-emerald-500/[0.01]' 
                          : 'border-border-app hover:border-accent-app/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-text-primary truncate">{sched.company}</h3>
                          <p className="text-xs text-text-muted font-medium mt-0.5 truncate">{sched.role}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${countdown.class}`}>
                          {countdown.label}
                        </span>
                      </div>

                      {sched.notes && (
                        <p className="text-xs text-text-muted bg-black/10 p-2 rounded-lg border border-border-app/20 line-clamp-2">
                          {sched.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between border-t border-border-app/40 pt-3">
                        <span className="text-[10px] text-text-muted flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-text-muted/65" />
                          {new Date(sched.scheduleDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => toggleScheduleCompleted(sched)}
                                title={sched.completed ? 'Mark Active' : 'Mark Completed'}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  sched.completed
                                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingScheduleId(sched.id);
                                  setCompany(sched.company);
                                  setRole(sched.role);
                                  // Format ISO to local datetime format
                                  const d = new Date(sched.scheduleDate);
                                  const localFormat = d.toISOString().slice(0, 16);
                                  setScheduleDate(localFormat);
                                  setScheduleNotes(sched.notes || '');
                                  setIsScheduleModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-accent-app transition-all cursor-pointer"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSchedule(sched.id)}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT/MIDDLE: Preparation checklist guides */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-accent-app" />
                <span>Developer Mastery Guide Checklist</span>
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setIsChecklistModalOpen(true)}
                  className="p-1 rounded-lg bg-accent-app/10 border border-accent-app/20 text-accent-app hover:bg-accent-app/20 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Topic</span>
                </button>
              )}
            </div>

            {/* Preparation Checklist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklist.length === 0 ? (
                <div className="md:col-span-2 border border-border-app/40 rounded-2xl p-8 text-center text-text-muted text-xs bg-surface-app/20">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 text-text-muted/30" />
                  Checklist is currently empty.
                </div>
              ) : (
                checklist.map((item) => {
                  const statusColors = {
                    'Not Started': 'bg-red-500/10 border-red-500/20 text-red-400',
                    'In Progress': 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                    'Mastered': 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  };

                  return (
                    <motion.div
                      key={item.id}
                      className="glass-panel border border-border-app rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3 hover:border-border-app/80 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-accent-app/10 text-accent-app border border-accent-app/15 rounded-md truncate max-w-[120px]">
                            {item.categoryName || 'General'}
                          </span>
                          
                          <button
                            onClick={() => handleChecklistStatusCycle(item)}
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border transition-all cursor-pointer ${statusColors[item.status]}`}
                            title={isAdmin ? "Click to cycle status" : "Status (Admin change only)"}
                          >
                            {item.status}
                          </button>
                        </div>

                        <h3 className="font-bold text-xs md:text-sm text-text-primary mt-2">{item.title}</h3>
                        <p className="text-[11px] md:text-xs text-text-muted mt-1 leading-relaxed bg-black/10 p-2 rounded-lg border border-border-app/10">
                          {item.topic}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-border-app/25 pt-2.5 mt-1">
                        <span className="text-[9px] text-text-muted/50 font-bold uppercase tracking-wider">
                          Topic ID #{item.id}
                        </span>
                        
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            className="p-1 rounded text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete topic"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      <AnimatePresence>
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScheduleModalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md bg-surface-app border border-border-app rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent-app" />
                <span>{editingScheduleId ? 'Modify Interview Schedule' : 'Schedule Interview'}</span>
              </h3>
              
              <form onSubmit={handleScheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Company</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google, Microsoft"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Role</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior .NET Engineer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Notes / Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Provide meeting link, technical stack details, etc."
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-accent-app hover:opacity-90 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg"
                  >
                    Save Timeline
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHECKLIST MODAL */}
      <AnimatePresence>
        {isChecklistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChecklistModalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md bg-surface-app border border-border-app rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-accent-app" />
                <span>Create Mastery Topic Guide</span>
              </h3>
              
              <form onSubmit={handleChecklistSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Topic Name / Question</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Transient vs Scoped lifetimes"
                    value={chkTitle}
                    onChange={(e) => setChkTitle(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Checklist Category</label>
                  <select
                    value={chkCategory}
                    onChange={(e) => setChkCategory(e.target.value)}
                    className="w-full bg-surface-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  >
                    <option value="">General / None</option>
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Syllabus Topic / Sub-details</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Sub-details or critical answer parameters to study..."
                    value={chkTopic}
                    onChange={(e) => setChkTopic(e.target.value)}
                    className="w-full bg-black/20 border border-border-app rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-app"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChecklistModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-accent-app hover:opacity-90 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg"
                  >
                    Add Syllabus
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
