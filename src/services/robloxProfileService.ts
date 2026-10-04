// Roblox Profile Service
// Resolves legitimate usernames to User IDs and retrieves public profile information

import { NetworkClient } from './networkClient';
import { StorageService } from './storageService';
import { RobloxUserProfile, RobloxUserLookupResult, DataStatus } from '../types/roblox';

export interface LookupResponse {
  state: 'USER_FOUND' | 'USER_NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_ERROR';
  user?: RobloxUserLookupResult;
  errorMessage?: string;
}

export class RobloxProfileService {
  /**
   * Resolves a Roblox username to a real User ID via official Roblox API
   * POST https://users.roblox.com/v1/usernames/users
   */
  static async lookupUsername(username: string): Promise<LookupResponse> {
    const trimmed = username.trim();
    if (!trimmed) {
      return { state: 'USER_NOT_FOUND', errorMessage: 'Username cannot be blank' };
    }

    try {
      const response = await NetworkClient.request('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          usernames: [trimmed],
          excludeBannedUsers: false,
        },
      });

      if (response.status === 429) {
        return {
          state: 'RATE_LIMITED',
          errorMessage: 'Roblox API rate limit reached. Please wait a moment before trying again.',
        };
      }

      if (!response.ok && response.status !== 0) {
        return {
          state: 'NETWORK_ERROR',
          errorMessage: `Roblox service returned error HTTP ${response.status}`,
        };
      }

      if (response.status === 0) {
        return {
          state: 'NETWORK_ERROR',
          errorMessage: 'Unable to reach Roblox servers. Check your internet connection.',
        };
      }

      const users: any[] = response.data?.data || [];
      if (users.length > 0 && users[0]?.id) {
        const u = users[0];
        const result: RobloxUserLookupResult = {
          requestedUsername: u.requestedUsername || trimmed,
          id: u.id,
          name: u.name,
          displayName: u.displayName || u.name,
          hasVerifiedBadge: !!u.hasVerifiedBadge,
        };
        StorageService.addRecentSearch(result.name);
        return {
          state: 'USER_FOUND',
          user: result,
        };
      }

      return {
        state: 'USER_NOT_FOUND',
        errorMessage: `No Roblox account found with username "${trimmed}"`,
      };
    } catch (err: any) {
      return {
        state: 'NETWORK_ERROR',
        errorMessage: err.message || 'Network communication error',
      };
    }
  }

  /**
   * Fetches full public profile details for a given User ID
   * GET https://users.roblox.com/v1/users/{userId}
   */
  static async getUserProfile(userId: number): Promise<{
    profile: RobloxUserProfile | null;
    status: DataStatus;
    error?: string;
  }> {
    // Check cached profile first
    const cached = StorageService.getCachedProfile(userId);

    try {
      const response = await NetworkClient.request(`https://users.roblox.com/v1/users/${userId}`);

      if (response.ok && response.data?.id) {
        const data = response.data;
        const profile: RobloxUserProfile = {
          id: data.id,
          name: data.name,
          displayName: data.displayName || data.name,
          description: data.description || '',
          created: data.created,
          isBanned: !!data.isBanned,
          hasVerifiedBadge: !!data.hasVerifiedBadge,
          profileUrl: `https://www.roblox.com/users/${data.id}/profile`,
          status: 'REAL',
          lastUpdated: new Date().toISOString(),
        };

        StorageService.setCachedProfile(profile);
        return { profile, status: 'REAL' };
      }

      if (cached) {
        return { profile: { ...cached, status: 'CACHED' }, status: 'CACHED' };
      }

      return {
        profile: null,
        status: response.status === 429 ? 'UNAVAILABLE' : 'ERROR',
        error: response.data?.error || `Failed to fetch profile (Status ${response.status})`,
      };
    } catch (err: any) {
      if (cached) {
        return { profile: { ...cached, status: 'CACHED' }, status: 'CACHED' };
      }
      return { profile: null, status: 'ERROR', error: err.message };
    }
  }

  /**
   * Helper to resolve a username directly to a full profile
   */
  static async getUserByUsername(username: string): Promise<RobloxUserProfile | null> {
    const lookup = await this.lookupUsername(username);
    if (lookup.state !== 'USER_FOUND' || !lookup.user) {
      return null;
    }
    const profileRes = await this.getUserProfile(lookup.user.id);
    return profileRes.profile;
  }
}
