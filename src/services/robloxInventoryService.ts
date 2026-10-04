// Roblox Inventory Service
// Queries public inventory categories while properly reporting privacy state
// https://inventory.roblox.com/v2/users/{userId}/inventory

import { NetworkClient } from './networkClient';
import { RobloxInventoryItem, DataStatus } from '../types/roblox';

export class RobloxInventoryService {
  static async getUserInventory(
    userId: number,
    assetTypes: string = 'Hat,HairAccessory,FaceAccessory,Shirt,Pants',
    limit: number = 30
  ): Promise<{
    items: RobloxInventoryItem[];
    status: DataStatus;
    isPrivate: boolean;
    coverageExplanation: string;
  }> {
    try {
      const response = await NetworkClient.request(
        `https://inventory.roblox.com/v2/users/${userId}/inventory?assetTypes=${encodeURIComponent(
          assetTypes
        )}&limit=${limit}&sortOrder=Desc`
      );

      // Roblox returns 403 Forbidden when inventory is set to private by the user
      if (response.status === 403) {
        return {
          items: [],
          status: 'UNAVAILABLE',
          isPrivate: true,
          coverageExplanation:
            'This user’s inventory is set to Private under their Roblox privacy settings. Only public inventories can be accessed through standard Roblox APIs.',
        };
      }

      if (response.ok && response.data?.data) {
        const rawItems = response.data.data;
        const items: RobloxInventoryItem[] = rawItems.map((item: any) => ({
          assetId: item.assetId,
          name: item.name || `Asset #${item.assetId}`,
          assetType: item.assetType || 'Accessory',
          created: item.created,
          iconUrl: `https://thumbnails.roblox.com/v1/assets?assetIds=${item.assetId}&size=150x150&format=Png`,
          ownershipState: 'OWNED',
        }));

        return {
          items,
          status: 'REAL',
          isPrivate: false,
          coverageExplanation:
            'Showing items retrieved via public inventory endpoints for permitted categories.',
        };
      }

      return {
        items: [],
        status: response.status === 429 ? 'UNAVAILABLE' : 'ERROR',
        isPrivate: false,
        coverageExplanation:
          response.status === 429
            ? 'Rate limited by Roblox inventory service.'
            : 'Unable to query inventory endpoint at this time.',
      };
    } catch {
      return {
        items: [],
        status: 'ERROR',
        isPrivate: false,
        coverageExplanation: 'Network communication error while querying inventory.',
      };
    }
  }
}
