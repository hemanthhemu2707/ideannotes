'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Send,
  X,
  User,
  Hash,
  Sparkles,
  Lock,
  MessageCircle,
  Clock,
  Compass,
  Link2,
  UserPlus,
  Users,
  Check,
  Copy,
  Crown,
  Trash2,
  LogIn,
  AtSign,
  Briefcase,
  ChevronRight,
  Calendar,
  FileText,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChatGroup {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  createdDate: string;
}

interface ChatMessage {
  id: number;
  groupId: number;
  username: string;
  messageText: string;
  createdDate: string;
}

interface GroupMember {
  username: string;
  joinedDate: string;
  isCreator: boolean;
}

export default function GroupChatPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-bg-app">
        <div className="w-6 h-6 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GroupChatInner />
    </Suspense>
  );
}

function GroupChatInner() {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [mobileActivePanel, setMobileActivePanel] = useState<'channels' | 'messages'>('channels');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  // Message Sending
  const [newMessageText, setNewMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Create Group Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Add Member Modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Invite link
  const [linkCopied, setLinkCopied] = useState(false);

  // @ Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete states for rich mentions (@ and #)
  const [autocompleteTrigger, setAutocompleteTrigger] = useState<'@' | '#' | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompleteCursorPos, setAutocompleteCursorPos] = useState(0);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  // Loaded mention reference data
  const [experiences, setExperiences] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Detailed preview drawers
  const [selectedNoteForDrawer, setSelectedNoteForDrawer] = useState<any | null>(null);
  const [selectedExpForDrawer, setSelectedExpForDrawer] = useState<any | null>(null);
  const [highlightQuestionId, setHighlightQuestionId] = useState<number | null>(null);

  // Interview experience panel (when clicking @mention)
  const [mentionPanelUser, setMentionPanelUser] = useState<string | null>(null);
  const [mentionPanelExperiences, setMentionPanelExperiences] = useState<any[]>([]);
  const [mentionPanelLoading, setMentionPanelLoading] = useState(false);

  // Delete Group
  const [deleteGroupModalOpen, setDeleteGroupModalOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Invite join state
  const [inviteJoining, setInviteJoining] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load user session
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Load all chat groups the user is a member of
  const loadGroups = useCallback(async (selectGroupId?: number) => {
    try {
      const res = await fetch('/api/group-chat');
      const data = await res.json();
      if (data.success && data.groups) {
        setGroups(data.groups);

        // Decide which group to select
        if (selectGroupId) {
          const toSelect = data.groups.find((g: ChatGroup) => g.id === selectGroupId);
          if (toSelect) {
            setSelectedGroup(toSelect);
            setMobileActivePanel('messages');
          }
        } else if (data.groups.length > 0 && !selectedGroup) {
          setSelectedGroup(data.groups[0]);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load chat channels.');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, setMobileActivePanel]);

  // Load messages for the selected group
  const loadMessages = async (groupId: number, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const res = await fetch(`/api/group-chat/messages?groupId=${groupId}`);
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
        
        // Mark group as read silently
        fetch('/api/group-chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId })
        }).catch(err => console.error('Failed to mark read:', err));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  // Load group members
  const loadMembers = async (groupId: number) => {
    try {
      const res = await fetch(`/api/group-chat/members?groupId=${groupId}`);
      const data = await res.json();
      if (data.success && data.members) {
        setGroupMembers(data.members);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load all system users for the "add member" modal
  const loadAllUsers = async () => {
    try {
      const res = await fetch('/api/group-chat/users');
      const data = await res.json();
      if (data.success && data.users) {
        setAllUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle invite link on mount
  const handleInviteLink = useCallback(async (currentUser: { username: string; role: string } | null) => {
    const inviteId = searchParams.get('invite');
    if (!inviteId) return;

    if (!currentUser) {
      // Store invite in sessionStorage so we can handle it after login
      sessionStorage.setItem('pendingInvite', inviteId);
      toast.error('Please log in first, then the invite will be processed automatically.');
      return;
    }

    setInviteJoining(true);
    try {
      const res = await fetch('/api/group-chat/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: parseInt(inviteId) })
      });
      const data = await res.json();

      if (data.success) {
        if (data.alreadyMember) {
          toast.success('You are already a member of this group!');
        } else {
          toast.success('You have joined the group successfully!');
        }
        // Reload groups and select the invited one
        await loadGroups(parseInt(inviteId));
      } else {
        toast.error(data.error || 'Failed to join group.');
      }
    } catch {
      toast.error('Failed to join group via invite link.');
    } finally {
      setInviteJoining(false);
      // Clear the invite param from URL
      router.replace('/group-chat');
    }
  }, [searchParams]);

  // Fetch references for autocomplete
  const fetchReferenceData = useCallback(async () => {
    try {
      const [intRes, noteRes, catRes] = await Promise.all([
        fetch('/api/interviews'),
        fetch('/api/notes'),
        fetch('/api/categories')
      ]);
      const [intData, noteData, catData] = await Promise.all([
        intRes.json(),
        noteRes.json(),
        catRes.json()
      ]);
      if (intData.success) setExperiences(intData.experiences);
      if (noteData.success) setNotes(noteData.notes);
      if (catData.success) setCategories(catData.categories);
    } catch (e) {
      console.error('Failed to load reference data for mentions:', e);
    }
  }, []);

  // Init mount
  useEffect(() => {
    const init = async () => {
      const currentUser = await fetchSession();
      await fetchReferenceData();

      // Check if there is a group select request
      const selectId = searchParams.get('select');
      if (selectId && currentUser) {
        await loadGroups(parseInt(selectId));
        router.replace('/group-chat');
        return;
      }

      await loadGroups();

      // Check for pending invite in sessionStorage first (from a previous redirect)
      const pendingInvite = sessionStorage.getItem('pendingInvite');
      if (pendingInvite && currentUser) {
        sessionStorage.removeItem('pendingInvite');
        setInviteJoining(true);
        try {
          const res = await fetch('/api/group-chat/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: parseInt(pendingInvite) })
          });
          const data = await res.json();
          if (data.success) {
            toast.success(data.alreadyMember ? 'Already a member!' : 'Joined group successfully!');
            await loadGroups(parseInt(pendingInvite));
          }
        } catch { /* ignore */ } finally {
          setInviteJoining(false);
        }
      } else {
        // Handle invite from URL params
        await handleInviteLink(currentUser);
      }
    };
    init();
  }, [searchParams]);

  // Poll for messages in the active group
  useEffect(() => {
    if (!selectedGroup) return;

    // Load immediately
    loadMessages(selectedGroup.id);

    // Start 2-second short-polling interval
    const interval = setInterval(() => {
      loadMessages(selectedGroup.id, true);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedGroup]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create Chat Group Handler
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || newGroupName.trim() === '') {
      toast.error('Please enter a channel name.');
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await fetch('/api/group-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Channel #${newGroupName} created successfully!`);
        setIsModalOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');

        // Reload and select the new group
        await loadGroups(data.groupId);
      } else {
        toast.error(data.error || 'Failed to create group.');
      }
    } catch {
      toast.error('Server error. Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Post Message Handler
  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !user) return;
    if (!newMessageText || newMessageText.trim() === '') return;

    const messageToSend = newMessageText.trim();
    setNewMessageText('');
    setSending(true);

    // Optimistic UI Update
    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      groupId: selectedGroup.id,
      username: user.username,
      messageText: messageToSend,
      createdDate: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/group-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          messageText: messageToSend
        })
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Failed to send message.');
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMsg.id));
      } else {
        loadMessages(selectedGroup.id, true);
      }
    } catch {
      toast.error('Connection error. Failed to post message.');
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  // Copy invite link to clipboard
  const handleCopyInviteLink = () => {
    if (!selectedGroup) return;
    const link = `${window.location.origin}/group-chat?invite=${selectedGroup.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2500);
    }).catch(() => {
      toast.error('Failed to copy link.');
    });
  };

  // Open Add Member modal
  const openAddMemberModal = async () => {
    if (!selectedGroup) return;
    setIsAddMemberOpen(true);
    setMemberSearch('');
    await Promise.all([loadAllUsers(), loadMembers(selectedGroup.id)]);
  };

  // Add a member to the selected group
  const handleAddMember = async (username: string) => {
    if (!selectedGroup) return;
    setAddingMember(username);
    try {
      const res = await fetch('/api/group-chat/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroup.id, username })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.alreadyMember ? `${username} is already a member.` : `${username} added successfully!`);
        await loadMembers(selectedGroup.id);
      } else {
        toast.error(data.error || 'Failed to add member.');
      }
    } catch {
      toast.error('Error adding member.');
    } finally {
      setAddingMember(null);
    }
  };

  // Remove a member from the selected group
  const handleRemoveMember = async (username: string) => {
    if (!selectedGroup) return;
    setRemovingMember(username);
    try {
      const res = await fetch(`/api/group-chat/members?groupId=${selectedGroup.id}&username=${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${username} removed from the group.`);
        await loadMembers(selectedGroup.id);
      } else {
        toast.error(data.error || 'Failed to remove member.');
      }
    } catch {
      toast.error('Error removing member.');
    } finally {
      setRemovingMember(null);
    }
  };

  // Delete entire chat group (Admin only)
  const handleDeleteGroup = async () => {
    if (!selectedGroup || !isAdmin) return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/group-chat?groupId=${selectedGroup.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Group deleted successfully.');
        setSelectedGroup(null);
        setMessages([]);
        setDeleteGroupModalOpen(false);
        await loadGroups();
      } else {
        toast.error(data.error || 'Failed to delete group.');
      }
    } catch {
      toast.error('Server error. Failed to delete group.');
    } finally {
      setDeletingGroup(false);
    }
  };

  // Handle message input changes - detect @ or # for autocomplete
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessageText(val);
    const cursor = e.target.selectionStart || 0;
    setAutocompleteCursorPos(cursor);

    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/(^|[\s])@(\w*)$/);
    const hashMatch = textBeforeCursor.match(/(^|[\s])#(\w*)$/);

    if (atMatch) {
      setAutocompleteTrigger('@');
      setAutocompleteQuery(atMatch[2]);
      setAutocompleteOpen(true);
    } else if (hashMatch) {
      setAutocompleteTrigger('#');
      setAutocompleteQuery(hashMatch[2]);
      setAutocompleteOpen(true);
    } else {
      setAutocompleteTrigger(null);
      setAutocompleteQuery('');
      setAutocompleteOpen(false);
    }
  };

  // Helper to trace nested categories hierarchy path
  const getCategoryPath = (slug: string, cats: any[]): string => {
    const cat = cats.find(c => c.slug === slug);
    if (!cat) return '';
    if (cat.parentSlug) {
      const parentPath = getCategoryPath(cat.parentSlug, cats);
      return parentPath ? `${parentPath} > ${cat.name}` : cat.name;
    }
    return cat.name;
  };

  // Filter autocomplete suggestions based on trigger and search query
  const getAutocompleteSuggestions = () => {
    if (autocompleteTrigger === '@') {
      const filteredUsers = groupMembers
        .map(m => m.username)
        .filter(u => u.toLowerCase().includes(autocompleteQuery.toLowerCase()))
        .map(u => ({ type: 'user', name: u }));

      const filteredExps = experiences
        .filter(exp => 
          exp.companyName.toLowerCase().includes(autocompleteQuery.toLowerCase()) || 
          exp.round.toLowerCase().includes(autocompleteQuery.toLowerCase()) ||
          exp.interviewerName.toLowerCase().includes(autocompleteQuery.toLowerCase())
        )
        .map(exp => ({ 
          type: 'experience', 
          id: exp.id, 
          companyName: exp.companyName, 
          round: exp.round, 
          interviewerName: exp.interviewerName 
        }));

      return [...filteredUsers, ...filteredExps];
    } else if (autocompleteTrigger === '#') {
      const filteredNotes = notes
        .filter(note => {
          const title = note.metadata?.title || note.title || '';
          return title.toLowerCase().includes(autocompleteQuery.toLowerCase());
        })
        .map(note => ({
          type: 'note',
          title: note.metadata?.title || note.title,
          slug: note.slug,
          categoryFolder: note.categoryFolder || note.CategorySlug,
          categoryPath: getCategoryPath(note.categoryFolder || note.CategorySlug, categories)
        }));

      const allQuestions: any[] = [];
      experiences.forEach(exp => {
        if (exp.questions) {
          exp.questions.forEach((q: any) => {
            allQuestions.push({
              type: 'question',
              id: q.id,
              experienceId: exp.id,
              companyName: exp.companyName,
              questionText: q.questionText
            });
          });
        }
      });

      const filteredQuestions = allQuestions
        .filter(q => 
          q.questionText.toLowerCase().includes(autocompleteQuery.toLowerCase()) || 
          q.companyName.toLowerCase().includes(autocompleteQuery.toLowerCase())
        );

      return [...filteredNotes, ...filteredQuestions];
    }
    return [];
  };

  const autocompleteSuggestions = getAutocompleteSuggestions().slice(0, 10);

  // Insert rich tags on selecting autocomplete suggestion
  const handleSelectSuggestion = (suggestion: any) => {
    const textBeforeCursor = newMessageText.slice(0, autocompleteCursorPos);
    const textAfterCursor = newMessageText.slice(autocompleteCursorPos);
    
    let insertText = '';
    let triggerIndex = -1;

    if (autocompleteTrigger === '@') {
      triggerIndex = textBeforeCursor.lastIndexOf('@');
      if (suggestion.type === 'user') {
        insertText = `@${suggestion.name} `;
      } else if (suggestion.type === 'experience') {
        insertText = `@Interview:[${suggestion.companyName} - ${suggestion.round}](${suggestion.id}) `;
      }
    } else if (autocompleteTrigger === '#') {
      triggerIndex = textBeforeCursor.lastIndexOf('#');
      if (suggestion.type === 'note') {
        insertText = `#Note:[${suggestion.title}](${suggestion.categoryFolder}/${suggestion.slug}) `;
      } else if (suggestion.type === 'question') {
        // Limit question text snippet to keep tags reasonably sized
        const cleanQText = suggestion.questionText.replace(/[\[\]\(\)]/g, '').substring(0, 30);
        insertText = `#Question:[${suggestion.companyName} - ${cleanQText}...](${suggestion.experienceId}/${suggestion.id}) `;
      }
    }

    if (triggerIndex !== -1) {
      const newText = textBeforeCursor.slice(0, triggerIndex) + insertText + textAfterCursor;
      setNewMessageText(newText);
    }

    setAutocompleteOpen(false);
    setAutocompleteTrigger(null);
    setAutocompleteQuery('');
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  // Open Preview drawers inside chatroom
  const openInterviewDrawer = (expId: number) => {
    const exp = experiences.find(e => e.id === expId);
    if (exp) {
      setSelectedExpForDrawer(exp);
      setHighlightQuestionId(null);
    } else {
      toast.error('Interview experience details not found.');
    }
  };

  const openQuestionDrawer = (expId: number, qId: number) => {
    const exp = experiences.find(e => e.id === expId);
    if (exp) {
      setSelectedExpForDrawer(exp);
      setHighlightQuestionId(qId);
    } else {
      toast.error('Question details not found.');
    }
  };

  const openNoteDrawer = async (categoryFolder: string, slug: string) => {
    try {
      const res = await fetch(`/api/notes/detail?categoryFolder=${categoryFolder}&slug=${slug}`);
      const data = await res.json();
      if (data.success && data.note) {
        setSelectedNoteForDrawer(data.note);
      } else {
        const found = notes.find(n => n.categoryFolder === categoryFolder && n.slug === slug);
        if (found) {
          setSelectedNoteForDrawer(found);
        } else {
          toast.error('Note details not found.');
        }
      }
    } catch {
      toast.error('Failed to load note content.');
    }
  };

  // Click on @mention in message — open user interview experiences panel
  const handleMentionClick = async (username: string) => {
    setMentionPanelUser(username);
    setMentionPanelLoading(true);
    setMentionPanelExperiences([]);
    try {
      const res = await fetch('/api/interviews');
      const data = await res.json();
      if (data.success) {
        const userExps = data.experiences.filter(
          (exp: any) => exp.interviewerName.toLowerCase() === username.toLowerCase()
        );
        setMentionPanelExperiences(userExps);
      }
    } catch {
      // ignore
    } finally {
      setMentionPanelLoading(false);
    }
  };

  // Render message text with rich @mentions & #references as clickable badges
  const renderMessageWithMentions = (text: string) => {
    if (!text) return '';
    const tokenRegex = /(@Interview:\[[^\]]+\]\(\d+\)|#Note:\[[^\]]+\]\([^\)]+\)|#Question:\[[^\]]+\]\(\d+\/\d+\)|@\w+)/g;
    const parts = text.split(tokenRegex);
    
    return parts.map((part, i) => {
      // 1. Interview Experience Mention
      if (part.startsWith('@Interview:')) {
        const match = part.match(/@Interview:\[([^\]]+)\]\((\d+)\)/);
        if (match) {
          const [_, label, expIdStr] = match;
          const expId = parseInt(expIdStr);
          return (
            <button
              key={i}
              type="button"
              onClick={() => openInterviewDrawer(expId)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 my-0.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-bold text-[11px] cursor-pointer transition-colors border border-emerald-500/20 align-middle"
            >
              <Briefcase className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{label}</span>
            </button>
          );
        }
      }
      
      // 2. Note Mention
      if (part.startsWith('#Note:')) {
        const match = part.match(/#Note:\[([^\]]+)\]\(([^/]+)\/([^\)]+)\)/);
        if (match) {
          const [_, label, categoryFolder, slug] = match;
          return (
            <button
              key={i}
              type="button"
              onClick={() => openNoteDrawer(categoryFolder, slug)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 my-0.5 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 font-bold text-[11px] cursor-pointer transition-colors border border-indigo-500/20 align-middle"
            >
              <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>{label}</span>
            </button>
          );
        }
      }

      // 3. Question Mention
      if (part.startsWith('#Question:')) {
        const match = part.match(/#Question:\[([^\]]+)\]\((\d+)\/(\d+)\)/);
        if (match) {
          const [_, label, expIdStr, qIdStr] = match;
          const expId = parseInt(expIdStr);
          const qId = parseInt(qIdStr);
          return (
            <button
              key={i}
              type="button"
              onClick={() => openQuestionDrawer(expId, qId)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 my-0.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 font-bold text-[11px] cursor-pointer transition-colors border border-amber-500/20 align-middle"
            >
              <HelpCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{label}</span>
            </button>
          );
        }
      }

      // 4. User Mention
      if (/^@\w+$/.test(part)) {
        const username = part.slice(1);
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleMentionClick(username)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 font-bold text-[11px] cursor-pointer transition-colors border border-indigo-500/20"
          >
            <AtSign className="w-2.5 h-2.5 text-indigo-400" />{username}
          </button>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  // Filtered members for @ mention dropdown
  const mentionSuggestions = groupMembers
    .map(m => m.username)
    .filter(u => mentionQuery === '' || u.toLowerCase().startsWith(mentionQuery.toLowerCase()));

  // Format time
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  // Filtered user list for the "add member" modal (exclude those already members)
  const memberUsernames = new Set(groupMembers.map(m => m.username));
  const filteredUsersToAdd = allUsers
    .filter(u => !memberUsernames.has(u))
    .filter(u => memberSearch === '' || u.toLowerCase().includes(memberSearch.toLowerCase()));

  const isGroupCreator = selectedGroup && user && selectedGroup.createdBy === user.username;
  const isAdmin = user?.role === 'Admin';

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-bg-app">
      {/* Invite Joining Overlay */}
      <AnimatePresence>
        {inviteJoining && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-3 text-text-primary">
              <div className="w-8 h-8 border-3 border-accent-app border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold">Joining group...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT CHANNEL SIDEBAR PANEL */}
      <div className={`${mobileActivePanel === 'channels' ? 'flex' : 'hidden'} md:flex w-full md:w-80 shrink-0 border-r border-border-app/45 flex-col h-full bg-surface-app/15 backdrop-blur-md`}>
        {/* Panel Header */}
        <div className="p-4.5 border-b border-border-app/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-accent-app animate-spin-slow" />
            <h1 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
              Discussion Hub
            </h1>
          </div>

          <button
            onClick={() => {
              if (!user) {
                toast.error('Please unlock/login to create groups.');
                return;
              }
              setIsModalOpen(true);
            }}
            className="p-1.5 bg-accent-app/10 border border-accent-app/20 hover:bg-accent-app/20 text-accent-app rounded-xl transition-all flex items-center justify-center cursor-pointer shadow"
            title="Create New Channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Channels listing */}
        <div className="flex-grow overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted text-xs">
              <div className="w-5 h-5 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
              <span>Loading discussions...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-xs space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-text-muted/40 mb-2" />
              <p className="font-semibold">No groups yet</p>
              <p className="text-[10px] text-text-muted/70 max-w-[200px] mx-auto">
                Create a new channel or join one via an invite link to start chatting.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <div
                key={g.id}
                onClick={() => {
                  setSelectedGroup(g);
                  setMobileActivePanel('messages');
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 relative overflow-hidden group ${
                  selectedGroup?.id === g.id
                    ? 'bg-accent-app/10 border-accent-app/40 shadow-sm'
                    : 'bg-surface-app/30 border-border-app/30 hover:border-border-app/50 hover:bg-surface-app/40'
                }`}
              >
                {selectedGroup?.id === g.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-app" />
                )}

                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 border border-border-app/50 text-xs font-extrabold text-accent-app group-hover:bg-accent-app/20 group-hover:border-accent-app/30 transition-all shrink-0">
                  #
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-text-primary group-hover:text-accent-app transition-colors truncate">
                    {g.name}
                  </h4>
                  {g.description && (
                    <span className="text-[10px] text-text-muted truncate block mt-0.5 font-medium leading-none">
                      {g.description}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT MESSAGES CONVERSATION PANEL */}
      <div className={`${mobileActivePanel === 'messages' ? 'flex' : 'hidden'} md:flex flex-1 flex-col h-full bg-black/10 overflow-hidden relative`}>
        {selectedGroup ? (
          <div className="flex-grow flex flex-col h-full overflow-hidden">
            {/* Conversation Header */}
            <div className="p-4 px-5 border-b border-border-app/45 bg-surface-app/10 flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => {
                      setMobileActivePanel('channels');
                      setSelectedGroup(null);
                    }}
                    className="md:hidden p-1 mr-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                    title="Back to Channels"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <Hash className="w-4 h-4 text-accent-app shrink-0" />
                  <h2 className="text-sm font-extrabold text-text-primary truncate">
                    {selectedGroup.name}
                  </h2>
                </div>
                {selectedGroup.description && (
                  <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-2xl font-medium">
                    {selectedGroup.description}
                  </p>
                )}
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Copy Invite Link Button */}
                {user && (
                  <button
                    onClick={handleCopyInviteLink}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-bold ${
                      linkCopied
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-border-app/30 text-text-muted hover:text-accent-app hover:border-accent-app/30'
                    }`}
                    title="Copy Invite Link"
                  >
                    {linkCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{linkCopied ? 'Copied!' : 'Invite Link'}</span>
                  </button>
                )}

                {/* Add Member / Manage Members Button */}
                {user && (
                  <button
                    onClick={openAddMemberModal}
                    className="p-1.5 rounded-lg border bg-white/5 border-border-app/30 text-text-muted hover:text-accent-app hover:border-accent-app/30 transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-bold"
                    title="Manage Members"
                  >
                    <Users className="w-3 h-3" />
                    <span className="hidden sm:inline">Members</span>
                  </button>
                )}

                {/* Delete Group Button — Admin Only */}
                {isAdmin && (
                  <button
                    onClick={() => setDeleteGroupModalOpen(true)}
                    className="p-1.5 rounded-lg border bg-red-500/5 border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-bold"
                    title="Delete Group (Admin)"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}

                <div className="text-[9px] text-text-muted bg-white/5 border border-border-app/30 px-2.5 py-1 rounded-lg select-none shrink-0 font-bold">
                  by {selectedGroup.createdBy}
                </div>
              </div>
            </div>

            {/* Conversation Message Stream */}
            <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 flex flex-col">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-text-muted text-xs gap-2">
                  <div className="w-6 h-6 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-text-muted/65 italic text-xs">
                  <MessageCircle className="w-10 h-10 text-text-muted/40 mb-2" />
                  <span>This is the start of # {selectedGroup.name} conversation stream.</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = user && msg.username.toLowerCase() === user.username.toLowerCase();

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[85%] ${
                        isMe ? 'self-end flex-row-reverse' : 'self-start'
                      }`}
                    >
                      {/* Avatar */}
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md ${
                        isMe
                          ? 'bg-accent-app/20 border border-accent-app text-accent-app'
                          : 'bg-surface-app border border-border-app text-indigo-400'
                      }`}>
                        {msg.username.charAt(0).toUpperCase()}
                      </span>

                      {/* Message bubble */}
                      <div className="flex flex-col space-y-1">
                        {!isMe && (
                          <span className="text-[10px] font-extrabold text-indigo-400 pl-1">
                            {msg.username}
                          </span>
                        )}

                        <div className={`p-3 rounded-2xl border text-xs leading-relaxed break-words whitespace-pre-wrap ${
                          isMe
                            ? 'bg-accent-app border-accent-app text-white rounded-tr-none'
                            : 'bg-surface-app/40 border-border-app/40 text-text-primary rounded-tl-none'
                        }`}>
                          <p>{renderMessageWithMentions(msg.messageText)}</p>
                          <span className={`block text-[8px] text-right mt-1.5 font-bold ${
                            isMe ? 'text-white/60' : 'text-text-muted/70'
                          }`}>
                            {formatTime(msg.createdDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-border-app/45 bg-surface-app/10 shrink-0">
              {user ? (
                <div className="relative">
                  {/* Autocomplete Dropdown */}
                  <AnimatePresence>
                    {autocompleteOpen && autocompleteSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-slate-900 border border-border-app/50 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                      >
                        <div className="p-1.5 flex items-center gap-1.5 border-b border-border-app/30 px-3 py-2 bg-black/20">
                          {autocompleteTrigger === '@' ? (
                            <AtSign className="w-3.5 h-3.5 text-accent-app" />
                          ) : (
                            <Hash className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                            {autocompleteTrigger === '@' ? 'Mention a member or interview' : 'Reference note or question'}
                          </span>
                        </div>
                        {autocompleteSuggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(item); }}
                            className="flex items-start gap-2.5 w-full px-3 py-2 hover:bg-white/5 text-left transition-colors group border-b border-border-app/10 last:border-0"
                          >
                            {/* Icon column */}
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold bg-surface-app border border-border-app text-text-muted shrink-0 group-hover:text-accent-app group-hover:border-accent-app/30 transition-all mt-0.5">
                              {item.type === 'user' && <AtSign className="w-3 h-3 text-indigo-400" />}
                              {item.type === 'experience' && <Briefcase className="w-3 h-3 text-emerald-400" />}
                              {item.type === 'note' && <FileText className="w-3 h-3 text-indigo-400" />}
                              {item.type === 'question' && <HelpCircle className="w-3 h-3 text-amber-400" />}
                            </span>
                            
                            {/* Text column */}
                            <div className="min-w-0 flex-1">
                              {item.type === 'user' && (
                                <span className="text-xs font-semibold text-text-primary group-hover:text-accent-app transition-colors">{item.name}</span>
                              )}
                              {item.type === 'experience' && (
                                <>
                                  <span className="text-xs font-semibold text-text-primary group-hover:text-accent-app transition-colors block truncate">{item.companyName}</span>
                                  <span className="text-[9px] text-text-muted block truncate font-medium">{item.round} (by {item.interviewerName})</span>
                                </>
                              )}
                              {item.type === 'note' && (
                                <>
                                  <span className="text-xs font-semibold text-text-primary group-hover:text-accent-app transition-colors block truncate">{item.title}</span>
                                  <span className="text-[9px] text-text-muted block truncate font-medium">{item.categoryPath || 'Notes'}</span>
                                </>
                              )}
                              {item.type === 'question' && (
                                <>
                                  <span className="text-xs font-semibold text-text-primary group-hover:text-accent-app transition-colors block truncate leading-relaxed">{item.questionText}</span>
                                  <span className="text-[9px] text-text-muted block truncate font-medium">{item.companyName} interview</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <form onSubmit={handlePostMessage} className="flex gap-2">
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={newMessageText}
                      onChange={handleMessageInputChange}
                      onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)}
                      placeholder={`Message #${selectedGroup.name} — type @ or # to mention`}
                      className="flex-1 bg-black/20 border border-border-app/45 focus:border-accent-app/60 rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder-text-muted/40 focus:outline-none"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessageText.trim()}
                      className="px-4 py-2.5 bg-accent-app hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-md shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="glass-panel p-3.5 rounded-xl border border-border-app/40 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-accent-app" />
                  <span>Please unlock your account to participate in the conversation.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <MessageSquare className="w-12 h-12 text-text-muted/50 mb-3" />
            <h2 className="text-sm font-bold text-text-primary">No Discussion Selected</h2>
            <p className="text-xs text-text-muted max-w-sm mt-1">
              Select or create a chat channel on the left to start collaborating with other developers!
            </p>
          </div>
        )}
      </div>

      {/* CREATE NEW CHAT GROUP MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!creatingGroup) setIsModalOpen(false);
              }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-md glass-panel p-5 rounded-2xl border border-border-app bg-surface-app/40 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border-app/40">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-accent-app animate-pulse" />
                  <h2 className="text-xs font-extrabold text-text-primary uppercase tracking-wider">
                    Create New Channel
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={creatingGroup}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateGroup} className="py-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                    Channel Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. dotnet-prep, react-tips"
                    className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">
                    Channel Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="e.g. Chat about .NET Core DI and memory management doubt..."
                    className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={creatingGroup}
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 text-[10px] font-bold rounded-lg border border-border-app/40 text-text-muted hover:text-text-primary cursor-pointer hover:bg-white/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingGroup || !newGroupName.trim()}
                    className="px-4 py-2 bg-accent-app hover:opacity-90 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-accent-app/10"
                  >
                    {creatingGroup ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Channel</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / MANAGE MEMBERS MODAL */}
      <AnimatePresence>
        {isAddMemberOpen && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMemberOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-lg glass-panel p-5 rounded-2xl border border-border-app bg-surface-app/40 shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border-app/40 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4.5 h-4.5 text-accent-app" />
                  <h2 className="text-xs font-extrabold text-text-primary uppercase tracking-wider">
                    Members — #{selectedGroup.name}
                  </h2>
                </div>
                <button
                  onClick={() => setIsAddMemberOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Copy Invite Link Bar */}
              <div className="mt-3 p-3 rounded-xl bg-accent-app/5 border border-accent-app/20 flex items-center gap-3 shrink-0">
                <Link2 className="w-4 h-4 text-accent-app shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-primary">Share Invite Link</p>
                  <p className="text-[9px] text-text-muted truncate">
                    {window.location.origin}/group-chat?invite={selectedGroup.id}
                  </p>
                </div>
                <button
                  onClick={handleCopyInviteLink}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    linkCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-accent-app/10 text-accent-app border border-accent-app/20 hover:bg-accent-app/20'
                  }`}
                >
                  {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {linkCopied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Current Members */}
              <div className="mt-4 mb-2 shrink-0">
                <h3 className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2">
                  Current Members ({groupMembers.length})
                </h3>
              </div>
              <div className="overflow-y-auto max-h-40 space-y-1 mb-4 shrink-0">
                {groupMembers.map((member) => (
                  <div
                    key={member.username}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-white/3 border border-border-app/20 hover:border-border-app/40 transition-all"
                  >
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-app border border-border-app text-indigo-400 shrink-0">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary truncate">{member.username}</span>
                        {member.isCreator && (
                          <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20">
                            <Crown className="w-2.5 h-2.5" /> Creator
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Show remove button only for non-creators, and only if user is creator or admin */}
                    {!member.isCreator && (isGroupCreator || isAdmin) && (
                      <button
                        onClick={() => handleRemoveMember(member.username)}
                        disabled={removingMember === member.username}
                        className="p-1 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-400/10 cursor-pointer transition-all disabled:opacity-40"
                        title={`Remove ${member.username}`}
                      >
                        {removingMember === member.username ? (
                          <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Members */}
              <div className="shrink-0 mb-2">
                <h3 className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2">
                  Add New Members
                </h3>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full bg-black/20 border border-border-app/40 focus:border-accent-app/60 text-text-primary rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="overflow-y-auto flex-1 space-y-1 min-h-0">
                {filteredUsersToAdd.length === 0 ? (
                  <div className="text-center py-6 text-text-muted/60 text-[10px]">
                    {memberSearch ? 'No matching users found.' : 'All users are already members of this group.'}
                  </div>
                ) : (
                  filteredUsersToAdd.map((u) => (
                    <div
                      key={u}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-white/3 border border-border-app/20 hover:border-accent-app/30 transition-all group"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-app border border-border-app text-text-muted shrink-0 group-hover:text-accent-app group-hover:border-accent-app/30 transition-all">
                        {u.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 text-xs font-semibold text-text-primary truncate">{u}</span>
                      <button
                        onClick={() => handleAddMember(u)}
                        disabled={addingMember === u}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-accent-app/10 text-accent-app border border-accent-app/20 hover:bg-accent-app/20 cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1"
                      >
                        {addingMember === u ? (
                          <div className="w-3 h-3 border border-accent-app border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        <span>Add</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Close */}
              <div className="flex justify-end pt-3 border-t border-border-app/30 mt-3 shrink-0">
                <button
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3.5 py-2 text-[10px] font-bold rounded-lg border border-border-app/40 text-text-muted hover:text-text-primary cursor-pointer hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* INTERVIEW EXPERIENCE PANEL — opens when clicking @mention */}
      <AnimatePresence>
        {mentionPanelUser && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMentionPanelUser(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className="relative z-10 w-full sm:max-w-md h-[85vh] sm:h-[90vh] glass-panel rounded-t-2xl sm:rounded-2xl border border-border-app bg-surface-app/40 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-border-app/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-surface-app border border-border-app text-indigo-400 shrink-0">
                    {mentionPanelUser.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs font-extrabold text-text-primary">@{mentionPanelUser}</p>
                    <p className="text-[9px] text-text-muted">Interview Experiences</p>
                  </div>
                </div>
                <button onClick={() => setMentionPanelUser(null)} className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {mentionPanelLoading ? (
                  <div className="flex items-center justify-center py-12 text-text-muted text-xs gap-2">
                    <div className="w-5 h-5 border-2 border-accent-app border-t-transparent rounded-full animate-spin" />
                    <span>Loading experiences...</span>
                  </div>
                ) : mentionPanelExperiences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-text-muted text-xs gap-2 text-center">
                    <Briefcase className="w-8 h-8 text-text-muted/40" />
                    <p className="font-semibold">No interview experiences shared yet</p>
                    <p className="text-[10px] text-text-muted/60">{mentionPanelUser} hasn&apos;t shared any interview experiences.</p>
                  </div>
                ) : (
                  mentionPanelExperiences.map((exp) => (
                    <div key={exp.id} className="p-3.5 rounded-xl border border-border-app/40 bg-white/3 hover:border-border-app/60 transition-all space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Briefcase className="w-3.5 h-3.5 text-accent-app shrink-0" />
                            <span className="text-xs font-bold text-text-primary">{exp.companyName}</span>
                          </div>
                          <span className="text-[10px] text-text-muted font-medium">{exp.round}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-text-muted shrink-0">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(exp.interviewDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {exp.questions && exp.questions.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-border-app/20">
                          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{exp.questions.length} question{exp.questions.length !== 1 ? 's' : ''}</p>
                          {exp.questions.slice(0, 3).map((q: any, qi: number) => (
                            <div key={qi} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-accent-app shrink-0 mt-0.5" />
                              <p className="text-[10px] text-text-primary leading-snug line-clamp-2">{q.questionText}</p>
                            </div>
                          ))}
                          {exp.questions.length > 3 && (
                            <p className="text-[9px] text-text-muted pl-5">+{exp.questions.length - 3} more questions...</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE GROUP CONFIRMATION MODAL (Admin Only) */}
      <AnimatePresence>
        {deleteGroupModalOpen && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!deletingGroup) setDeleteGroupModalOpen(false); }}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative z-10 w-full max-w-sm glass-panel p-5 rounded-2xl border border-red-500/30 bg-surface-app/40 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trash2 className="w-4.5 h-4.5 text-red-400" />
                <h2 className="text-xs font-extrabold text-red-400 uppercase tracking-wider">Delete Group</h2>
              </div>
              <p className="text-xs text-text-muted leading-relaxed mb-5">
                Are you sure you want to permanently delete <span className="font-bold text-text-primary">#{selectedGroup.name}</span>? This will delete all messages and members. <span className="text-red-400 font-bold">This action cannot be undone.</span>
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteGroupModalOpen(false)}
                  disabled={deletingGroup}
                  className="px-3.5 py-2 text-[10px] font-bold rounded-lg border border-border-app/40 text-text-muted hover:text-text-primary cursor-pointer hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  disabled={deletingGroup}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {deletingGroup ? (
                    <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Deleting...</span></>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /><span>Delete Permanently</span></>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERVIEW DETAIL PREVIEW DRAWER */}
      <AnimatePresence>
        {selectedExpForDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedExpForDrawer(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 w-full max-w-lg h-full bg-slate-900 border-l border-border-app/50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border-app/40 bg-black/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-accent-app" />
                  <div>
                    <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wide">
                      {selectedExpForDrawer.companyName}
                    </h2>
                    <p className="text-[10px] text-text-muted">{selectedExpForDrawer.round} ({new Date(selectedExpForDrawer.interviewDate).toLocaleDateString()})</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedExpForDrawer(null)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-grow overflow-y-auto p-5 space-y-4">
                <div className="text-[10px] text-text-muted select-none uppercase tracking-wider font-extrabold border-b border-border-app/20 pb-1 mb-2">
                  Shared questions
                </div>
                {selectedExpForDrawer.questions && selectedExpForDrawer.questions.length > 0 ? (
                  selectedExpForDrawer.questions.map((q: any) => {
                    const isHighlighted = highlightQuestionId === q.id;
                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isHighlighted 
                            ? 'bg-accent-app/10 border-accent-app shadow-md ring-1 ring-accent-app/30' 
                            : 'bg-white/3 border-border-app/30'
                        }`}
                      >
                        <h4 className="text-xs font-bold text-text-primary mb-2 flex items-start gap-1.5 leading-relaxed">
                          <span className="text-accent-app font-extrabold">Q:</span>
                          <span>{q.questionText}</span>
                        </h4>
                        
                        {/* Answers block */}
                        {q.answers && q.answers.length > 0 ? (
                          <div className="mt-3 pt-2.5 border-t border-border-app/20 space-y-2">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">Answers</span>
                            {q.answers.map((ans: any) => (
                              <div key={ans.id} className="text-[11px] bg-black/30 p-2.5 rounded-lg border border-border-app/15">
                                <div className="flex justify-between items-center mb-1 text-[9px] font-semibold text-text-muted">
                                  <span>by {ans.username}</span>
                                  <span>{new Date(ans.updatedDate).toLocaleDateString()}</span>
                                </div>
                                <p className="text-text-primary leading-relaxed whitespace-pre-wrap">{ans.answerText}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-text-muted/65 italic pl-5 mt-2">No answers posted yet.</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-text-muted italic">No questions listed in this experience.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOTE DETAIL PREVIEW DRAWER */}
      <AnimatePresence>
        {selectedNoteForDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNoteForDrawer(null)}
              className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 w-full max-w-lg h-full bg-slate-900 border-l border-border-app/50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border-app/40 bg-black/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-app" />
                  <div>
                    <h2 className="text-sm font-extrabold text-text-primary truncate max-w-[280px]">
                      {selectedNoteForDrawer.metadata?.title || selectedNoteForDrawer.title}
                    </h2>
                    <p className="text-[10px] text-text-muted">{selectedNoteForDrawer.metadata?.category || 'Category'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/read/${selectedNoteForDrawer.categoryFolder || selectedNoteForDrawer.CategorySlug}/${selectedNoteForDrawer.slug}`}
                    className="p-1.5 rounded-lg text-accent-app bg-accent-app/10 hover:bg-accent-app/20 text-[10px] font-bold border border-accent-app/20 transition-all flex items-center gap-1 shrink-0"
                    title="Open full page"
                  >
                    <span>Full page</span>
                  </Link>
                  <button
                    onClick={() => setSelectedNoteForDrawer(null)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-grow overflow-y-auto p-5 space-y-4 text-text-primary">
                {/* Note Content */}
                <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed break-words whitespace-pre-wrap font-sans bg-black/20 p-4.5 rounded-xl border border-border-app/20">
                  {selectedNoteForDrawer.content}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
