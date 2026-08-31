'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  FileText,
  Copy,
  Check,
  Eye,
  EyeOff,
  Star,
  ExternalLink,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { UnencryptedVaultItem } from '../lib/crypto/types';
import { calculateTotp, TotpResult } from '../lib/crypto/totp';

interface VaultItemCardProps {
  item: UnencryptedVaultItem;
  onEdit: (item: UnencryptedVaultItem) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (item: UnencryptedVaultItem) => void;
}

export const VaultItemCard: React.FC<VaultItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedTotp, setCopiedTotp] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNote, setShowNote] = useState(false);
  
  // Dynamic TOTP live state
  const [totp, setTotp] = useState<TotpResult | null>(null);

  useEffect(() => {
    if (item.totpSecret) {
      let isMounted = true;
      const updateTotp = async () => {
        try {
          const res = await calculateTotp(item.totpSecret!);
          if (isMounted) {
            setTotp(res);
          }
        } catch {
          // Ignore invalid secret errors in preview
        }
      };

      updateTotp();
      const interval = setInterval(updateTotp, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [item.totpSecret]);

  const copyToClipboard = (text: string, type: 'password' | 'username' | 'totp' | 'note') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'password') {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 3000);
    } else if (type === 'username') {
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 3000);
    } else if (type === 'totp') {
      setCopiedTotp(true);
      setTimeout(() => setCopiedTotp(false), 3000);
    } else if (type === 'note') {
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 3000);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0e1711]/90 border border-[#f5c518]/20 p-4 sm:p-5 flex flex-col justify-between hover:border-[#f5c518]/60 transition-all duration-300 relative group shadow-lg hover:shadow-[#f5c518]/10 hover:-translate-y-0.5">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-[#152319] border border-[#f5c518]/40 flex items-center justify-center text-[#f5c518] shrink-0">
              {item.type === 'login' ? (
                <Key className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5 text-[#f5c518]" />
              )}
            </div>
            <div className="overflow-hidden">
              <h3 className="text-sm font-bold text-slate-100 truncate flex items-center gap-1.5">
                {item.title}
                {item.url && (
                  <a
                    href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-[#f5c518] transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </h3>
              <p className="text-xs text-slate-400 truncate font-mono">
                {item.username || item.category || (item.type === 'login' ? 'No Username' : 'Secure Note')}
              </p>
            </div>
          </div>

          <button
            onClick={() => onToggleFavorite(item)}
            className="text-slate-600 hover:text-[#f5c518] transition-colors p-1"
            title="Toggle Favorite"
          >
            <Star
              className={`h-4 w-4 ${
                item.favorite ? 'fill-[#f5c518] text-[#f5c518]' : ''
              }`}
            />
          </button>
        </div>

        {/* Sensitive Password Payload Preview */}
        {item.type === 'login' && item.password && (
          <div className="mt-3 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/25 flex items-center justify-between">
            <div className="font-mono text-xs text-slate-300 truncate tracking-wider">
              {showPassword ? item.password : '••••••••••••••••'}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => copyToClipboard(item.password!, 'password')}
                className="p-1 text-slate-400 hover:text-[#f5c518] transition-colors"
                title="Copy password"
              >
                {copiedPassword ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic TOTP Live Authenticator Box */}
        {totp && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#142218] border border-[#f5c518]/35 flex flex-col space-y-1.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-[#f5c518]" />
                <span className="font-mono text-sm font-black text-[#f5c518] tracking-widest select-all">
                  {totp.code}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-[#f5c518]/80 font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {totp.timeRemaining}s
                </span>

                <button
                  onClick={() => copyToClipboard(totp.code, 'totp')}
                  className="p-1 rounded-lg hover:bg-[#f5c518]/20 text-[#f5c518] transition-colors"
                  title="Copy TOTP code"
                >
                  {copiedTotp ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Countdown progress bar */}
            <div className="w-full h-1 bg-[#090f0b] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  totp.timeRemaining <= 5 ? 'bg-amber-500' : 'bg-[#f5c518]'
                }`}
                style={{ width: `${totp.progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Secure Note Content Box with Conceal/Reveal Toggle */}
        {item.type === 'secure_note' && item.notes && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/25 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-semibold text-[#f5c518] flex items-center gap-1">
                <FileText className="h-3 w-3" /> Encrypted Note
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowNote(!showNote)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showNote ? 'Hide note' : 'Show note'}
                >
                  {showNote ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(item.notes!, 'note')}
                  className="p-1 text-slate-400 hover:text-[#f5c518] transition-colors"
                  title="Copy note"
                >
                  {copiedNote ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {showNote ? (
              <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words select-all">
                {item.notes}
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-mono tracking-widest select-none">
                ••••••••••••••••••••••••
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        {item.username ? (
          <button
            onClick={() => copyToClipboard(item.username!, 'username')}
            className="text-slate-400 hover:text-[#f5c518] flex items-center space-x-1 font-medium"
          >
            {copiedUsername ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> Copied User
              </span>
            ) : (
              <span>Copy Username</span>
            )}
          </button>
        ) : (
          <span className="text-slate-500 text-[11px] font-mono">AES-256-GCM</span>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(item)}
            className="px-3 py-1 rounded-full bg-[#152319] hover:bg-[#1f3325] text-slate-300 hover:text-[#f5c518] text-[11px] font-bold transition-colors cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={() => item.id && onDelete(item.id)}
            className="px-3 py-1 rounded-full bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-bold transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
