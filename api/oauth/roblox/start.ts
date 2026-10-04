import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  AUTHORIZE_ENDPOINT,
  SESSION_COOKIE_NAME,
  base64Url,
  encryptPayload,
  getWebOAuthConfig,
  setCookie,
} from '../../_lib/oauth';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const { clientId, clientSecret, redirectUri } = getWebOAuthConfig(req);

  if (
    !clientId ||
    clientId === 'ROBLOX_OAUTH_CLIENT_ID' ||
    !clientSecret ||
    clientSecret === 'ROBLOX_OAUTH_CLIENT_SECRET'
  ) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error:
          'Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID and ROBLOX_OAUTH_CLIENT_SECRET in Vercel environment variables.',
      })
    );
    return;
  }

  // Generate random state for CSRF mitigation and nonce for OIDC token binding
  const state = base64Url(crypto.randomBytes(32));
  const nonce = base64Url(crypto.randomBytes(32));

  const sessionData = {
    state,
    nonce,
    redirectUri,
    createdAt: Date.now(),
  };

  // Store in secure, HttpOnly session cookie valid for 10 minutes
  const encryptedSession = encryptPayload(sessionData);
  setCookie(res, SESSION_COOKIE_NAME, encryptedSession, { maxAgeSeconds: 600 });

  // Confidential client authorization code flow:
  // PKCE parameters (code_challenge, code_challenge_method) are omitted as specified by Roblox docs.
  // The client_secret is server-side only and never sent in the browser authorization URL.
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile',
    state,
    nonce,
  }).toString();

  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.end();
}
