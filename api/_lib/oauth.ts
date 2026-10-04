import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export const AUTHORIZE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/authorize';
export const TOKEN_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token';
export const USERINFO_ENDPOINT = 'https://apis.roblox.com/oauth/v1/userinfo';
export const REVOKE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token/revoke';
export const ROBLOX_ISSUER = 'https://apis.roblox.com/oauth/';
export const ROBLOX_JWKS_ENDPOINT = 'https://apis.roblox.com/oauth/v1/certs';

export const SESSION_COOKIE_NAME = 'rah_oauth_session';
export const AUTH_COOKIE_NAME = 'rah_oauth_auth';

export function getSessionSecret(): Buffer {
  const secret = process.env.ROBLOX_OAUTH_SESSION_SECRET || process.env.ROBLOX_OAUTH_CLIENT_ID || 'rah-roblox-oauth-fallback-session-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPayload(data: unknown): string {
  const key = getSessionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptPayload<T = unknown>(token?: string | null): T | null {
  if (!token) return null;
  try {
    const [ivStr, tagStr, dataStr] = token.split('.');
    if (!ivStr || !tagStr || !dataStr) return null;
    const key = getSessionSecret();
    const iv = Buffer.from(ivStr, 'base64url');
    const tag = Buffer.from(tagStr, 'base64url');
    const data = Buffer.from(dataStr, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function getCookie(req: IncomingMessage, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const c of cookies) {
    const [k, v] = c.split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return null;
}

export function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; clear?: boolean } = {}
): void {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  const parts: string[] = [
    `${name}=${encodeURIComponent(options.clear ? '' : value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProd) {
    parts.push('Secure');
  }

  if (options.clear) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  const newCookie = parts.join('; ');
  const existing = res.getHeader('Set-Cookie');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, newCookie]);
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, newCookie]);
  } else {
    res.setHeader('Set-Cookie', newCookie);
  }
}

export function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function maskClientId(clientId?: string): string {
  if (!clientId || clientId === 'ROBLOX_OAUTH_CLIENT_ID' || clientId === 'VITE_ROBLOX_OAUTH_CLIENT_ID') {
    return 'Not configured';
  }
  if (clientId.length <= 8) return '••••••••';
  return `${clientId.slice(0, 4)}••••${clientId.slice(-4)}`;
}

export function getWebOAuthConfig(req?: IncomingMessage): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = String(process.env.ROBLOX_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.ROBLOX_OAUTH_CLIENT_SECRET || '').trim();
  let redirectUri = String(process.env.ROBLOX_OAUTH_REDIRECT_URI || '').trim();

  if (!redirectUri && req) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    redirectUri = `${proto}://${host}/api/oauth/roblox/callback`;
  }

  return { clientId, clientSecret, redirectUri };
}

export function generatePkce(): { verifier: string; challenge: string; state: string; nonce: string } {
  const state = base64Url(crypto.randomBytes(32));
  const nonce = base64Url(crypto.randomBytes(32));
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { state, nonce, verifier, challenge };
}
