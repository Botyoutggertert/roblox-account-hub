// Roblox Public Games Service
// Retrieves public game information, places, and thumbnails.
// Note: Transparently communicates that personal playtime/history is unavailable through public APIs.

import { NetworkClient } from './networkClient';
import { RobloxGame, DataStatus } from '../types/roblox';

export class RobloxGameService {
  /**
   * Fetches public game information for known universe IDs
   */
  static async getGameDetails(universeIds: number[]): Promise<{
    games: RobloxGame[];
    status: DataStatus;
  }> {
    if (!universeIds || universeIds.length === 0) {
      return { games: [], status: 'UNAVAILABLE' };
    }

    try {
      const idsParam = universeIds.slice(0, 50).join(',');
      const response = await NetworkClient.request(
        `https://games.roblox.com/v1/games?universeIds=${idsParam}`
      );

      if (response.ok && response.data?.data) {
        const rawGames = response.data.data;
        const games: RobloxGame[] = rawGames.map((g: any) => ({
          id: g.id,
          rootPlaceId: g.rootPlaceId,
          name: g.name,
          description: g.description || 'No description provided.',
          creator: {
            id: g.creator?.id || 0,
            name: g.creator?.name || 'Roblox Creator',
            type: g.creator?.type || 'User',
            hasVerifiedBadge: !!g.creator?.hasVerifiedBadge,
          },
          price: g.price,
          playing: g.playing,
          visits: g.visits,
          maxPlayers: g.maxPlayers,
          created: g.created,
          updated: g.updated,
          thumbnailUrl: `https://thumbnails.roblox.com/v1/games/icons?universeIds=${g.id}&size=150x150&format=Png`,
          publicStatsAvailable: true,
          userPlayHistoryAvailable: false, // Explicitly false per prompt rule
        }));

        // Fetch thumbnails in batch
        const iconRes = await NetworkClient.request(
          `https://thumbnails.roblox.com/v1/games/icons?universeIds=${idsParam}&size=150x150&format=Png`
        );
        if (iconRes.ok && iconRes.data?.data) {
          const map = new Map<number, string>();
          for (const item of iconRes.data.data) {
            if (item.targetId && item.imageUrl) {
              map.set(item.targetId, item.imageUrl);
            }
          }
          for (const g of games) {
            const url = map.get(g.id);
            if (url) g.thumbnailUrl = url;
          }
        }

        return { games, status: 'REAL' };
      }

      return { games: [], status: 'ERROR' };
    } catch {
      return { games: [], status: 'ERROR' };
    }
  }

  /**
   * Returns standard curated popular public Roblox games for the Games discovery page
   */
  static getCuratedPublicGames(): number[] {
    // Universe IDs for popular verified Roblox experiences (Blox Fruits, Brookhaven, Adopt Me, etc.)
    return [
      994732206, // Blox Fruits
      1962086868, // Brookhaven RP
      920587237, // Adopt Me!
      606849621, // Jailbreak
      111958650, // Arsenal
      137885680, // Tower of Hell
      383310974, // Pet Simulator
      2619619496, // Murder Mystery 2
    ];
  }
}
