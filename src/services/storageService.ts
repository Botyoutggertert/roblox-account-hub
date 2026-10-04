// Local Storage & Safe State Persistence Service
// All user and cache data is kept locally on the user's machine.
// Zero demo data or hardcoded users are injected.

import { TotpAccount } from '../types/totp';
import { RobloxUserProfile, RobloxAvatarThumbnails, RobloxAvatarDetails, RobloxAuthStatus } from '../types/roblox';

const STORAGE_KEYS = {
  TOTP_ACCOUNTS: 'rah_totp_accounts_v1',
  AUTH_STATUS: 'rah_official_auth_status_v1',
  CACHED_PROFILE: 'rah_cached_profile_v1',
  CACHED_AVATAR: 'rah_cached_avatar_v1',
  RECENT_SEARCHES: 'rah_recent_searches_v1',
};

export class StorageService {
  // TOTP Accounts — starts strictly empty by default (no demo accounts)
  static getTotpAccounts(): TotpAccount[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TOTP_ACCOUNTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load TOTP accounts', e);
      return [];
    }
  }

  static saveTotpAccounts(accounts: TotpAccount[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TOTP_ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save TOTP accounts', e);
    }
  }

  static addTotpAccount(account: TotpAccount): void {
    const list = this.getTotpAccounts().filter(a => a.id !== account.id);
    list.unshift(account);
    this.saveTotpAccounts(list);
  }

  static updateTotpAccount(updated: TotpAccount): void {
    const list = this.getTotpAccounts().map(a => (a.id === updated.id ? updated : a));
    this.saveTotpAccounts(list);
  }

  static deleteTotpAccount(id: string): void {
    const list = this.getTotpAccounts().filter(a => a.id !== id);
    this.saveTotpAccounts(list);
  }

  // Official Roblox OAuth Authorization State
  static getAuthStatus(): RobloxAuthStatus {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load auth status', e);
    }

    return {
      status: 'NOT CONNECTED',
      lastChecked: new Date().toISOString(),
    };
  }

  static saveAuthStatus(status: RobloxAuthStatus): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH_STATUS, JSON.stringify(status));
    } catch (e) {
      console.error('Failed to save auth status', e);
    }
  }

  static clearAuthStatus(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
    } catch (e) {
      console.error('Failed to clear auth status', e);
    }
  }

  // Profile Cache
  static getCachedProfile(userId: number): RobloxUserProfile | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.CACHED_PROFILE}_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static setCachedProfile(profile: RobloxUserProfile): void {
    try {
      localStorage.setItem(
        `${STORAGE_KEYS.CACHED_PROFILE}_${profile.id}`,
        JSON.stringify(profile)
      );
    } catch (e) {
      console.error('Failed to cache profile', e);
    }
  }

  // Avatar Cache
  static getCachedAvatar(userId: number): {
    thumbnails: RobloxAvatarThumbnails;
    details?: RobloxAvatarDetails;
  } | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.CACHED_AVATAR}_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static setCachedAvatar(
    userId: number,
    data: { thumbnails: RobloxAvatarThumbnails; details?: RobloxAvatarDetails }
  ): void {
    try {
      localStorage.setItem(`${STORAGE_KEYS.CACHED_AVATAR}_${userId}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to cache avatar', e);
    }
  }

  // Recent Searches
  static getRecentSearches(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addRecentSearch(username: string): void {
    if (!username) return;
    try {
      const current = this.getRecentSearches().filter(s => s.toLowerCase() !== username.toLowerCase());
      const updated = [username, ...current].slice(0, 10);
      localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save search', e);
    }
  }

  static clearRecentSearches(): void {
    localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
  }
}
