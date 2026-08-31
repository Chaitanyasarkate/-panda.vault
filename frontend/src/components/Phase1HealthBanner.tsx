'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, XCircle, RefreshCw, Server, Database, Shield } from 'lucide-react';

export interface HealthResponse {
  status: string;
  service: string;
  database: string;
  environment: string;
  phase: string;
}

export const Phase1HealthBanner: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/health`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Cannot reach FastAPI backend server');
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto my-6 p-6 rounded-3xl glass-panel border border-slate-700/80 shadow-2xl space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Phase 1: Environment & System Status
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Verified
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live connectivity verification between Next.js, FastAPI, and PostgreSQL
            </p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Ping Backend</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Frontend Status */}
        <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Frontend (Next.js)
            </span>
            <span className="text-xs font-bold text-emerald-400">Online :3000</span>
          </div>
        </div>

        {/* Backend Status */}
        <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
          <div className={`h-9 w-9 rounded-xl ${error ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'} flex items-center justify-center shrink-0`}>
            <Server className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Backend (FastAPI)
            </span>
            <span className={`text-xs font-bold truncate block ${error ? 'text-amber-400' : 'text-emerald-400'}`}>
              {loading ? 'Checking...' : error ? 'Offline / Pending' : `${health?.service} (Healthy)`}
            </span>
          </div>
        </div>

        {/* Database Status */}
        <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center space-x-3">
          <div className={`h-9 w-9 rounded-xl ${error ? 'bg-slate-800 border border-slate-700 text-slate-400' : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'} flex items-center justify-center shrink-0`}>
            <Database className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              PostgreSQL Engine
            </span>
            <span className="text-xs font-bold text-slate-300 truncate block">
              {loading ? 'Checking...' : health?.database || 'SQLAlchemy Ready'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between font-mono">
        <span>Target API: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</span>
        {lastChecked && <span>Last Checked: {lastChecked}</span>}
      </div>
    </div>
  );
};
