// Roblox Avatar Service
// Fetches official headshot, bust, full body thumbnails and 3D avatar preview metadata

import { NetworkClient } from './networkClient';
import { StorageService } from './storageService';
import {
  RobloxAvatarThumbnails,
  RobloxAvatarDetails,
  DataStatus,
} from '../types/roblox';

export class RobloxAvatarService {
  /**
   * Retrieves official high-res avatar thumbnails (headshot, bust, full body)
   */
  static async getAvatarThumbnails(userId: number): Promise<{
    thumbnails: RobloxAvatarThumbnails;
    status: DataStatus;
  }> {
    const cached = StorageService.getCachedAvatar(userId);

    try {
      // Parallel fetch for headshot, bust, full body, and 3D metadata
      const [headshotRes, bustRes, fullBodyRes, threeDRes] = await Promise.all([
        NetworkClient.request(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        ),
        NetworkClient.request(
          `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${userId}&size=420x420&format=Png&isCircular=false`
        ),
        NetworkClient.request(
          `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
        ),
        NetworkClient.request(
          `https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${userId}`
        ),
      ]);

      const headshotUrl = headshotRes.data?.data?.[0]?.imageUrl || '';
      const bustUrl = bustRes.data?.data?.[0]?.imageUrl || '';
      const fullBodyUrl = fullBodyRes.data?.data?.[0]?.imageUrl || '';

      const is3dSupported = threeDRes.ok && threeDRes.data?.state === 'Completed' && !!threeDRes.data?.imageUrl;
      const threeDModelUrl = is3dSupported ? threeDRes.data.imageUrl : undefined;

      if (headshotUrl || fullBodyUrl) {
        const thumbnails: RobloxAvatarThumbnails = {
          headshotUrl: headshotUrl || fullBodyUrl,
          bustUrl: bustUrl || fullBodyUrl,
          fullBodyUrl: fullBodyUrl || headshotUrl,
          threeDModelUrl,
          is3dSupported,
          status: 'REAL',
        };

        StorageService.setCachedAvatar(userId, { thumbnails });
        return { thumbnails, status: 'REAL' };
      }

      if (cached?.thumbnails) {
        return { thumbnails: { ...cached.thumbnails, status: 'CACHED' }, status: 'CACHED' };
      }

      return {
        thumbnails: {
          headshotUrl: '',
          bustUrl: '',
          fullBodyUrl: '',
          is3dSupported: false,
          status: 'UNAVAILABLE',
        },
        status: 'UNAVAILABLE',
      };
    } catch {
      if (cached?.thumbnails) {
        return { thumbnails: { ...cached.thumbnails, status: 'CACHED' }, status: 'CACHED' };
      }
      return {
        thumbnails: {
          headshotUrl: '',
          bustUrl: '',
          fullBodyUrl: '',
          is3dSupported: false,
          status: 'ERROR',
        },
        status: 'ERROR',
      };
    }
  }

  /**
   * Retrieves avatar rig type (R6/R15), scales, and equipped asset accessories
   * GET https://avatar.roblox.com/v1/users/{userId}/avatar
   */
  static async getAvatarDetails(userId: number): Promise<RobloxAvatarDetails | null> {
    try {
      const response = await NetworkClient.request(
        `https://avatar.roblox.com/v1/users/${userId}/avatar`
      );

      if (response.ok && response.data) {
        const d = response.data;
        return {
          scale: d.scales || { height: 1, width: 1, head: 1, depth: 1, proportion: 0, bodyType: 0 },
          playerAvatarType: d.playerAvatarType || 'R15',
          bodyColors: d.bodyColors || {
            headColorId: 0,
            torsoColorId: 0,
            rightArmColorId: 0,
            leftArmColorId: 0,
            rightLegColorId: 0,
            leftLegColorId: 0,
          },
          equippedAssets: (d.assets || []).map((a: any) => ({
            id: a.id,
            name: a.name || `Asset #${a.id}`,
            assetType: {
              id: a.assetType?.id || 0,
              name: a.assetType?.name || 'Accessory',
            },
          })),
          emotes: (d.emotes || []).map((e: any) => ({
            assetId: e.assetId,
            assetName: e.assetName || 'Emote',
            position: e.position || 0,
          })),
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
