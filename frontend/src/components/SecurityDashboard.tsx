'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Key,
  Lock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { UnencryptedVaultItem } from '../lib/crypto/types';
import { analyzeVaultSecurity, SecurityAuditReport } from '../lib/crypto/securityAudit';

interface SecurityDashboardProps {
  items: UnencryptedVaultItem[];
  onEditItem: (item: UnencryptedVaultItem) => void;
  onOpenGenerator: () => void;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  items,
  onEditItem,
  onOpenGenerator,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'weak' | 'reused' | 'old' | 'totp'>('overview');

  const report: SecurityAuditReport = analyzeVaultSecurity(items);

  // SVG Gauge calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (report.overallScore / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 stroke-emerald-500';
    if (score >= 70) return 'text-indigo-400 stroke-indigo-500';
    if (score >= 50) return 'text-amber-400 stroke-amber-500';
    return 'text-red-400 stroke-red-500';
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
      case 'B':
        return 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300';
      case 'C':
        return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
      default:
        return 'bg-red-500/20 border-red-500/40 text-red-300';
    }
  };

  const findItemById = (id?: string): UnencryptedVaultItem | undefined => {
    if (!id) return undefined;
    return items.find((i) => i.id === id);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Zero-Knowledge Privacy Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 text-xs text-indigo-200">
          <Info className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>
            <strong>100% Client-Side Zero-Knowledge Analysis:</strong> Your passwords and audit metrics are calculated entirely in browser memory. No plaintext credentials ever leave your device.
          </span>
        </div>
        <button
          onClick={onOpenGenerator}
          className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" /> Open Generator
        </button>
      </div>

      {/* Hero Security Score Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Radial Score Gauge Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="relative flex items-center justify-center mb-3">
            <svg className="w-36 h-36 transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-slate-800/80"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r={radius}
                className={`transition-all duration-1000 ease-out ${getScoreColor(report.overallScore)}`}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-100 tracking-tight">
                {report.overallScore}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                out of 100
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeBadge(report.healthGrade)}`}>
              Grade {report.healthGrade}
            </span>
            <span className="text-xs font-medium text-slate-300">
              {report.overallScore >= 85
                ? 'Excellent Security'
                : report.overallScore >= 70
                ? 'Good Protection'
                : report.overallScore >= 50
                ? 'Needs Improvement'
                : 'High Risk'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Based on {report.totalLogins} monitored login credentials
          </p>
        </div>

        {/* Actionable Recommendations Card */}
        <div className="md:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Security Recommendations
            </h3>
            <div className="space-y-2.5">
              {report.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                  <div className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    {idx + 1}
                  </div>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>{report.strongCount} of {report.totalLogins} credentials meet high-entropy standards</span>
            <button
              onClick={() => setActiveTab('weak')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              Review Issues <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Diagnostic Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weak Passwords */}
        <div
          onClick={() => setActiveTab('weak')}
          className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all ${
            activeTab === 'weak'
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Weak Passwords</span>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400">{report.weakItems.length}</div>
          <span className="text-[10px] text-slate-500">Below 70 entropy threshold</span>
        </div>

        {/* Reused Passwords */}
        <div
          onClick={() => setActiveTab('reused')}
          className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all ${
            activeTab === 'reused'
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Reused Passwords</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {report.reusedGroups.reduce((acc, g) => acc + g.count, 0)}
          </div>
          <span className="text-[10px] text-slate-500">{report.reusedGroups.length} duplicated groups</span>
        </div>

        {/* Old Passwords */}
        <div
          onClick={() => setActiveTab('old')}
          className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all ${
            activeTab === 'old'
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Old Passwords</span>
            <Clock className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">{report.oldItems.length}</div>
          <span className="text-[10px] text-slate-500">Older than 90 days</span>
        </div>

        {/* Missing 2FA */}
        <div
          onClick={() => setActiveTab('totp')}
          className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all ${
            activeTab === 'totp'
              ? 'border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Missing 2FA</span>
            <Key className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">{report.missingTotpItems.length}</div>
          <span className="text-[10px] text-slate-500">No TOTP authenticator</span>
        </div>
      </div>

      {/* Diagnostic Category Detailed Lists */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        {/* Tab Headers */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 text-xs">
          <button
            onClick={() => setActiveTab('weak')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'weak' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            Weak Passwords ({report.weakItems.length})
          </button>
          <button
            onClick={() => setActiveTab('reused')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'reused' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reused ({report.reusedGroups.length} groups)
          </button>
          <button
            onClick={() => setActiveTab('old')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'old' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            Old ({report.oldItems.length})
          </button>
          <button
            onClick={() => setActiveTab('totp')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
              activeTab === 'totp' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            Missing 2FA ({report.missingTotpItems.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-3">
          {/* Weak Passwords Tab */}
          {activeTab === 'weak' && (
            report.weakItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No weak passwords detected! All credentials meet strong entropy standards.
              </div>
            ) : (
              report.weakItems.map((item, idx) => {
                const vaultItem = findItemById(item.id);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl glass-card border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">{item.username || 'No username'}</p>
                      <span className="text-[10px] text-red-400 font-medium mt-0.5 block">
                        Issue: {item.reason}
                      </span>
                    </div>
                    {vaultItem && (
                      <button
                        onClick={() => onEditItem(vaultItem)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold transition-colors"
                      >
                        Upgrade Password
                      </button>
                    )}
                  </div>
                );
              })
            )
          )}

          {/* Reused Passwords Tab */}
          {activeTab === 'reused' && (
            report.reusedGroups.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No reused passwords found! Every account has a unique password.
              </div>
            ) : (
              report.reusedGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl glass-card border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Password Reused across {group.count} accounts
                    </span>
                    <span className="font-mono text-slate-500">{group.passwordSample}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map((it, itIdx) => {
                      const vaultItem = findItemById(it.id);
                      return (
                        <div
                          key={itIdx}
                          className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold text-slate-200 block truncate">{it.title}</span>
                            <span className="text-[10px] text-slate-400 truncate">{it.username || 'No username'}</span>
                          </div>
                          {vaultItem && (
                            <button
                              onClick={() => onEditItem(vaultItem)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] shrink-0"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )
          )}

          {/* Old Passwords Tab */}
          {activeTab === 'old' && (
            report.oldItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                All credentials are newly updated or within standard rotation cycles.
              </div>
            ) : (
              report.oldItems.map((item, idx) => {
                const vaultItem = findItemById(item.id);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl glass-card border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">{item.username || 'No username'}</p>
                      <span className="text-[10px] text-cyan-400 font-medium mt-0.5 block">
                        {item.reason}
                      </span>
                    </div>
                    {vaultItem && (
                      <button
                        onClick={() => onEditItem(vaultItem)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold transition-colors"
                      >
                        Rotate Password
                      </button>
                    )}
                  </div>
                );
              })
            )
          )}

          {/* Missing 2FA Tab */}
          {activeTab === 'totp' && (
            report.missingTotpItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Outstanding! All login accounts have two-factor authenticator protection.
              </div>
            ) : (
              report.missingTotpItems.map((item, idx) => {
                const vaultItem = findItemById(item.id);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl glass-card border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">{item.username || 'No username'}</p>
                      <span className="text-[10px] text-indigo-400 font-medium mt-0.5 block">
                        Add TOTP 2FA secret
                      </span>
                    </div>
                    {vaultItem && (
                      <button
                        onClick={() => onEditItem(vaultItem)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold transition-colors"
                      >
                        Add 2FA Key
                      </button>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};
