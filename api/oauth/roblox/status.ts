import type { IncomingMessage, ServerResponse } from 'http';
import { AUTH_COOKIE_NAME, decryptPayload, getCookie } from '../../_lib/oauth';

interface AuthCookieData {
  status: 'CONNECTED' | 'NOT CONNECTED';
  userId?: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  scope?: string[];
  connectedAt?: string;
  lastVerified?: string;
  lastChecked?: string;
  oauthStatus?: string;
  tokenStatus?: string;
  accessToken?: string;
  refreshToken?: string;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const cookie = getCookie(req, AUTH_COOKIE_NAME);
  const data = decryptPayload<AuthCookieData>(cookie);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (!data || data.status !== 'CONNECTED' || !data.userId) {
    res.end(
      JSON.stringify({
        status: 'NOT CONNECTED',
        lastChecked: new Date().toISOString(),
      })
    );
    return;
  }

  // Never return sensitive tokens to renderer
  const safeStatus = {
    status: 'CONNECTED',
    userId: data.userId,
    username: data.username,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl,
    profileUrl: data.profileUrl,
    scope: data.scope,
    connectedAt: data.connectedAt,
    lastVerified: data.lastVerified,
    lastChecked: new Date().toISOString(),
    oauthStatus: data.oauthStatus || 'PASS',
    tokenStatus: data.tokenStatus || 'PASS',
  };

  res.end(JSON.stringify(safeStatus));
}
