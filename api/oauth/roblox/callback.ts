import type { IncomingMessage, ServerResponse } from 'http';
import {
  AUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  TOKEN_ENDPOINT,
  USERINFO_ENDPOINT,
  decryptPayload,
  encryptPayload,
  getCookie,
  getWebOAuthConfig,
  setCookie,
} from '../../_lib/oauth';

interface SessionData {
  state: string;
  nonce: string;
  verifier: string;
  createdAt: number;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { clientId, redirectUri } = getWebOAuthConfig(req);
  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const requestUrl = new URL(req.url || '/', `${proto}://${host}`);

  const errorParam = requestUrl.searchParams.get('error');
  if (errorParam) {
    const errorDesc = requestUrl.searchParams.get('error_description') || errorParam;
    setCookie(res, SESSION_COOKIE_NAME, '', { clear: true });
    res.statusCode = 302;
    res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(errorDesc)}`);
    res.end();
    return;
  }

  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');

  const sessionCookie = getCookie(req, SESSION_COOKIE_NAME);
  const sessionData = decryptPayload<SessionData>(sessionCookie);
  setCookie(res, SESSION_COOKIE_NAME, '', { clear: true });

  if (!sessionData || !returnedState || returnedState !== sessionData.state) {
    res.statusCode = 302;
    res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=OAuth+state+validation+failed');
    res.end();
    return;
  }

  if (Date.now() - sessionData.createdAt > 10 * 60 * 1000) {
    res.statusCode = 302;
    res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=OAuth+session+expired');
    res.end();
    return;
  }

  if (!code) {
    res.statusCode = 302;
    res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=Missing+authorization+code');
    res.end();
    return;
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: sessionData.verifier,
        client_id: clientId,
        redirect_uri: redirectUri,
      }),
    });

    const tokenPayload = (await tokenResponse.json().catch(() => null)) as any;
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      const msg = tokenPayload?.error_description || tokenPayload?.error || 'Token exchange failed';
      res.statusCode = 302;
      res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(msg)}`);
      res.end();
      return;
    }

    // Call Roblox userinfo
    const userResponse = await fetch(USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: 'application/json',
      },
    });

    const userPayload = (await userResponse.json().catch(() => null)) as any;
    if (!userResponse.ok || !userPayload?.sub) {
      res.statusCode = 302;
      res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=User+verification+failed');
      res.end();
      return;
    }

    const userId = Number(userPayload.sub);
    const username = userPayload.preferred_username || userPayload.nickname || userPayload.name;
    const now = new Date().toISOString();

    const authData = {
      status: 'CONNECTED',
      userId,
      username,
      displayName: userPayload.name || userPayload.nickname || username,
      avatarUrl: userPayload.picture,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
      scope: typeof tokenPayload.scope === 'string' ? tokenPayload.scope.split(/\s+/) : ['openid', 'profile'],
      connectedAt: now,
      lastVerified: now,
      lastChecked: now,
      oauthStatus: 'PASS',
      tokenStatus: 'PASS',
      // Stored securely inside encrypted HttpOnly cookie:
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token,
    };

    // Store auth in encrypted HttpOnly cookie (30 days)
    const encryptedAuth = encryptPayload(authData);
    setCookie(res, AUTH_COOKIE_NAME, encryptedAuth, { maxAgeSeconds: 30 * 24 * 60 * 60 });

    res.statusCode = 302;
    res.setHeader('Location', '/?roblox_oauth=success');
    res.end();
  } catch (err: any) {
    res.statusCode = 302;
    res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(err.message || 'Connection error')}`);
    res.end();
  }
}
