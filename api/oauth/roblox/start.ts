import type { IncomingMessage, ServerResponse } from 'http';
import {
  AUTHORIZE_ENDPOINT,
  SESSION_COOKIE_NAME,
  encryptPayload,
  generatePkce,
  getWebOAuthConfig,
  setCookie,
} from '../../_lib/oauth';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const { clientId, redirectUri } = getWebOAuthConfig(req);

  if (!clientId || clientId === 'ROBLOX_OAUTH_CLIENT_ID') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID in Vercel environment variables.',
      })
    );
    return;
  }

  const { state, nonce, verifier, challenge } = generatePkce();

  const sessionData = {
    state,
    nonce,
    verifier,
    redirectUri,
    createdAt: Date.now(),
  };

  // Store in secure, HttpOnly session cookie valid for 10 minutes
  const encryptedSession = encryptPayload(sessionData);
  setCookie(res, SESSION_COOKIE_NAME, encryptedSession, { maxAgeSeconds: 600 });

  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.end();
}
