// Roblox Badge Service
// GET https://badges.roblox.com/v1/users/{userId}/badges

import { NetworkClient } from './networkClient';
import { RobloxBadge, DataStatus } from '../types/roblox';

export class RobloxBadgeService {
  static async getUserBadges(
    userId: number,
    limit: number = 30,
    cursor?: string
  ): Promise<{
    badges: RobloxBadge[];
    nextCursor?: string;
    status: DataStatus;
  }> {
    try {
      const url = `https://badges.roblox.com/v1/users/${userId}/badges?limit=${limit}&sortOrder=Desc${
        cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      }`;

      const response = await NetworkClient.request(url);

      if (response.ok && response.data?.data) {
        const rawList = response.data.data;
        const badges: RobloxBadge[] = rawList.map((b: any) => ({
          id: b.id,
          name: b.name,
          description: b.description || 'No description provided.',
          iconImageId: b.iconImageId,
          iconUrl: b.iconImageId
            ? `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${b.id}&size=150x150&format=Png`
            : undefined,
          displayIconUrl: b.displayIconUrl,
          created: b.created,
          updated: b.updated,
          statistics: b.statistics
            ? {
                pastDayAwardedCount: b.statistics.pastDayAwardedCount || 0,
                awardedCount: b.statistics.awardedCount || 0,
                winRatePercentage: b.statistics.winRatePercentage || 0,
              }
            : undefined,
          awardingUniverse: b.awardingUniverse
            ? {
                id: b.awardingUniverse.id,
                name: b.awardingUniverse.name,
                rootPlaceId: b.awardingUniverse.rootPlaceId,
              }
            : undefined,
          awardedDate: b.awardedDate,
        }));

        // Batch fetch badge icon thumbnails if needed
        if (badges.length > 0) {
          const badgeIds = badges.map(b => b.id).slice(0, 50).join(',');
          const iconRes = await NetworkClient.request(
            `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${badgeIds}&size=150x150&format=Png`
          );
          if (iconRes.ok && iconRes.data?.data) {
            const iconMap = new Map<number, string>();
            for (const item of iconRes.data.data) {
              if (item.targetId && item.imageUrl) {
                iconMap.set(item.targetId, item.imageUrl);
              }
            }
            for (const b of badges) {
              const url = iconMap.get(b.id);
              if (url) b.iconUrl = url;
            }
          }
        }

        return {
          badges,
          nextCursor: response.data.nextPageCursor || undefined,
          status: 'REAL',
        };
      }

      return {
        badges: [],
        status: response.status === 429 ? 'UNAVAILABLE' : 'ERROR',
      };
    } catch {
      return { badges: [], status: 'ERROR' };
    }
  }
}
