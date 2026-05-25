'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  ShieldAlert, 
  Loader, 
  User, 
  HelpCircle, 
  ArrowRight, 
  Mail, 
  KeyRound, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { ToastProvider, useToast } from '@/components/Toast';

function LoginContent() {
  const router = useRouter();
  const toast = useToast();

  // Active form view: 'login' or 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Shared status
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login Form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // OTP Verification states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  // Trigger Sign In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    resetMessages();

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: loginUsername.trim(),
          password: loginPassword.trim()
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        toast.success(`Welcome back, ${data.user.username}!`);
        router.refresh();
        router.push('/');
      } else {
        setError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError('Connection failed. Database server might be unreachable.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger sending OTP code
  const handleRequestOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('All fields (Name, Email, Password) are required before requesting OTP.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setOtpLoading(true);
    resetMessages();

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-otp',
          email: regEmail.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        toast.success('Verification code sent! Please inspect your email inbox.');
        setSuccessMessage('A 6-digit verification code has been dispatched to your email address (OTP fallback is logged inside otp_notifications.log).');
      } else {
        setError(data.error || 'Failed to dispatch verification code.');
      }
    } catch (err) {
      setError('Failed to reach authentication servers.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Trigger full registration (OTP Free)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('All fields (Name, Email, Password) are required.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    resetMessages();

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-and-register',
          username: regName.trim(),
          email: regEmail.trim(),
          password: regPassword.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Account registered! Pending Administrator approval.');
        setSuccessMessage('Registration Succeeded! Your account is now pending approval by the administrator (hemanthhemu2707@gmail.com). You will receive access once approved.');
        
        // Reset registration fields
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        
        // Switch back to login page
        setTimeout(() => {
          setActiveTab('login');
          resetMessages();
        }, 5500);
      } else {
        setError(data.error || 'Failed to register account.');
      }
    } catch (err) {
      setError('Server communication failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center p-4 md:p-8 select-none relative overflow-hidden font-sans">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-accent-app/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      {/* Main Container Panel */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full max-w-md rounded-2xl glass-panel border border-border-app p-6 md:p-8 shadow-2xl relative z-10 bg-surface-app/40 flex flex-col"
      >
        {/* Workspace Brand Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="w-14 h-14 rounded-2xl bg-accent-app/10 border border-accent-app/20 flex items-center justify-center mb-4 shadow-inner"
          >
            <Lock className="w-6 h-6 text-accent-app" />
          </motion.div>
          
          <h2 className="text-2xl font-black text-text-primary tracking-tight">
            Developer Notebook Hub
          </h2>
          <p className="mt-1.5 text-xs text-text-muted max-w-[300px] leading-relaxed">
            Private, secure Revision Templates, Interview Q&As, and Study Checklists.
          </p>
        </div>

        {/* Custom Tab Switchers */}
        <div className="flex bg-black/25 p-1 rounded-xl border border-border-app/40 mb-6 shrink-0 select-none text-xs font-bold">
          <button
            onClick={() => { setActiveTab('login'); resetMessages(); }}
            className={`flex-1 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'login' 
                ? 'bg-accent-app/10 text-accent-app shadow-md' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setActiveTab('register'); resetMessages(); }}
            className={`flex-1 py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'register' 
                ? 'bg-accent-app/10 text-accent-app shadow-md' 
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Register Reader
          </button>
        </div>

        {/* Global Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-2.5 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400 font-semibold mb-5 shadow-sm"
          >
            <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-red-450" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Global Success Alert */}
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-400 font-semibold mb-5 shadow-sm"
          >
            <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-450" />
            <span className="leading-relaxed">{successMessage}</span>
          </motion.div>
        )}

        {/* Dynamic Forms Container */}
        <AnimatePresence mode="wait">
          {activeTab === 'login' ? (
            /* ================= SIGN IN VIEW ================= */
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
                  Username or Email Address
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-text-muted/40" />
                  <input
                    type="text"
                    placeholder="name@email.com or username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/20 border border-border-app/60 focus:border-accent-app rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-text-muted/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/20 border border-border-app/60 focus:border-accent-app rounded-xl pl-10 pr-10 py-2.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-text-muted/40 hover:text-text-primary cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent-app hover:bg-accent-app/95 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all mt-6 shadow-lg shadow-accent-app/10"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Unlocking Notes Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Notes Workspace</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            /* ================= REGISTER VIEW ================= */
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleRegisterSubmit}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
                  Display Username / Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-text-muted/40" />
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/20 border border-border-app/60 focus:border-accent-app rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-text-muted/40" />
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/20 border border-border-app/60 focus:border-accent-app rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-0.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-text-muted/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-black/20 border border-border-app/60 focus:border-accent-app rounded-xl pl-10 pr-10 py-2.5 text-xs text-text-primary placeholder-text-muted/30 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-text-muted/40 hover:text-text-primary cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !regName.trim() || !regEmail.trim() || !regPassword.trim()}
                className="w-full bg-accent-app hover:bg-accent-app/95 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all mt-6 shadow-lg shadow-accent-app/10"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Registering Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register Reader Account</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="text-[10px] text-text-muted/30 text-center mt-8 flex items-center justify-center gap-1.5 border-t border-border-app/30 pt-4 select-none">
          <HelpCircle className="w-3.5 h-3.5 text-text-muted/20" />
          <span>All reader signups require Administrator approval before unlocking access.</span>
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
