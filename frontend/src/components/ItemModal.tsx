'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, FileText, Sparkles, Shield, Eye, EyeOff, ShieldCheck, Check } from 'lucide-react';
import { UnencryptedVaultItem, VaultItemType } from '../lib/crypto/types';
import { generatePassword, calculatePasswordStrength } from '../lib/crypto/generator';
import { calculateTotp, parseOtpAuthUri, isValidBase32Secret } from '../lib/crypto/totp';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: UnencryptedVaultItem) => Promise<void>;
  initialData?: UnencryptedVaultItem | null;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [type, setType] = useState<VaultItemType>('login');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live TOTP preview
  const [totpPreview, setTotpPreview] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'login');
      setTitle(initialData.title || '');
      setUsername(initialData.username || '');
      setPassword(initialData.password || '');
      setUrl(initialData.url || '');
      setCategory(initialData.category || '');
      setNotes(initialData.notes || '');
      setTotpSecret(initialData.totpSecret || '');
      setFavorite(initialData.favorite || false);
    } else {
      setType('login');
      setTitle('');
      setUsername('');
      setPassword('');
      setUrl('');
      setCategory('');
      setNotes('');
      setTotpSecret('');
      setFavorite(false);
    }
  }, [initialData, isOpen]);

  // Update live TOTP preview when secret changes
  useEffect(() => {
    if (totpSecret) {
      let active = true;
      const testSecret = async () => {
        try {
          let clean = totpSecret.trim();
          if (clean.startsWith('otpauth://')) {
            const parsed = parseOtpAuthUri(clean);
            if (parsed) {
              clean = parsed.secret;
              if (!title && parsed.label) setTitle(parsed.label);
              if (!username && parsed.issuer) setUsername(parsed.issuer);
            }
          }
          if (isValidBase32Secret(clean)) {
            const res = await calculateTotp(clean);
            if (active) setTotpPreview(res.code);
          } else {
            if (active) setTotpPreview(null);
          }
        } catch {
          if (active) setTotpPreview(null);
        }
      };
      testSecret();
      return () => {
        active = false;
      };
    } else {
      setTotpPreview(null);
    }
  }, [totpSecret, title, username]);

  if (!isOpen) return null;

  const handleTotpSecretChange = (val: string) => {
    let clean = val.trim();
    if (clean.startsWith('otpauth://')) {
      const parsed = parseOtpAuthUri(clean);
      if (parsed) {
        setTotpSecret(parsed.secret);
        if (!title && parsed.label) setTitle(parsed.label);
        if (!username && parsed.issuer) setUsername(parsed.issuer);
        return;
      }
    }
    setTotpSecret(clean);
  };

  const handleGeneratePassword = () => {
    const pwd = generatePassword({
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    });
    setPassword(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const itemToSave: UnencryptedVaultItem = {
        id: initialData?.id,
        type,
        title: title.trim(),
        username: type === 'login' ? username.trim() : undefined,
        password: type === 'login' ? password : undefined,
        url: type === 'login' && url.trim() ? url.trim() : undefined,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
        totpSecret: type === 'login' && totpSecret.trim() ? totpSecret.trim() : undefined,
        favorite,
      };

      await onSave(itemToSave);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save encrypted item');
    } finally {
      setIsSaving(false);
    }
  };

  const strength = calculatePasswordStrength(password);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-[#0c140e] border border-[#f5c518]/30 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#f5c518]/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 relative z-10">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-full bg-[#152319] border border-[#f5c518]/40 flex items-center justify-center text-[#f5c518]">
              {type === 'login' ? <Key className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {initialData ? 'Edit Credential' : 'Add New Item'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white bg-[#152319] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Item Type Switcher */}
        <div className="mt-5 flex rounded-full bg-[#152319] p-1 border border-[#f5c518]/20">
          <button
            type="button"
            onClick={() => setType('login')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
              type === 'login'
                ? 'bg-[#f5c518] text-[#0c140e] shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Login Credential
          </button>
          <button
            type="button"
            onClick={() => setType('secure_note')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
              type === 'secure_note'
                ? 'bg-[#f5c518] text-[#0c140e] shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Secure Note
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Title / Service Name</label>
            <input
              type="text"
              required
              placeholder="e.g. GitHub, Google, Work VPN"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-full gold-input"
            />
          </div>

          {type === 'login' && (
            <>
              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Username / Email</label>
                <input
                  type="text"
                  placeholder="e.g. user@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-full gold-input"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-bold text-[#f5c518] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" /> Generate Secure
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 text-sm rounded-full gold-input font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#f5c518]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {password && (
                  <div className="mt-2 flex items-center space-x-2 px-1">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
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
                    <span className="text-[10px] font-semibold text-slate-400">
                      {strength.label} ({strength.entropy} bits)
                    </span>
                  </div>
                )}
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="https://github.com/login"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-full gold-input"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Category / Folder</label>
                <input
                  type="text"
                  placeholder="e.g. Personal, Work, Finance"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-full gold-input"
                />
              </div>

              {/* TOTP Secret */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-[#f5c518]" /> TOTP Authenticator Key (Optional)
                  </label>
                  {totpPreview && (
                    <span className="text-[11px] font-mono text-[#f5c518] flex items-center gap-1 font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" /> Preview: {totpPreview}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Base32 Key or otpauth://totp/..."
                  value={totpSecret}
                  onChange={(e) => handleTotpSecretChange(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-full gold-input font-mono uppercase"
                />
              </div>
            </>
          )}

          {/* Secure Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Secure Notes</label>
            <textarea
              rows={3}
              placeholder="Encrypted notes, recovery codes, or private details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-2xl gold-input resize-none"
            />
          </div>

          {/* Favorite Toggle */}
          <div className="flex items-center space-x-2 pt-1 px-1">
            <input
              type="checkbox"
              id="favorite"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className="h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
            />
            <label htmlFor="favorite" className="text-xs text-slate-300 font-medium cursor-pointer">
              Mark as Favorite
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full text-slate-400 hover:text-white bg-[#152319] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-xs font-black rounded-full gold-btn disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Encrypting & Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
