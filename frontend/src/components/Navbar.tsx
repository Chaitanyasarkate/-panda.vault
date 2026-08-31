'use client';

import React from 'react';
import { Lock, LogOut, Plus, Search, Sparkles } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { Logo } from './Logo';

interface NavbarProps {
  onOpenGenerator: () => void;
  onOpenNewItemModal: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenGenerator,
  onOpenNewItemModal,
  searchQuery,
  setSearchQuery,
}) => {
  const { isUnlocked, userEmail, lockVault, logout } = useVaultStore();

  return (
    <header className="sticky top-0 z-30 bg-[#0c140e]/95 backdrop-blur-xl border-b border-[#f5c518]/20 px-6 py-3 flex items-center justify-between shadow-md">
      {/* Brand Logo & Name */}
      <div className="flex items-center space-x-3">
        <Logo className="h-9 w-9" />
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black tracking-tight text-white font-sans">
            panda<span className="text-[#f5c518]">.</span>vault
          </span>
        </div>
      </div>

      {/* Search Input (When unlocked) */}
      {isUnlocked && (
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search credentials, usernames, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2 text-xs rounded-full gold-input placeholder-slate-500"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        {isUnlocked && (
          <>
            <button
              onClick={onOpenNewItemModal}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-black rounded-full gold-btn transition-all cursor-pointer hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              <span>New Item</span>
            </button>

            <button
              onClick={onOpenGenerator}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-full bg-[#152319] text-slate-300 hover:text-[#f5c518] border border-[#f5c518]/25 transition-colors cursor-pointer"
              title="Password Generator"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#f5c518]" />
              <span className="hidden sm:inline">Generator</span>
            </button>

            <div className="h-5 w-px bg-[#f5c518]/20 mx-1" />

            <button
              onClick={lockVault}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Lock Vault"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </>
        )}

        {userEmail && (
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 p-2 text-xs font-medium rounded-full bg-[#152319] text-slate-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
            title="Logout Session"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
};
