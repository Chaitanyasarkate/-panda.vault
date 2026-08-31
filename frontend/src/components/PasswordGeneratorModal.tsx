'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Clock,
  Sliders,
  History,
  CheckCircle2
} from 'lucide-react';
import {
  generatePassword,
  calculatePasswordStrength,
  DEFAULT_GENERATOR_OPTIONS
} from '../lib/crypto/generator';
import { PasswordGeneratorOptions } from '../lib/crypto/types';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword?: (password: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectPassword,
}) => {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleGenerate = () => {
    const pwd = generatePassword(options);
    setPassword(pwd);
    setHistory((prev) => [pwd, ...prev.slice(0, 4)]);
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const handleCopy = (textToCopy?: string) => {
    const target = textToCopy || password;
    if (!target) return;
    navigator.clipboard.writeText(target);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleApply = () => {
    if (onSelectPassword) {
      onSelectPassword(password);
    }
    onClose();
  };

  const strength = calculatePasswordStrength(password);

  const setPreset = (length: number, symbols = true) => {
    setOptions({
      length,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols,
      excludeSimilar: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-[#0c140e] border border-[#f5c518]/30 shadow-2xl p-6 sm:p-8 relative overflow-hidden space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center space-x-2 text-[#f5c518]">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-100">Password Generator</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 rounded-full text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                showHistory ? 'bg-[#f5c518] text-[#0c140e] font-bold' : 'text-slate-400 hover:text-white bg-[#152319]'
              }`}
              title="Recent History"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white bg-[#152319] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Generated Password Display Card */}
        <div className="p-4 rounded-2xl bg-[#090f0b] border border-[#f5c518]/30 flex flex-col space-y-3 relative group">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-base font-bold text-slate-100 tracking-wider break-all select-all">
              {password}
            </span>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleGenerate}
                className="p-2 rounded-full text-slate-400 hover:text-[#f5c518] bg-[#152319] transition-all hover:rotate-180 cursor-pointer"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleCopy()}
                className={`p-2 rounded-full text-[#0c140e] transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'gold-btn'
                }`}
                title="Copy to Clipboard"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Strength Bar & Metrics */}
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Strength:</span>
                <span
                  className={
                    strength.score >= 80
                      ? 'text-emerald-400'
                      : strength.score >= 60
                      ? 'text-[#f5c518]'
                      : strength.score >= 40
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }
                >
                  {strength.label}
                </span>
              </div>
              <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                <span>{strength.entropy} bits entropy</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock className="h-3 w-3 text-[#f5c518]" /> {strength.crackTimeDisplay}
                </span>
              </div>
            </div>

            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
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
                style={{ width: `${Math.max(10, strength.score)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#f5c518]/70 text-[11px] font-black uppercase tracking-wider">Presets:</span>
          <button
            onClick={() => setPreset(16, true)}
            className="px-3 py-1 rounded-full bg-[#152319] hover:bg-[#1f3325] text-slate-300 hover:text-[#f5c518] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Strong (16)
          </button>
          <button
            onClick={() => setPreset(24, true)}
            className="px-3 py-1 rounded-full bg-[#152319] hover:bg-[#1f3325] text-slate-300 hover:text-[#f5c518] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Very Strong (24)
          </button>
          <button
            onClick={() => setPreset(32, true)}
            className="px-3 py-1 rounded-full bg-[#152319] hover:bg-[#1f3325] text-slate-300 hover:text-[#f5c518] text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Extreme (32)
          </button>
        </div>

        {/* Generator Controls */}
        <div className="space-y-4 pt-2">
          {/* Length Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-300">
              <span>Password Length</span>
              <span className="font-mono text-sm text-[#f5c518]">{options.length}</span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-[#f5c518]"
            />
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/20 text-xs font-semibold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.uppercase}
                onChange={(e) => setOptions({ ...options, uppercase: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
              />
              <span>Uppercase (A-Z)</span>
            </label>

            <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/20 text-xs font-semibold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.lowercase}
                onChange={(e) => setOptions({ ...options, lowercase: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
              />
              <span>Lowercase (a-z)</span>
            </label>

            <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/20 text-xs font-semibold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.numbers}
                onChange={(e) => setOptions({ ...options, numbers: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
              />
              <span>Numbers (0-9)</span>
            </label>

            <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-[#090f0b] border border-[#f5c518]/20 text-xs font-semibold text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.symbols}
                onChange={(e) => setOptions({ ...options, symbols: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-[#f5c518]/40 text-[#f5c518] focus:ring-[#f5c518]"
              />
              <span>Symbols (!@#$)</span>
            </label>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-full text-slate-400 hover:text-white bg-[#152319] cursor-pointer"
          >
            Close
          </button>
          {onSelectPassword ? (
            <button
              onClick={handleApply}
              className="px-5 py-2 text-xs font-black rounded-full gold-btn cursor-pointer"
            >
              Use Password
            </button>
          ) : (
            <button
              onClick={() => handleCopy()}
              className="px-5 py-2 text-xs font-black rounded-full gold-btn flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
