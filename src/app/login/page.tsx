'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, ShieldAlert, Loader, User, HelpCircle, ArrowRight } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/Toast';

function LoginContent() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const toast = useToast();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        toast.success('Admin authentication successful! Welcome.');
        router.refresh();
        router.push('/');
      } else {
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Authentication failed. Check database connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'guest'
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        toast.success('Authenticated as Guest. Entering workspace in read-only mode.');
        router.refresh();
        router.push('/');
      } else {
        setError('Unable to initialize guest session.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Connection failure during guest setup.');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center p-4 md:p-8 select-none relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-accent-app/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      {/* Main Lockscreen Panel */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full max-w-md rounded-2xl glass-panel border border-border-app p-6 md:p-8 shadow-2xl relative z-10 bg-surface-app/40"
      >
        {/* Workspace Brand Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-8">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="w-14 h-14 rounded-2xl bg-accent-app/10 border border-accent-app/20 flex items-center justify-center mb-4 shadow-inner"
          >
            <Lock className="w-6 h-6 text-accent-app" />
          </motion.div>
          
          <h2 className="text-2xl font-black text-text-primary tracking-tight">
            Developer Notebook
          </h2>
          <p className="mt-1.5 text-xs text-text-muted max-w-[280px]">
            Access premium revision templates, interview sheets, and countdown timelines.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-2.5 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400 font-semibold mb-6"
          >
            <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Guest Path Header and Button */}
        <div className="mb-8">
          <button
            onClick={handleGuestLogin}
            disabled={loading || guestLoading}
            className="w-full group bg-accent-app hover:bg-accent-app/90 text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent-app/25 transition-all"
          >
            {guestLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <User className="w-4.5 h-4.5" />
                <span>Enter as Guest (Read-Only)</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
          
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-border-app/30"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-text-muted/50 uppercase tracking-widest">Or Auth Admin</span>
            <div className="flex-grow border-t border-border-app/30"></div>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
              Admin Username
            </label>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || guestLoading}
              className="w-full bg-black/40 border border-border-app/60 focus:border-accent-app rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || guestLoading}
              className="w-full bg-black/40 border border-border-app/60 focus:border-accent-app rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || guestLoading}
            className="w-full bg-white/5 border border-border-app hover:border-accent-app/40 hover:bg-white/10 disabled:opacity-50 text-text-primary font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all mt-6 shadow-sm"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin text-accent-app" />
                <span>Unlocking Workspace...</span>
              </>
            ) : (
              <span>Unlock Admin Mode</span>
            )}
          </button>
        </form>

        <div className="text-[10px] text-text-muted/40 text-center mt-8 flex items-center justify-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Guest mode grants full viewing access. Admin features require credentials.</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginContent />
    </ToastProvider>
  );
}
