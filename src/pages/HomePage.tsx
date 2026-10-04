import React from 'react';
import { UserCheck, KeyRound, Link2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { NavTab } from '../components/navigation/TopBar';

interface HomePageProps {
  onNavigate: (tab: NavTab) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between max-w-5xl mx-auto px-4 py-8 sm:py-12">
      {/* Title & Introduction */}
      <div className="text-center space-y-4 my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold tracking-wide uppercase">
          <Zap className="w-3.5 h-3.5" />
          <span>Official Roblox API & Offline 2FA</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight">
          Roblox Account Hub
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
          Direct Roblox account lookup, real-time public profile inspection, multi-account offline authenticator, and official OAuth authorization.
        </p>

        {/* Three Large Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 max-w-4xl mx-auto text-left">
          {/* Card 1: CHECK USER */}
          <button
            onClick={() => onNavigate('check-user')}
            className="group relative p-6 sm:p-8 rounded-3xl bg-surface hover:bg-surface-elevated border border-surface-border hover:border-primary/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-primary/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCheck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                  CHECK USER
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Look up real Roblox usernames, resolve official User IDs, inspect avatars, badges, groups, and public inventories.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
              <span>Open Tool</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Card 2: AUTHENTICATOR */}
          <button
            onClick={() => onNavigate('authenticator')}
            className="group relative p-6 sm:p-8 rounded-3xl bg-surface hover:bg-surface-elevated border border-surface-border hover:border-purple-500/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <KeyRound className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                  AUTHENTICATOR
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Real multi-account RFC 6238 TOTP authenticator with live countdowns, Base32 validation, and secure offline storage.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
              <span>Open Tool</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Card 3: ROBLOX CONNECTION */}
          <button
            onClick={() => onNavigate('roblox-connection')}
            className="group relative p-6 sm:p-8 rounded-3xl bg-surface hover:bg-surface-elevated border border-surface-border hover:border-emerald-500/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Link2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  ROBLOX CONNECTION
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Official Roblox OAuth authorization flow. Zero cookie inputs, zero token exposure, and direct status checks.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Open Tool</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* Small Footer */}
      <footer className="text-center pt-8 border-t border-surface-border/50 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-400">Real data only</p>
        <p>No demo data</p>
      </footer>
    </div>
  );
};
