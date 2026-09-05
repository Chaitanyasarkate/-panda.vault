import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  Globe,
  Zap,
  RefreshCw,
  Sliders,
  Settings,
  Server,
  AlertCircle
} from 'lucide-react';
import { ExtensionVaultItem } from '../lib/messaging';

export const Popup: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server URL settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://panda-vault-backend.onrender.com');

  // Active tab & matched credentials
  const [activeDomain, setActiveDomain] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [matchedItems, setMatchedItems] = useState<ExtensionVaultItem[]>([]);
  const [allItems, setAllItems] = useState<ExtensionVaultItem[]>([]);
  
  // UI Tabs & state
  const [activeTab, setActiveTab] = useState<'matched' | 'all' | 'generator'>('matched');
  const [searchQuery, setSearchQuery] = useState('');
  const [autofillSuccessId, setAutofillSuccessId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Password Generator state
  const [genLength, setGenLength] = useState(16);
  const [genPassword, setGenPassword] = useState('');
  const [genCopied, setGenCopied] = useState(false);

  // Initial Status Check
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res?.success && res.data) {
        setIsUnlocked(res.data.isUnlocked);
        setUserEmail(res.data.userEmail || '');
        setActiveDomain(res.data.activeDomain || '');
        setActiveUrl(res.data.activeUrl || '');
        if (res.data.apiBaseUrl) {
          setApiUrl(res.data.apiBaseUrl.replace(/\/api\/v1\/?$/, ''));
        }
        if (res.data.keepLoggedIn !== undefined) {
          setKeepLoggedIn(res.data.keepLoggedIn);
        }

        if (res.data.isUnlocked) {
          loadMatchedCredentials();
        }
      }
    });

    // Check saved email & preference in storage
    chrome.storage.local.get(['saved_email', 'keep_logged_in', 'api_server_url'], (result) => {
      if (result.saved_email && !userEmail) {
        setUserEmail(result.saved_email);
      }
      if (result.keep_logged_in !== undefined) {
        setKeepLoggedIn(result.keep_logged_in);
      }
      if (result.api_server_url) {
        setApiUrl(result.api_server_url.replace(/\/api\/v1\/?$/, ''));
      }
    });

    generateRandomPassword(16);
  }, []);

  const loadMatchedCredentials = () => {
    chrome.runtime.sendMessage({ type: 'GET_MATCHED_CREDENTIALS' }, (res) => {
      if (res?.success && res.data) {
        setMatchedItems(res.data.matched || []);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_ALL_CREDENTIALS' }, (res) => {
      if (res?.success && res.data) {
        setAllItems(res.data.items || []);
      }
    });
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
    chrome.storage.local.set({ api_server_url: cleanUrl }, () => {
      chrome.runtime.sendMessage({ type: 'SET_API_URL', payload: { url: cleanUrl } });
      setIsSettingsOpen(false);
      setError(null);
    });
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !masterPassword) return;

    setIsLoading(true);
    setError(null);

    chrome.runtime.sendMessage(
      {
        type: 'UNLOCK_VAULT',
        payload: {
          email: userEmail,
          masterPassword,
          keepLoggedIn,
        },
      },
      (res) => {
        setIsLoading(false);
        if (res?.success) {
          setIsUnlocked(true);
          setMasterPassword('');
          chrome.storage.local.set({
            saved_email: userEmail,
            keep_logged_in: keepLoggedIn,
          });
          loadMatchedCredentials();
        } else {
          setError(res?.error || 'Failed to unlock vault. Check master password.');
        }
      }
    );
  };

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }, () => {
      setIsUnlocked(false);
      setMatchedItems([]);
      setAllItems([]);
    });
  };

  const handleExplicitAutofill = (item: ExtensionVaultItem) => {
    chrome.runtime.sendMessage(
      {
        type: 'EXECUTE_AUTOFILL',
        payload: {
          username: item.username,
          password: item.password,
        },
      },
      (res) => {
        if (res?.success) {
          setAutofillSuccessId(item.id);
          setTimeout(() => setAutofillSuccessId(null), 3000);
        } else {
          setError(res?.error || 'Could not find login fields on this page');
          setTimeout(() => setError(null), 4000);
        }
      }
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getSecureRandomInt = (max: number): number => {
    if (max <= 0) return 0;
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % max);
    const randomBuffer = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(randomBuffer);
      const val = randomBuffer[0];
      if (val < limit) return val % max;
    }
  };

  const generateRandomPassword = (length: number) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const combined = upper + lower + numbers + symbols;

    const chars = [
      upper[getSecureRandomInt(upper.length)],
      lower[getSecureRandomInt(lower.length)],
      numbers[getSecureRandomInt(numbers.length)],
      symbols[getSecureRandomInt(symbols.length)],
    ];

    while (chars.length < length) {
      chars.push(combined[getSecureRandomInt(combined.length)]);
    }

    // Cryptographic Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = getSecureRandomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    setGenPassword(chars.join(''));
  };

  const openWebApp = () => {
    chrome.tabs.create({ url: 'https://panda-vault.onrender.com' });
  };

  const filteredAllItems = allItems.filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.username?.toLowerCase().includes(q) ||
      i.url?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col min-h-[520px] max-h-[580px] bg-[#0b120d] text-slate-100 font-sans">
      {/* Top Header */}
      <header className="px-4 py-3 bg-[#0e1711] border-b border-[#f5c518]/20 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-full overflow-hidden border-2 border-[#f5c518] shadow-sm shrink-0">
            <img src="/icons/icon.png" alt="logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-base font-black tracking-tight text-white">
            panda<span className="text-[#f5c518]">.</span>vault
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isSettingsOpen ? 'text-[#f5c518] bg-[#152319]' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Backend Server Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={openWebApp}
            className="p-1.5 rounded-full text-slate-400 hover:text-[#f5c518] hover:bg-[#152319] transition-colors cursor-pointer"
            title="Open Web Vault"
          >
            <ExternalLink className="h-4 w-4" />
          </button>

          {isUnlocked && (
            <button
              onClick={handleLock}
              className="p-1.5 rounded-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="Lock Vault"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col justify-between overflow-y-auto">
        {/* Settings Panel */}
        {isSettingsOpen ? (
          <div className="my-auto space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-black text-[#f5c518] uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Server className="h-4 w-4" /> Backend Server
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure your API endpoint for syncing and unlocking.
              </p>
            </div>

            <form onSubmit={handleSaveApiUrl} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Server URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://panda-vault-backend.onrender.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-full gold-input font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApiUrl('https://panda-vault-backend.onrender.com')}
                  className="flex-1 py-1.5 text-[10px] font-bold rounded-full bg-[#152319] text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#1a2d20] cursor-pointer"
                >
                  Cloud Render
                </button>
                <button
                  type="button"
                  onClick={() => setApiUrl('http://localhost:8000')}
                  className="flex-1 py-1.5 text-[10px] font-bold rounded-full bg-[#152319] text-slate-300 border border-white/10 hover:bg-[#1a2d20] cursor-pointer"
                >
                  Localhost
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-full gold-btn text-xs font-black uppercase tracking-wider mt-2 transition-all cursor-pointer"
              >
                Save Server URL
              </button>
            </form>
          </div>
        ) : !isUnlocked ? (
          /* Locked State - Unlock Form */
          <div className="my-auto space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-black text-[#f5c518] uppercase tracking-wider">
                Unlock Your Vault
              </h2>
              <p className="text-[11px] text-slate-400">
                Enter your Master Password to derive keys & match credentials.
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-full gold-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Master Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••••••"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-9 text-xs rounded-full gold-input font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#f5c518] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Keep me logged in checkbox */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    className="h-3.5 w-3.5 rounded-full bg-[#121c14] border-[#f5c518] text-[#f5c518] focus:ring-0 cursor-pointer accent-[#f5c518]"
                  />
                  <span className="text-[11px] text-slate-300">Keep me logged in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-full gold-btn text-xs font-black uppercase tracking-wider mt-2 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    <span>Deriving Keys...</span>
                  </span>
                ) : (
                  <span>Unlock Vault</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Unlocked State - Matched Credentials & Autofill */
          <div className="space-y-3">
            {/* Active Domain Bar */}
            <div className="p-2.5 rounded-xl bg-[#0e1711] border border-[#f5c518]/25 flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <Globe className="h-3.5 w-3.5 text-[#f5c518] shrink-0" />
                <span className="text-xs font-bold text-slate-200 truncate">
                  {activeDomain || 'Active Web Page'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/30 shrink-0">
                {matchedItems.length} Matched
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex rounded-full bg-[#121c14] p-1 border border-white/5 text-[11px] font-bold">
              <button
                onClick={() => setActiveTab('matched')}
                className={`flex-1 py-1 rounded-full transition-all cursor-pointer ${
                  activeTab === 'matched'
                    ? 'bg-[#f5c518] text-[#0c140e] font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Matched ({matchedItems.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1 rounded-full transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#f5c518] text-[#0c140e] font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Vault ({allItems.length})
              </button>
              <button
                onClick={() => setActiveTab('generator')}
                className={`flex-1 py-1 rounded-full transition-all cursor-pointer ${
                  activeTab === 'generator'
                    ? 'bg-[#f5c518] text-[#0c140e] font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Generator
              </button>
            </div>

            {/* Tab: Matched Credentials */}
            {activeTab === 'matched' && (
              <div className="space-y-2.5">
                {matchedItems.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-[#152319] border border-[#f5c518]/30 flex items-center justify-center text-[#f5c518]">
                      <Key className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-slate-400">
                      No credentials matched <strong>{activeDomain}</strong>.
                    </p>
                    <button
                      onClick={() => setActiveTab('all')}
                      className="text-[11px] text-[#f5c518] font-bold hover:underline cursor-pointer"
                    >
                      Browse All Vault Items
                    </button>
                  </div>
                ) : (
                  matchedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-[#0e1711] border border-[#f5c518]/25 hover:border-[#f5c518]/60 transition-all space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-black text-slate-100 truncate">{item.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate font-mono">
                            {item.username || 'No Username'}
                          </p>
                        </div>

                        <div className="flex items-center space-x-1">
                          {item.username && (
                            <button
                              onClick={() => copyToClipboard(item.username!, `u-${item.id}`)}
                              className="p-1 text-slate-400 hover:text-[#f5c518] rounded-md transition-colors cursor-pointer"
                              title="Copy Username"
                            >
                              {copiedId === `u-${item.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          {item.password && (
                            <button
                              onClick={() => copyToClipboard(item.password!, `p-${item.id}`)}
                              className="p-1 text-slate-400 hover:text-[#f5c518] rounded-md transition-colors cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedId === `p-${item.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Key className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Explicit User-Controlled Autofill Button */}
                      <button
                        onClick={() => handleExplicitAutofill(item)}
                        className={`w-full py-1.5 px-3 rounded-full text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          autofillSuccessId === item.id
                            ? 'bg-emerald-600 text-white'
                            : 'gold-btn'
                        }`}
                      >
                        {autofillSuccessId === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Autofilled!</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5" />
                            <span>Autofill Form</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: All Items Search */}
            {activeTab === 'all' && (
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search all items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-full gold-input"
                  />
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                  {filteredAllItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#0e1711] border border-white/5 hover:border-[#f5c518]/30 flex items-center justify-between text-xs transition-all"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-100 truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.username}</div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {item.password && (
                          <button
                            onClick={() => copyToClipboard(item.password!, `p-${item.id}`)}
                            className="p-1 text-slate-400 hover:text-[#f5c518] cursor-pointer"
                            title="Copy Password"
                          >
                            {copiedId === `p-${item.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleExplicitAutofill(item)}
                          className="px-2 py-0.5 text-[10px] font-black rounded-full gold-btn cursor-pointer"
                          title="Autofill"
                        >
                          Fill
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Password Generator */}
            {activeTab === 'generator' && (
              <div className="space-y-3 p-1">
                <div className="p-3 rounded-2xl bg-[#090f0b] border border-[#f5c518]/30 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-100 tracking-wider break-all select-all">
                    {genPassword}
                  </span>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => generateRandomPassword(genLength)}
                      className="p-1 text-slate-400 hover:text-[#f5c518] hover:rotate-180 transition-all cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(genPassword);
                        setGenCopied(true);
                        setTimeout(() => setGenCopied(false), 2000);
                      }}
                      className="p-1 text-[#f5c518] hover:text-white cursor-pointer"
                    >
                      {genCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span>Length</span>
                    <span className="font-mono text-[#f5c518]">{genLength}</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    value={genLength}
                    onChange={(e) => {
                      const len = parseInt(e.target.value);
                      setGenLength(len);
                      generateRandomPassword(len);
                    }}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-[#f5c518]"
                  />
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(genPassword);
                    setGenCopied(true);
                    setTimeout(() => setGenCopied(false), 2000);
                  }}
                  className="w-full py-2 rounded-full gold-btn text-xs font-black uppercase tracking-wider mt-1 cursor-pointer"
                >
                  {genCopied ? 'Copied to Clipboard!' : 'Copy Generated Password'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 bg-[#090f0b] border-t border-white/5 text-[10px] text-center text-slate-500 font-mono">
        panda.vault extension v1.0.1
      </footer>
    </div>
  );
};
