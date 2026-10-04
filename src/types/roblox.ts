// Roblox API Types and Data State Definitions

export type DataStatus = 'REAL' | 'CACHED' | 'UNAVAILABLE' | 'ERROR';

export interface RobloxUserLookupResult {
  requestedUsername: string;
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
}

export interface RobloxUserProfile {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string; // ISO 8601
  isBanned: boolean;
  hasVerifiedBadge: boolean;
  profileUrl: string;
  status: DataStatus;
  lastUpdated: string;
}

export interface RobloxAvatarThumbnails {
  headshotUrl: string;
  bustUrl: string;
  fullBodyUrl: string;
  threeDModelUrl?: string;
  is3dSupported: boolean;
  status: DataStatus;
}

export interface RobloxAvatarDetails {
  scale: {
    height: number;
    width: number;
    head: number;
    depth: number;
    proportion: number;
    bodyType: number;
  };
  playerAvatarType: 'R6' | 'R15' | 'Unknown';
  bodyColors: {
    headColorId: number;
    torsoColorId: number;
    rightArmColorId: number;
    leftArmColorId: number;
    rightLegColorId: number;
    leftLegColorId: number;
  };
  equippedAssets: Array<{
    id: number;
    name: string;
    assetType: {
      id: number;
      name: string;
    };
  }>;
  emotes?: Array<{
    assetId: number;
    assetName: string;
    position: number;
  }>;
}

export interface RobloxBadge {
  id: number;
  name: string;
  description: string;
  iconImageId: number;
  iconUrl?: string;
  displayIconUrl?: string;
  created?: string;
  updated?: string;
  statistics?: {
    pastDayAwardedCount: number;
    awardedCount: number;
    winRatePercentage: number;
  };
  awardingUniverse?: {
    id: number;
    name: string;
    rootPlaceId: number;
  };
  awardedDate?: string;
}

export interface RobloxGroupRole {
  id: number;
  name: string;
  rank: number;
}

export interface RobloxGroup {
  group: {
    id: number;
    name: string;
    description?: string;
    memberCount?: number;
    iconUrl?: string;
    hasVerifiedBadge?: boolean;
  };
  role: RobloxGroupRole;
}

export interface RobloxInventoryItem {
  assetId: number;
  name: string;
  assetType: string;
  created?: string;
  iconUrl?: string;
  ownershipState?: 'OWNED' | 'UNKNOWN';
}

export interface RobloxGame {
  id: number; // universeId
  rootPlaceId: number;
  name: string;
  description: string;
  creator: {
    id: number;
    name: string;
    type: string;
    hasVerifiedBadge?: boolean;
  };
  price?: number;
  playing?: number;
  visits?: number;
  maxPlayers?: number;
  created: string;
  updated: string;
  thumbnailUrl?: string;
  publicStatsAvailable: boolean;
  userPlayHistoryAvailable: boolean;
}

export type ConnectionStatus =
  | 'CONNECTED'
  | 'NOT CONNECTED'
  | 'AUTHORIZATION EXPIRED'
  | 'ACCESS REVOKED'
  | 'CONNECTION ERROR';

export type DiagnosticStatus = 'PASS' | 'FAIL' | 'NOT CONFIGURED' | 'CHECKING';

export interface OAuthDiagnostics {
  clientId: DiagnosticStatus;
  clientSecret?: DiagnosticStatus;
  clientSecretConfigured?: boolean;
  authorization: DiagnosticStatus;
  redirectUri: DiagnosticStatus;
  callback: DiagnosticStatus;
  tokenExchange: DiagnosticStatus;
  userInfo: DiagnosticStatus;
  tokenValidation: DiagnosticStatus;
  maskedClientId: string;
  redirectUriValue: string;
}

export interface RobloxAuthStatus {
  status: ConnectionStatus;
  userId?: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  scope?: string[];
  connectedAt?: string;
  expiresAt?: string;
  lastChecked?: string;
  lastVerified?: string;
  oauthStatus?: DiagnosticStatus;
  tokenStatus?: DiagnosticStatus;
}
