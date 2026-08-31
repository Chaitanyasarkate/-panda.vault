'use client';

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Sparkles,
  UserCircle,
  LogOut,
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { calculatePasswordStrength } from '../lib/crypto/generator';

export const AuthCard: React.FC = () => {
  const {
    isAuthenticated,
    userEmail,
    login,
    register,
    unlockVault,
    logout,
    isLoading,
    error,
    clearError,
  } = useVaultStore();

  const [mode, setMode] = useState<'login' | 'register' | 'unlock'>(
    isAuthenticated && userEmail ? 'unlock' : 'login'
  );
  const [email, setEmail] = useState(userEmail || '');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [zkAcknowledged, setZkAcknowledged] = useState(false);

  const handleToggleMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    clearError();
    if (newMode === 'register') {
      setConfirmPassword('');
      setZkAcknowledged(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    setMode('login');
    setEmail('');
    setMasterPassword('');
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) return;

    if (mode === 'unlock') {
      await unlockVault(masterPassword);
      return;
    }

    if (!email) return;

    if (mode === 'register') {
      if (masterPassword !== confirmPassword) {
        useVaultStore.setState({ error: 'Master passwords do not match' });
        return;
      }
      if (!zkAcknowledged) {
        useVaultStore.setState({ error: 'Please acknowledge the Master Password security policy' });
        return;
      }
      await register(email, masterPassword);
    } else {
      await login(email, masterPassword);
    }
  };

  const strength = calculatePasswordStrength(masterPassword);

  return (
    <div className="w-full max-w-4xl rounded-[28px] bg-[#0c140e]/95 border border-[#f5c518]/20 shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-6 sm:p-10 relative overflow-hidden backdrop-blur-2xl">
      {/* Subtle background ambient gold aura */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-[#f5c518]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#2a4530]/20 blur-[100px] pointer-events-none" />

      {/* Card Top Branding Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/5 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-[#f5c518] shadow-md shrink-0">
            <img src="/panda_avatar.jpg" alt="panda.vault" className="w-full h-full object-cover" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white font-sans">
            panda<span className="text-[#f5c518]">.</span>vault
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8 relative z-10">
        {/* Left Form Area */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#f5c518] tracking-wider uppercase">
              {mode === 'register' ? 'CREATE ACCOUNT' : 'UNLOCK YOUR VAULT'}
            </h2>
            <div className="text-xs text-slate-300 mt-1.5 flex flex-wrap items-center gap-1.5 font-medium">
              <span>
                {mode === 'register'
                  ? 'Enter your email and Master Password to create your encrypted vault.'
                  : 'Enter your Master Password to derive keys & match credentials.'}
              </span>
              {mode === 'login' && (
                <div className="w-full mt-1">
                  <span>Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('register')}
                    className="text-[#f5c518] hover:underline font-bold transition-all cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              )}
              {mode === 'register' && (
                <div className="w-full mt-1">
                  <span>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('login')}
                    className="text-[#f5c518] hover:underline font-bold transition-all cursor-pointer"
                  >
                    Unlock Vault
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            {mode !== 'unlock' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3 rounded-full gold-input text-xs sm:text-sm text-slate-100 placeholder-slate-500"
                />
              </div>
            ) : (
              <div className="p-3.5 rounded-full bg-[#121c14] border border-[#f5c518]/30 flex items-center justify-between px-5">
                <div className="flex items-center space-x-2.5">
                  <UserCircle className="h-5 w-5 text-[#f5c518]" />
                  <span className="text-xs font-bold text-slate-200">{userEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-[11px] text-[#f5c518] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <LogOut className="h-3 w-3" /> Switch
                </button>
              </div>
            )}

            {/* Master Password field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 tracking-wide">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••••••"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full px-5 py-3 pr-12 rounded-full gold-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#f5c518] transition-colors p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength indicator in register mode */}
              {mode === 'register' && masterPassword && (
                <div className="mt-2 px-1 space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                    <span>Master Password Strength</span>
                    <span className={strength.score >= 80 ? 'text-emerald-400' : 'text-[#f5c518]'}>
                      {strength.label} ({strength.entropy} bits)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        strength.score >= 80
                          ? 'bg-emerald-500'
                          : strength.score >= 60
                          ? 'bg-[#f5c518]'
                          : strength.score >= 40
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password in Register mode */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200 tracking-wide">
                  Confirm Master Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-5 py-3 pr-12 rounded-full gold-input text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#f5c518] transition-colors p-1 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Register Disclaimer */}
            {mode === 'register' && (
              <div className="p-3 rounded-2xl bg-[#121c14] border border-[#f5c518]/30 space-y-1.5 text-xs text-slate-300">
                <label className="flex items-start space-x-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={zkAcknowledged}
                    onChange={(e) => setZkAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I understand that my master password is never stored and cannot be reset if forgotten.
                  </span>
                </label>
              </div>
            )}

            {/* Options Row: Remember Me & Forget Password */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-full bg-[#121c14] border-[#f5c518] text-[#f5c518] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-[11px] text-slate-300">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => alert('For security, master passwords are encrypted client-side and cannot be reset without the original key.')}
                className="text-[11px] text-[#f5c518] hover:underline font-semibold cursor-pointer"
              >
                Forget password?
              </button>
            </div>

            {/* Unlock Vault Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-full gold-btn text-sm font-black tracking-wide uppercase transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-4 cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center space-x-2 text-[#0c140e]">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Deriving Keys...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2 text-[#0c140e]">
                  <span>{mode === 'register' ? 'Create Vault' : 'Unlock Vault'}</span>
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Right Hero Graphic (Clean & Centered) */}
        <div className="lg:col-span-5 flex items-center justify-center pt-4 lg:pt-0">
          {/* Circular Yellow Spotlight Badge with Ninja Panda */}
          <div className="relative group">
            <div className="h-60 w-60 sm:h-72 sm:w-72 md:h-80 md:w-80 rounded-full bg-[#f5c518] p-2 shadow-[0_0_60px_rgba(245,197,24,0.4)] flex items-center justify-center overflow-hidden border-4 border-[#ffcf25]/80 transition-transform duration-500 group-hover:scale-105">
              <img
                src="/panda_avatar.jpg"
                alt="Panda Ninja Vault Guardian"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
