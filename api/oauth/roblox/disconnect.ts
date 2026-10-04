import type { IncomingMessage, ServerResponse } from 'http';
import {
  AUTH_COOKIE_NAME,
  REVOKE_ENDPOINT,
  decryptPayload,
  getCookie,
  getWebOAuthConfig,
  setCookie,
} from '../../_lib/oauth';

interface AuthCookieData {
  refreshToken?: string;
  accessToken?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cookie = getCookie(req, AUTH_COOKIE_NAME);
  const data = decryptPayload<AuthCookieData>(cookie);
  const { clientId, clientSecret } = getWebOAuthConfig(req);

  // Revoke token if present
  if (data?.refreshToken && clientId) {
    try {
      const revokeBody = new URLSearchParams({
        token: data.refreshToken,
        client_id: clientId,
      });
      if (clientSecret && clientSecret !== 'ROBLOX_OAUTH_CLIENT_SECRET') {
        revokeBody.set('client_secret', clientSecret);
      }
      await fetch(REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: revokeBody,
      });
    } catch {}
  }

  // Clear auth cookie
  setCookie(res, AUTH_COOKIE_NAME, '', { clear: true });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      status: 'NOT CONNECTED',
      lastChecked: new Date().toISOString(),
    })
  );
}
