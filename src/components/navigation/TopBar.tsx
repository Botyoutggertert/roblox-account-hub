import React from 'react';
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  Link2,
  Home,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { ConnectionStatus } from '../../types/roblox';

export type NavTab = 'home' | 'check-user' | 'authenticator' | 'roblox-connection';

interface TopBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  connectionStatus: ConnectionStatus;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onSelectTab,
  connectionStatus,
}) => {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  const handleMinimize = () => {
    if (isElectron && (window as any).electronAPI?.minimizeWindow) {
      (window as any).electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (isElectron && (window as any).electronAPI?.maximizeWindow) {
      (window as any).electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (isElectron && (window as any).electronAPI?.closeWindow) {
      (window as any).electronAPI.closeWindow();
    }
  };

  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'check-user' as NavTab, label: 'Check User', icon: UserCheck },
    { id: 'authenticator' as NavTab, label: 'Authenticator', icon: KeyRound },
    { id: 'roblox-connection' as NavTab, label: 'Roblox Connection', icon: Link2 },
  ];

  return (
    <header className="h-16 bg-surface/95 backdrop-blur-md border-b border-surface-border px-4 sm:px-6 flex items-center justify-between select-none z-20 shrink-0 sticky top-0">
      {/* Brand */}
      <div
        onClick={() => onSelectTab('home')}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
            Roblox Account Hub
          </span>
          <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-surface-elevated text-slate-400 border border-surface-border">
            Real Data
          </span>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1 sm:gap-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-surface-elevated'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Connection status indicator */}
        <div
          onClick={() => onSelectTab('roblox-connection')}
          title={`Status: ${connectionStatus}`}
          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-elevated border border-surface-border cursor-pointer hover:border-slate-600 transition"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-400 animate-pulse'
                : connectionStatus === 'AUTHORIZATION EXPIRED'
                ? 'bg-amber-400'
                : connectionStatus === 'CONNECTION ERROR'
                ? 'bg-rose-500'
                : 'bg-slate-500'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-300">
            {connectionStatus === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Electron Window Controls */}
        {isElectron && (
          <div className="flex items-center gap-1 pl-2 border-l border-surface-border">
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-rose-600 text-slate-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
