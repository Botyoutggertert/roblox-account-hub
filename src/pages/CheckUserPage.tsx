import React, { useState, useEffect } from 'react';
import {
  Search,
  UserCheck,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Award,
  Users,
  Package,
  Gamepad2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Lock,
  Link2,
  Layers,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  RobloxUserProfile,
  RobloxAvatarThumbnails,
  RobloxAvatarDetails,
  RobloxBadge,
  RobloxGroup,
  RobloxInventoryItem,
  RobloxGame,
  RobloxAuthStatus,
  OAuthDiagnostics,
} from '../types/roblox';
import { RobloxProfileService } from '../services/robloxProfileService';
import { RobloxAvatarService } from '../services/robloxAvatarService';
import { RobloxBadgeService } from '../services/robloxBadgeService';
import { RobloxGroupService } from '../services/robloxGroupService';
import { RobloxInventoryService } from '../services/robloxInventoryService';
import { RobloxGameService } from '../services/robloxGameService';
import { RobloxAuthorizationService } from '../services/robloxAuthorizationService';
import { StorageService } from '../services/storageService';
import { NetworkClient } from '../services/networkClient';
import { formatDate, calculateAccountAge } from '../utils/date';

type LookupStatus = 'IDLE' | 'USER_FOUND' | 'USER_NOT_FOUND' | 'NETWORK_ERROR';
type DetailSection = 'PROFILE' | 'AVATAR' | 'BADGES' | 'GROUPS' | 'INVENTORY' | 'GAMES' | 'CONNECTION';

interface CheckUserPageProps {
  initialUsername?: string;
}

export const CheckUserPage: React.FC<CheckUserPageProps> = ({ initialUsername = '' }) => {
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<DetailSection>('PROFILE');
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [avatarViewMode, setAvatarViewMode] = useState<'bust' | 'full'>('full');

  // Loaded user state
  const [profile, setProfile] = useState<RobloxUserProfile | null>(null);
  const [avatar, setAvatar] = useState<RobloxAvatarThumbnails | null>(null);
  const [avatarDetails, setAvatarDetails] = useState<RobloxAvatarDetails | null>(null);
  const [badges, setBadges] = useState<RobloxBadge[]>([]);
  const [groups, setGroups] = useState<RobloxGroup[]>([]);
  const [inventory, setInventory] = useState<RobloxInventoryItem[]>([]);
  const [isInventoryPrivate, setIsInventoryPrivate] = useState<boolean>(false);
  const [inventoryExplanation, setInventoryExplanation] = useState<string>('');
  const [games, setGames] = useState<RobloxGame[]>([]);
  const [authStatus, setAuthStatus] = useState<RobloxAuthStatus | null>(null);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<OAuthDiagnostics | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(StorageService.getRecentSearches());
    setAuthStatus(RobloxAuthorizationService.getAuthStatus());
    RobloxAuthorizationService.getDiagnostics().then(setOauthDiagnostics).catch(() => undefined);
  }, []);

  const handleLookup = async (targetUsername: string) => {
    const trimmed = targetUsername.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setStatusMessage('');

    try {
      // 1. Perform real username lookup via official Roblox API
      const lookupResult = await RobloxProfileService.lookupUsername(trimmed);

      if (lookupResult.state === 'USER_NOT_FOUND') {
        setLookupStatus('USER_NOT_FOUND');
        setStatusMessage(lookupResult.errorMessage || `User "${trimmed}" was not found on Roblox.`);
        setProfile(null);
        setAvatar(null);
        setIsLoading(false);
        return;
      }

      if (lookupResult.state === 'NETWORK_ERROR' || lookupResult.state === 'RATE_LIMITED') {
        setLookupStatus('NETWORK_ERROR');
        setStatusMessage(lookupResult.errorMessage || 'Unable to communicate with Roblox servers.');
        setIsLoading(false);
        return;
      }

      if (!lookupResult.user) {
        setLookupStatus('USER_NOT_FOUND');
        setStatusMessage(`User "${trimmed}" was not found.`);
        setIsLoading(false);
        return;
      }

      const userId = lookupResult.user.id;
      setLookupStatus('USER_FOUND');
      setStatusMessage(`Found user with ID ${userId}`);

      // 2. Fetch full real details in parallel using the resolved User ID
      const [
        profileRes,
        avatarThumbRes,
        avatarDetailRes,
        badgeRes,
        groupRes,
        inventoryRes,
        curatedGamesRes,
      ] = await Promise.all([
        RobloxProfileService.getUserProfile(userId),
        RobloxAvatarService.getAvatarThumbnails(userId),
        RobloxAvatarService.getAvatarDetails(userId),
        RobloxBadgeService.getUserBadges(userId, 30),
        RobloxGroupService.getUserGroups(userId),
        RobloxInventoryService.getUserInventory(userId),
        RobloxGameService.getGameDetails(RobloxGameService.getCuratedPublicGames()),
      ]);

      setProfile(profileRes.profile);
      setAvatar(avatarThumbRes.thumbnails);
      setAvatarDetails(avatarDetailRes);
      setBadges(badgeRes.badges || []);
      setGroups(groupRes.groups || []);
      setInventory(inventoryRes.items || []);
      setIsInventoryPrivate(inventoryRes.isPrivate);
      setInventoryExplanation(inventoryRes.coverageExplanation);
      setGames(curatedGamesRes.games || []);
      setAuthStatus(RobloxAuthorizationService.getAuthStatus());
      setRecentSearches(StorageService.getRecentSearches());
    } catch (err: any) {
      setLookupStatus('NETWORK_ERROR');
      setStatusMessage(err.message || 'Unexpected network communication error.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(usernameInput);
  };

  const handleCopyUserId = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.id.toString());
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleOpenProfile = () => {
    if (!profile) return;
    NetworkClient.openExternalUrl(profile.profileUrl);
  };

  const handleRefresh = () => {
    if (profile) {
      handleLookup(profile.name);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Search Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-surface-border shadow-xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-semibold mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>REAL ROBLOX LOOKUP</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Check User
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Resolves usernames directly against official Roblox endpoints. No demo data or mock accounts.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="roblox-username-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Roblox Username
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="roblox-username-input"
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="Enter exact Roblox username (e.g. Roblox, builderman)..."
                  className="w-full bg-surface-elevated border border-surface-border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div className="sm:self-end">
              <button
                type="submit"
                disabled={isLoading || !usernameInput.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-primary/25 transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>LOOKING UP...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>CHECK USER</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent Searches Pills */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Recent Searches:
              </span>
              {recentSearches.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setUsernameInput(name);
                    handleLookup(name);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-slate-800 border border-surface-border text-xs text-slate-300 hover:text-white transition"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Status Indicators */}
        {lookupStatus !== 'IDLE' && (
          <div className="pt-2">
            {lookupStatus === 'USER_FOUND' && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div className="text-xs sm:text-sm font-bold tracking-wide">
                  ✓ USER FOUND
                  {statusMessage && <span className="font-normal text-emerald-300 ml-2">({statusMessage})</span>}
                </div>
              </div>
            )}

            {lookupStatus === 'USER_NOT_FOUND' && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400">
                <XCircle className="w-5 h-5 shrink-0" />
                <div className="text-xs sm:text-sm font-bold tracking-wide">
                  ✕ USER NOT FOUND
                  {statusMessage && <span className="font-normal text-rose-300 ml-2">— {statusMessage}</span>}
                </div>
              </div>
            )}

            {lookupStatus === 'NETWORK_ERROR' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="text-xs sm:text-sm font-bold tracking-wide">
                  ⚠ NETWORK ERROR
                  {statusMessage && <span className="font-normal text-amber-300 ml-2">— {statusMessage}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ACCOUNT DETAIL VIEW */}
      {profile && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Account Header Panel */}
          <div className="p-6 sm:p-8 rounded-3xl bg-surface border border-surface-border shadow-xl">
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
              {/* Left: Avatar + Identity */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                {/* Avatar Display */}
                <div className="relative group shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-surface-elevated border-2 border-primary/40 overflow-hidden shadow-2xl flex items-center justify-center p-1">
                    {avatarViewMode === 'bust' ? (
                      <img
                        src={avatar?.headshotUrl || avatar?.fullBodyUrl || ''}
                        alt={profile.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={avatar?.fullBodyUrl || avatar?.headshotUrl || ''}
                        alt={profile.name}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  {/* Avatar toggle button */}
                  <div className="mt-2 flex justify-center gap-1">
                    <button
                      onClick={() => setAvatarViewMode('bust')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        avatarViewMode === 'bust'
                          ? 'bg-primary text-white'
                          : 'bg-surface-elevated text-slate-400 hover:text-white'
                      }`}
                    >
                      Headshot
                    </button>
                    <button
                      onClick={() => setAvatarViewMode('full')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        avatarViewMode === 'full'
                          ? 'bg-primary text-white'
                          : 'bg-surface-elevated text-slate-400 hover:text-white'
                      }`}
                    >
                      Full Body
                    </button>
                  </div>
                </div>

                {/* Account Core Details */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      {profile.displayName}
                    </h2>
                    {profile.hasVerifiedBadge && (
                      <span title="Verified Badge" className="text-blue-400">
                        <ShieldCheck className="w-5 h-5 inline" />
                      </span>
                    )}
                    {profile.isBanned && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30">
                        BANNED
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-mono text-slate-400">@{profile.name}</p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">User ID:</span>
                      <span className="font-mono font-bold text-white">{profile.id}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Created:</span>
                      <span className="font-semibold text-white">{formatDate(profile.created)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Age:</span>
                      <span className="font-semibold text-white">{calculateAccountAge(profile.created)}</span>
                    </div>
                  </div>

                  {profile.description ? (
                    <p className="text-xs text-slate-300 max-w-lg mt-3 line-clamp-2 italic bg-surface-elevated/60 p-2 rounded-xl border border-surface-border">
                      "{profile.description}"
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">No description provided.</p>
                  )}
                </div>
              </div>

              {/* Right: Profile Button */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                <button
                  onClick={handleOpenProfile}
                  className="px-5 py-3 rounded-xl bg-surface-elevated hover:bg-slate-800 border border-surface-border hover:border-primary/50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow"
                >
                  <ExternalLink className="w-4 h-4 text-primary" />
                  <span>OPEN ROBLOX PROFILE</span>
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="mt-8 pt-6 border-t border-surface-border flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
                Quick Actions:
              </span>
              <button
                onClick={handleOpenProfile}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                <span>OPEN PROFILE</span>
              </button>
              <button
                onClick={() => setActiveSection('AVATAR')}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>VIEW AVATAR</span>
              </button>
              <button
                onClick={() => setActiveSection('BADGES')}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>VIEW BADGES</span>
              </button>
              <button
                onClick={() => setActiveSection('GROUPS')}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>VIEW GROUPS</span>
              </button>
              <button
                onClick={() => setActiveSection('INVENTORY')}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>VIEW INVENTORY</span>
              </button>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>REFRESH DATA</span>
              </button>
              <button
                onClick={handleCopyUserId}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-surface-border flex items-center gap-1.5 transition"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>COPY USER ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border pb-3">
            {[
              { id: 'PROFILE' as DetailSection, label: 'PROFILE', icon: Layers },
              { id: 'AVATAR' as DetailSection, label: 'AVATAR', icon: Sparkles },
              { id: 'BADGES' as DetailSection, label: `BADGES (${badges.length})`, icon: Award },
              { id: 'GROUPS' as DetailSection, label: `GROUPS (${groups.length})`, icon: Users },
              { id: 'INVENTORY' as DetailSection, label: `INVENTORY (${inventory.length})`, icon: Package },
              { id: 'GAMES' as DetailSection, label: 'PUBLIC GAMES', icon: Gamepad2 },
              { id: 'CONNECTION' as DetailSection, label: 'CONNECTION', icon: Link2 },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-surface hover:bg-surface-elevated text-slate-400 hover:text-white border border-surface-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* SECTION CONTENTS */}

          {/* 1. PROFILE SECTION */}
          {activeSection === 'PROFILE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Account Identity</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-surface-border">
                    <span className="text-slate-400">Username</span>
                    <span className="font-mono font-bold text-white">{profile.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-surface-border">
                    <span className="text-slate-400">Display Name</span>
                    <span className="font-bold text-white">{profile.displayName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-surface-border">
                    <span className="text-slate-400">User ID</span>
                    <span className="font-mono font-bold text-white">{profile.id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-surface-border">
                    <span className="text-slate-400">Created At</span>
                    <span className="font-semibold text-white">{formatDate(profile.created)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-surface-border">
                    <span className="text-slate-400">Account Age</span>
                    <span className="font-semibold text-white">{calculateAccountAge(profile.created)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Verified Badge</span>
                    <span className="font-semibold text-white">
                      {profile.hasVerifiedBadge ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Public Biography</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed bg-surface-elevated p-4 rounded-2xl border border-surface-border min-h-[140px] whitespace-pre-wrap">
                  {profile.description || 'Not available'}
                </p>
                <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Source: Official Roblox Users API</span>
                  <a
                    href={profile.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View on Roblox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 2. AVATAR SECTION */}
          {activeSection === 'AVATAR' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Body Card */}
                <div className="p-6 rounded-3xl bg-surface border border-surface-border flex flex-col items-center text-center space-y-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Full Body Render (720x720)
                  </span>
                  <div className="w-64 h-64 rounded-2xl bg-surface-elevated border border-surface-border p-2 flex items-center justify-center">
                    {avatar?.fullBodyUrl ? (
                      <img
                        src={avatar.fullBodyUrl}
                        alt="Avatar full body"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Not available</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">Official Roblox Thumbnail CDN</span>
                </div>

                {/* Headshot Card */}
                <div className="p-6 rounded-3xl bg-surface border border-surface-border flex flex-col items-center text-center space-y-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Headshot Render (420x420)
                  </span>
                  <div className="w-64 h-64 rounded-2xl bg-surface-elevated border border-surface-border p-2 flex items-center justify-center">
                    {avatar?.headshotUrl ? (
                      <img
                        src={avatar.headshotUrl}
                        alt="Avatar headshot"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Not available</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">Official Roblox Thumbnail CDN</span>
                </div>
              </div>

              {/* Avatar Technical Details (Scales, Rig Type, Equipped Assets) */}
              <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Avatar Configuration</span>
                </h3>

                {avatarDetails ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border">
                        <span className="text-slate-400 text-[11px]">Rig Type</span>
                        <p className="font-bold text-white mt-1">{avatarDetails.playerAvatarType}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border">
                        <span className="text-slate-400 text-[11px]">Height Scale</span>
                        <p className="font-bold text-white mt-1">{avatarDetails.scale?.height ?? '1.0'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border">
                        <span className="text-slate-400 text-[11px]">Width Scale</span>
                        <p className="font-bold text-white mt-1">{avatarDetails.scale?.width ?? '1.0'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border">
                        <span className="text-slate-400 text-[11px]">Head Scale</span>
                        <p className="font-bold text-white mt-1">{avatarDetails.scale?.head ?? '1.0'}</p>
                      </div>
                    </div>

                    {/* Equipped Assets */}
                    <div className="pt-2">
                      <span className="font-bold text-slate-300 block mb-2">
                        Equipped Assets ({avatarDetails.equippedAssets?.length || 0}):
                      </span>
                      {avatarDetails.equippedAssets && avatarDetails.equippedAssets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {avatarDetails.equippedAssets.map(asset => (
                            <div
                              key={asset.id}
                              className="p-2.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between"
                            >
                              <div className="truncate mr-2">
                                <p className="font-semibold text-white truncate">{asset.name}</p>
                                <p className="text-[10px] text-slate-400">{asset.assetType.name}</p>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                #{asset.id}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">Not available</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Not available</p>
                )}
              </div>
            </div>
          )}

          {/* 3. BADGES SECTION */}
          {activeSection === 'BADGES' && (
            <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Public Badges</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Badges earned by this user from verified Roblox games.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                  {badges.length} Badges
                </span>
              </div>

              {badges.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {badges.map(badge => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-2xl bg-surface-elevated border border-surface-border flex items-start gap-3"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {badge.iconUrl || badge.displayIconUrl ? (
                          <img
                            src={badge.iconUrl || badge.displayIconUrl}
                            alt={badge.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Award className="w-6 h-6 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{badge.name}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {badge.description || 'Not available'}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>ID: {badge.id}</span>
                          {badge.awardedDate && <span>{formatDate(badge.awardedDate)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Not available through current Roblox API/authorization.
                </div>
              )}
            </div>
          )}

          {/* 4. GROUPS SECTION */}
          {activeSection === 'GROUPS' && (
            <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Roblox Groups</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Communities and organizations this user is a member of.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                  {groups.length} Groups
                </span>
              </div>

              {groups.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {groups.map(item => (
                    <div
                      key={item.group.id}
                      className="p-4 rounded-2xl bg-surface-elevated border border-surface-border flex items-start gap-3"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {item.group.iconUrl ? (
                          <img
                            src={item.group.iconUrl}
                            alt={item.group.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-white truncate">{item.group.name}</p>
                          {item.group.hasVerifiedBadge && (
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px]">
                          <p className="text-slate-300">
                            Role: <span className="font-semibold text-primary">{item.role?.name || 'Member'}</span>
                          </p>
                          {item.role?.rank !== undefined && (
                            <p className="text-slate-400 text-[10px]">Rank: {item.role.rank}</p>
                          )}
                          {item.group.memberCount !== undefined && (
                            <p className="text-slate-400 text-[10px]">
                              Members: {item.group.memberCount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] font-mono text-slate-500">Group ID: {item.group.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Not available through current Roblox API/authorization.
                </div>
              )}
            </div>
          )}

          {/* 5. INVENTORY SECTION */}
          {activeSection === 'INVENTORY' && (
            <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>Inventory Items</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Public inventory items returned through Roblox inventory APIs.
                </p>
              </div>

              {isInventoryPrivate ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
                  <Lock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-300">Inventory is Private</p>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      {inventoryExplanation ||
                        'This user’s inventory is set to Private under their Roblox privacy settings. Only public inventories can be accessed through standard Roblox APIs.'}
                    </p>
                  </div>
                </div>
              ) : inventory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {inventory.map(item => (
                    <div
                      key={item.assetId}
                      className="p-3 rounded-2xl bg-surface-elevated border border-surface-border text-center space-y-2"
                    >
                      <div className="w-20 h-20 mx-auto rounded-xl bg-slate-900 border border-surface-border p-1 flex items-center justify-center">
                        {item.iconUrl ? (
                          <img
                            src={item.iconUrl}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-slate-600" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.assetType}</p>
                      <p className="text-[10px] font-mono text-slate-500">#{item.assetId}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Not available through current Roblox API/authorization.
                </div>
              )}
            </div>
          )}

          {/* 6. PUBLIC GAME INFORMATION SECTION */}
          {activeSection === 'GAMES' && (
            <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <span>Public Game Information</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Public universe and place statistics officially available on Roblox.
                </p>
              </div>

              {games.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games.map(game => (
                    <div
                      key={game.id}
                      className="p-4 rounded-2xl bg-surface-elevated border border-surface-border flex items-start gap-3"
                    >
                      <div className="w-14 h-14 rounded-xl bg-slate-900 border border-surface-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {game.thumbnailUrl ? (
                          <img
                            src={game.thumbnailUrl}
                            alt={game.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Gamepad2 className="w-6 h-6 text-cyan-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{game.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">By {game.creator?.name || 'Creator'}</p>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-300">
                          {game.playing !== undefined && (
                            <span>{game.playing.toLocaleString()} Playing</span>
                          )}
                          {game.visits !== undefined && (
                            <span>{game.visits.toLocaleString()} Visits</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Not available through current Roblox API/authorization.
                </div>
              )}

              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border text-xs text-slate-400">
                <span className="font-semibold text-slate-300 block mb-1">Note regarding personal game playtime:</span>
                Personal play history, exact time spent playing, and private game sessions are not provided by Roblox's public APIs.
              </div>
            </div>
          )}

          {/* 7. CONNECTION SECTION */}
          {activeSection === 'CONNECTION' && (
            <div className="p-6 rounded-3xl bg-surface border border-surface-border space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  <span>Roblox Official Authorization Status</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  OAuth 2.0 connection state for this application.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-elevated border border-surface-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Connection State</span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {authStatus?.status || 'NOT CONNECTED'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-2 border-t border-surface-border pt-4">
                  {[
                    ['Username', authStatus?.username ? `@${authStatus.username}` : 'None'],
                    ['Display Name', authStatus?.displayName || 'Not available'],
                    ['Roblox User ID', authStatus?.userId?.toString() || 'Not available'],
                    ['OAuth Status', authStatus?.oauthStatus || 'NOT CONFIGURED'],
                    ['Token Status', authStatus?.tokenStatus || 'NOT CONFIGURED'],
                    ['Scopes', authStatus?.scope?.join(', ') || 'Not available'],
                    ['Connected Time', authStatus?.connectedAt ? formatDate(authStatus.connectedAt) : 'Never'],
                    ['Last Verified', authStatus?.lastVerified ? formatDate(authStatus.lastVerified) : 'Never'],
                    ['Masked Client ID', oauthDiagnostics?.maskedClientId || 'Not configured'],
                    ['Redirect URI Status', oauthDiagnostics?.redirectUri || 'NOT CONFIGURED'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4"><span>{label}:</span><span className="font-mono text-white text-right">{value}</span></div>
                  ))}
                  {authStatus?.profileUrl && <a href={authStatus.profileUrl} target="_blank" rel="noreferrer" className="flex justify-between text-primary"><span>Profile:</span><span>Open profile ↗</span></a>}
                  {authStatus?.avatarUrl && <div className="flex justify-between items-center"><span>Avatar:</span><img src={authStatus.avatarUrl} alt="Roblox avatar" className="w-10 h-10 rounded-lg" /></div>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-surface-border pt-4">
                  {oauthDiagnostics && (['clientId', 'authorization', 'redirectUri', 'callback', 'tokenExchange', 'userInfo', 'tokenValidation'] as const).map(key => (
                    <div key={key} className="rounded-lg border border-surface-border p-2">
                      <div className="text-[10px] uppercase text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div className={`text-xs font-bold mt-1 ${oauthDiagnostics[key] === 'PASS' ? 'text-emerald-400' : oauthDiagnostics[key] === 'FAIL' ? 'text-red-400' : 'text-slate-400'}`}>{oauthDiagnostics[key]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
