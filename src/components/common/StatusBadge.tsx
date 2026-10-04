import React from 'react';
import { DataStatus } from '../../types/roblox';

interface StatusBadgeProps {
  status: DataStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = (s: string) => {
    switch (s) {
      case 'REAL':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'ESTIMATED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'IMPORTED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'CACHED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'UNAVAILABLE':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'ERROR':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border tracking-wider uppercase font-mono ${px} ${getBadgeStyle(
        status
      )}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
};
