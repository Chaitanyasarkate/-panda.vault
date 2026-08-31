'use client';

import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { Navbar } from '../components/Navbar';
import { Sidebar, CategoryFilter } from '../components/Sidebar';
import { AuthCard } from '../components/AuthCard';
import { VaultItemCard } from '../components/VaultItemCard';
import { ItemModal } from '../components/ItemModal';
import { PasswordGeneratorModal } from '../components/PasswordGeneratorModal';
import { SecurityDashboard } from '../components/SecurityDashboard';
import { UnencryptedVaultItem } from '../lib/crypto/types';
import { analyzeVaultSecurity } from '../lib/crypto/securityAudit';
import {
  Plus,
  Lock,
  Sparkles,
  FileText,
  Loader2
} from 'lucide-react';

export default function Home() {
  const {
    isUnlocked,
    isSessionChecking,
    items,
    isLoading,
    checkSession,
    addItem,
    updateItem,
    deleteItem,
  } = useVaultStore();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UnencryptedVaultItem | null>(null);

  // Auto-restore session and decrypt items on page mount/refresh
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: UnencryptedVaultItem) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this encrypted vault item?')) {
      await deleteItem(id);
    }
  };

  const handleToggleFavorite = async (item: UnencryptedVaultItem) => {
    if (item.id) {
      await updateItem(item.id, { ...item, favorite: !item.favorite }, 1);
    }
  };

  const handleSaveItem = async (itemData: UnencryptedVaultItem) => {
    if (itemData.id) {
      await updateItem(itemData.id, itemData, 1);
    } else {
      await addItem(itemData);
    }
  };

  // Compute local security stats
  const auditReport = analyzeVaultSecurity(items);
  const loginCount = items.filter((i) => i.type === 'login').length;
  const noteCount = items.filter((i) => i.type === 'secure_note').length;
  const favCount = items.filter((i) => i.favorite).length;
  const weakCount = auditReport.weakItems.length;

  // Filter items for list views - Secure Notes ONLY show when activeCategory === 'notes'
  const filteredItems = items.filter((item) => {
    if (activeCategory === 'all' && item.type === 'secure_note') return false;
    if (activeCategory === 'logins' && item.type !== 'login') return false;
    if (activeCategory === 'notes' && item.type !== 'secure_note') return false;
    if (activeCategory === 'favorites' && (!item.favorite || item.type === 'secure_note')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchUser = item.username?.toLowerCase().includes(q) || false;
      const matchUrl = item.url?.toLowerCase().includes(q) || false;
      const matchCategory = item.category?.toLowerCase().includes(q) || false;
      return matchTitle || matchUser || matchUrl || matchCategory;
    }

    return true;
  });

  if (isSessionChecking) {
    return (
      <div className="min-h-screen bg-topo-pattern flex flex-col items-center justify-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-[#f5c518]/20 border border-[#f5c518]/40 flex items-center justify-center text-[#f5c518] shadow-[0_0_30px_rgba(245,197,24,0.25)]">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Loading Secure Vault...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-topo-pattern text-slate-100 flex flex-col font-sans selection:bg-[#f5c518] selection:text-[#0b120d] relative overflow-hidden">
      {/* Background Topographic Wave SVG Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <path
          d="M-100,200 C300,50 600,350 1000,150 C1300,0 1500,200 1600,100"
          fill="none"
          stroke="#f5c518"
          strokeWidth="1.5"
        />
        <path
          d="M-100,350 C250,200 650,500 1100,300 C1400,150 1550,350 1650,250"
          fill="none"
          stroke="#f5c518"
          strokeWidth="1.2"
        />
        <path
          d="M-100,500 C200,350 700,650 1200,450 C1500,300 1600,500 1700,400"
          fill="none"
          stroke="#3d5c43"
          strokeWidth="1.5"
        />
        <path
          d="M-100,650 C150,500 750,800 1300,600 C1600,450 1650,650 1750,550"
          fill="none"
          stroke="#f5c518"
          strokeWidth="1"
        />
        <path
          d="M-100,800 C100,650 800,950 1400,750 C1700,600 1700,800 1800,700"
          fill="none"
          stroke="#3d5c43"
          strokeWidth="1.5"
        />
      </svg>

      {/* Top Navbar */}
      <Navbar
        onOpenGenerator={() => setIsGeneratorModalOpen(true)}
        onOpenNewItemModal={handleOpenNewItem}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Container */}
      {!isUnlocked ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative z-10">
          <AuthCard />
        </main>
      ) : (
        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* Left Sidebar */}
          <Sidebar
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            counts={{
              all: loginCount,
              logins: loginCount,
              notes: noteCount,
              favorites: items.filter((i) => i.favorite && i.type !== 'secure_note').length,
              weakCount,
            }}
          />

          {/* Center Main Content Area */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
            {/* View Switcher: Security Dashboard vs Vault List */}
            {activeCategory === 'security' ? (
              <SecurityDashboard
                items={items}
                onEditItem={handleEditItem}
                onOpenGenerator={() => setIsGeneratorModalOpen(true)}
              />
            ) : (
              <>
                {/* Vault Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#f5c518]/15">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-[#f5c518] tracking-wide flex items-center gap-2">
                      {activeCategory === 'all' && 'ALL VAULT CREDENTIALS'}
                      {activeCategory === 'logins' && 'LOGINS & PASSWORDS'}
                      {activeCategory === 'notes' && 'SECURE ENCRYPTED NOTES'}
                      {activeCategory === 'favorites' && 'FAVORITE CREDENTIALS'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} decrypted locally in memory
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsGeneratorModalOpen(true)}
                      className="px-4 py-2.5 text-xs font-bold rounded-full glass-card text-slate-200 hover:text-[#f5c518] border border-[#f5c518]/25 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#f5c518]" /> Generator
                    </button>
                    <button
                      onClick={handleOpenNewItem}
                      className="px-5 py-2.5 text-xs font-black rounded-full gold-btn flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> New Item
                    </button>
                  </div>
                </div>

                {/* Items Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((idx) => (
                      <div key={idx} className="h-44 rounded-2xl glass-card animate-pulse" />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="glass-panel p-12 rounded-3xl border border-[#f5c518]/20 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
                    <div className="h-16 w-16 rounded-full bg-[#121c14] border border-[#f5c518]/40 flex items-center justify-center text-[#f5c518]">
                      {activeCategory === 'notes' ? (
                        <FileText className="h-8 w-8 text-[#f5c518]" />
                      ) : (
                        <Lock className="h-8 w-8" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">
                        {activeCategory === 'notes' ? 'No Secure Notes' : 'No Credentials Found'}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        {searchQuery
                          ? `No items matched "${searchQuery}".`
                          : activeCategory === 'notes'
                          ? 'Encrypted notes, recovery keys, or secret text will appear here.'
                          : 'Your encrypted vault is ready. Create your first credential.'}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenNewItem}
                      className="px-5 py-2.5 text-xs font-black rounded-full gold-btn flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add {activeCategory === 'notes' ? 'Secure Note' : 'First Item'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                      <VaultItemCard
                        key={item.id || item.title}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Item Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        initialData={editingItem}
      />

      {/* Password Generator Modal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
      />
    </div>
  );
}
