'use client';

import React from 'react';
import { Key, ShieldAlert, FileText, Star, Lock, LayoutGrid, Clock } from 'lucide-react';

export type CategoryFilter = 'all' | 'logins' | 'notes' | 'favorites' | 'security';

interface SidebarProps {
  activeCategory: CategoryFilter;
  setActiveCategory: (cat: CategoryFilter) => void;
  counts: {
    all: number;
    logins: number;
    notes: number;
    favorites: number;
    weakCount: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  setActiveCategory,
  counts,
}) => {
  const navItems = [
    { id: 'all', label: 'All Vault Items', icon: LayoutGrid, count: counts.all },
    { id: 'logins', label: 'Logins & Passwords', icon: Key, count: counts.logins },
    { id: 'notes', label: 'Secure Notes', icon: FileText, count: counts.notes },
    { id: 'favorites', label: 'Favorites', icon: Star, count: counts.favorites },
    {
      id: 'security',
      label: 'Security Dashboard',
      icon: ShieldAlert,
      count: counts.weakCount > 0 ? counts.weakCount : undefined,
      alert: counts.weakCount > 0,
    },
  ];

  return (
    <aside className="w-64 bg-[#0c140e]/95 backdrop-blur-xl border-r border-[#f5c518]/15 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-65px)]">
      <div className="space-y-6">
        <div>
          <h2 className="px-3 text-[11px] font-black text-[#f5c518]/70 uppercase tracking-widest mb-3">
            Vault Categories
          </h2>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id as CategoryFilter)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#f5c518] text-[#0c140e] font-black shadow-md shadow-[#f5c518]/20'
                      : 'text-slate-300 hover:text-white hover:bg-[#152319]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive
                          ? 'text-[#0c140e]'
                          : item.alert
                          ? 'text-amber-400'
                          : 'text-[#f5c518]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${
                        item.alert
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                          : isActive
                          ? 'bg-[#0c140e] text-[#f5c518] font-black'
                          : 'bg-[#152319] text-slate-300 border border-white/5'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Security Indicator Box */}
        <div className="p-3.5 rounded-2xl bg-[#0e1711] border border-[#f5c518]/25 space-y-2">
          <div className="flex items-center space-x-2 text-[#f5c518]">
            <Lock className="h-4 w-4" />
            <span className="text-xs font-bold">End-to-End Encrypted</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Client-side Argon2id key derivation & AES-256-GCM encryption. Unencrypted data never leaves your browser.
          </p>
        </div>
      </div>

      <div className="text-[11px] text-[#f5c518]/60 text-center py-2 font-mono font-bold">
        panda.vault v1.0.0
      </div>
    </aside>
  );
};
