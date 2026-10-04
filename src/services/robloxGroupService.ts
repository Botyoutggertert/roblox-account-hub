// Roblox Group Membership Service
// GET https://groups.roblox.com/v2/users/{userId}/groups/roles

import { NetworkClient } from './networkClient';
import { RobloxGroup, DataStatus } from '../types/roblox';

export class RobloxGroupService {
  static async getUserGroups(userId: number): Promise<{
    groups: RobloxGroup[];
    status: DataStatus;
  }> {
    try {
      const response = await NetworkClient.request(
        `https://groups.roblox.com/v2/users/${userId}/groups/roles`
      );

      if (response.ok && response.data?.data) {
        const rawList = response.data.data;
        const groups: RobloxGroup[] = rawList.map((item: any) => ({
          group: {
            id: item.group.id,
            name: item.group.name,
            description: item.group.description,
            memberCount: item.group.memberCount,
            hasVerifiedBadge: item.group.hasVerifiedBadge,
          },
          role: {
            id: item.role.id,
            name: item.role.name,
            rank: item.role.rank,
          },
        }));

        // Fetch group icons in batch
        if (groups.length > 0) {
          const groupIds = groups.map(g => g.group.id).slice(0, 50).join(',');
          const iconRes = await NetworkClient.request(
            `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupIds}&size=150x150&format=Png`
          );

          if (iconRes.ok && iconRes.data?.data) {
            const iconMap = new Map<number, string>();
            for (const item of iconRes.data.data) {
              if (item.targetId && item.imageUrl) {
                iconMap.set(item.targetId, item.imageUrl);
              }
            }
            for (const g of groups) {
              const url = iconMap.get(g.group.id);
              if (url) g.group.iconUrl = url;
            }
          }
        }

        return { groups, status: 'REAL' };
      }

      return {
        groups: [],
        status: response.status === 429 ? 'UNAVAILABLE' : 'ERROR',
      };
    } catch {
      return { groups: [], status: 'ERROR' };
    }
  }
}
