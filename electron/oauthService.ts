import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';

export const AUTHORIZE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/authorize';
export const TOKEN_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token';
export const USERINFO_ENDPOINT = 'https://apis.roblox.com/oauth/v1/userinfo';
export const REVOKE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token/revoke';
export const OAUTH_TIMEOUT_MS = 10 * 60 * 1000;

export type DiagnosticStatus = 'NOT CONFIGURED' | 'CHECKING' | 'PASS' | 'FAIL';

export interface OAuthUserInfo {
  sub: string;
  preferred_username?: string;
  nickname?: string;
  name?: string;
  picture?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope: string[];
}

export interface OAuthStatus {
  status: 'CONNECTED' | 'NOT CONNECTED' | 'AUTHORIZATION EXPIRED' | 'ACCESS REVOKED' | 'CONNECTION ERROR';
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
  oauthStatus?: 'PASS' | 'FAIL' | 'NOT CONFIGURED';
  tokenStatus?: 'PASS' | 'FAIL' | 'NOT CONFIGURED';
}

export interface OAuthDiagnostics {
  clientId: DiagnosticStatus;
  authorization: DiagnosticStatus;
  redirectUri: DiagnosticStatus;
  callback: DiagnosticStatus;
  tokenExchange: DiagnosticStatus;
  userInfo: DiagnosticStatus;
  tokenValidation: DiagnosticStatus;
  maskedClientId: string;
  redirectUriValue: string;
}

export interface ActiveOAuthSession {
  state: string;
  nonce: string;
  verifier: string;
  createdAt: number;
}

export function freshDiagnostics(): OAuthDiagnostics {
  return {
    clientId: 'NOT CONFIGURED',
    authorization: 'NOT CONFIGURED',
    redirectUri: 'NOT CONFIGURED',
    callback: 'NOT CONFIGURED',
    tokenExchange: 'NOT CONFIGURED',
    userInfo: 'NOT CONFIGURED',
    tokenValidation: 'NOT CONFIGURED',
    maskedClientId: 'Not configured',
    redirectUriValue: 'Not configured',
  };
}

export function loadEnv(targetDir = process.cwd()): void {
  const candidateDirs = [
    targetDir,
    path.join(targetDir, '..'),
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
  ];
  for (const dir of candidateDirs) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx <= 0) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
        break;
      } catch {}
    }
  }
}

export function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function maskClientId(clientId?: string): string {
  if (!clientId || clientId === 'ROBLOX_OAUTH_CLIENT_ID') return 'Not configured';
  if (clientId.length <= 8) return '••••••••';
  return `${clientId.slice(0, 4)}••••${clientId.slice(-4)}`;
}

export function validateClientId(clientId: string): void {
  const trimmed = (clientId || '').trim();
  if (!trimmed || trimmed === 'ROBLOX_OAUTH_CLIENT_ID') {
    throw new Error('Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID to the real Client ID.');
  }
  if (!/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) {
    throw new Error('The configured Roblox OAuth Client ID is invalid.');
  }
}

export function validateRedirectUri(redirectUri: string): URL {
  if (!redirectUri) {
    throw new Error('Roblox OAuth is not configured. Set ROBLOX_OAUTH_REDIRECT_URI.');
  }
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error('The configured Roblox OAuth redirect URI is invalid.');
  }
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Desktop OAuth redirect URI must be an HTTP loopback URL using 127.0.0.1 or localhost.');
  }
  if (!parsed.port) {
    throw new Error('Desktop OAuth redirect URI must include a fixed loopback port.');
  }
  return parsed;
}

export function getOAuthConfig(): { clientId: string; redirectUri: string } {
  const clientId = String(process.env.ROBLOX_OAUTH_CLIENT_ID || '').trim();
  const redirectUri = String(process.env.ROBLOX_OAUTH_REDIRECT_URI || '').trim() || 'http://127.0.0.1:53682/oauth/callback';
  return { clientId, redirectUri };
}

export function generatePkce(): { verifier: string; challenge: string; state: string; nonce: string } {
  const state = base64Url(crypto.randomBytes(32));
  const nonce = base64Url(crypto.randomBytes(32));
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { state, nonce, verifier, challenge };
}

export function buildAuthorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: options.clientId,
    response_type: 'code',
    redirect_uri: options.redirectUri,
    scope: 'openid profile',
    state: options.state,
    nonce: options.nonce,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export function statusFromUser(user: OAuthUserInfo, tokens: OAuthTokens, connectedAt?: string): OAuthStatus {
  const userId = Number(user.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Roblox returned an invalid user identifier.');
  }
  const username = user.preferred_username || user.nickname || user.name;
  if (!username) {
    throw new Error('Roblox user verification did not return a username.');
  }
  const now = new Date().toISOString();
  return {
    status: 'CONNECTED',
    userId,
    username,
    displayName: user.name || user.nickname || username,
    avatarUrl: user.picture,
    profileUrl: `https://www.roblox.com/users/${userId}/profile`,
    scope: tokens.scope,
    connectedAt: connectedAt || now,
    expiresAt: tokens.expiresAt,
    lastChecked: now,
    lastVerified: now,
    oauthStatus: 'PASS',
    tokenStatus: 'PASS',
  };
}

export async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const response = await fetchFn(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    const errorMsg = payload?.error_description || payload?.error || `Token exchange failed (${response.status})`;
    throw new Error(errorMsg);
  }

  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error('Roblox token response did not contain an access token.');
  }

  const expiresIn = Number(payload.expires_in);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : undefined;

  const scope = typeof payload.scope === 'string'
    ? payload.scope.split(/\s+/).filter(Boolean)
    : ['openid', 'profile'];

  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    expiresAt,
    scope,
  };
}

export async function fetchUserInfo(accessToken: string, fetchFn: typeof fetch = fetch): Promise<OAuthUserInfo> {
  const response = await fetchFn(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok || !payload) {
    throw new Error(`Roblox userinfo request failed (${response.status})`);
  }

  if (!payload.sub) {
    throw new Error('Roblox userinfo did not contain a user identifier (sub).');
  }

  return payload as OAuthUserInfo;
}

export async function revokeToken(token: string, clientId: string, fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    await fetchFn(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: clientId }),
    });
  } catch {}
}

export class ElectronOAuthManager {
  private activeSession: ActiveOAuthSession | null = null;
  private callbackServer: http.Server | null = null;
  private tokens: OAuthTokens | null = null;
  private status: OAuthStatus = { status: 'NOT CONNECTED' };
  private diagnostics: OAuthDiagnostics = freshDiagnostics();
  private onResultCallback?: (result: { status?: OAuthStatus; error?: string }) => void;

  constructor() {
    this.refreshConfigDiagnostics();
  }

  public setOnResult(cb: (result: { status?: OAuthStatus; error?: string }) => void): void {
    this.onResultCallback = cb;
  }

  public getDiagnostics(): OAuthDiagnostics {
    return { ...this.diagnostics };
  }

  public getStatus(): OAuthStatus {
    return { ...this.status };
  }

  public refreshConfigDiagnostics(): void {
    const { clientId, redirectUri } = getOAuthConfig();
    let isClientIdValid = false;
    try {
      validateClientId(clientId);
      isClientIdValid = true;
    } catch {
      isClientIdValid = false;
    }

    let isRedirectValid = false;
    try {
      validateRedirectUri(redirectUri);
      isRedirectValid = true;
    } catch {
      isRedirectValid = false;
    }

    this.diagnostics.clientId = isClientIdValid ? 'PASS' : 'NOT CONFIGURED';
    this.diagnostics.authorization = isClientIdValid ? 'PASS' : 'NOT CONFIGURED';
    this.diagnostics.maskedClientId = maskClientId(clientId);
    this.diagnostics.redirectUri = isRedirectValid ? 'PASS' : (redirectUri ? 'FAIL' : 'NOT CONFIGURED');
    this.diagnostics.redirectUriValue = redirectUri || 'Not configured';
  }

  public printStartupDiagnostics(): void {
    loadEnv();
    const { clientId, redirectUri } = getOAuthConfig();
    let isClientIdConfigured = false;
    try {
      validateClientId(clientId);
      isClientIdConfigured = true;
    } catch {
      isClientIdConfigured = false;
    }

    let isRedirectUriConfigured = false;
    try {
      validateRedirectUri(redirectUri);
      isRedirectUriConfigured = true;
    } catch {
      isRedirectUriConfigured = false;
    }

    console.log(`Roblox OAuth Client ID: ${isClientIdConfigured ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`Redirect URI: ${isRedirectUriConfigured ? 'CONFIGURED' : 'MISSING'}`);
    console.log(`OAuth callback listener: ${isRedirectUriConfigured ? 'READY' : 'NOT READY'}`);

    if (!isClientIdConfigured) {
      console.error(
        'Configuration Error: Roblox OAuth Client ID is missing or invalid. Set ROBLOX_OAUTH_CLIENT_ID in your environment or .env file to your real Roblox Client ID.'
      );
    }
  }

  public closeCallbackServer(): void {
    if (this.callbackServer) {
      try {
        this.callbackServer.close();
      } catch {}
      this.callbackServer = null;
    }
    this.activeSession = null;
  }

  public async startOAuth(openExternalFn?: (url: string) => Promise<void>): Promise<{ authorizationUrl?: string; error?: string }> {
    try {
      loadEnv();
      this.refreshConfigDiagnostics();
      const { clientId, redirectUri } = getOAuthConfig();
      validateClientId(clientId);
      const redirect = validateRedirectUri(redirectUri);

      this.closeCallbackServer();

      const pkce = generatePkce();
      this.activeSession = {
        state: pkce.state,
        nonce: pkce.nonce,
        verifier: pkce.verifier,
        createdAt: Date.now(),
      };

      const authorizationUrl = buildAuthorizationUrl({
        clientId,
        redirectUri,
        state: pkce.state,
        nonce: pkce.nonce,
        challenge: pkce.challenge,
      });

      this.diagnostics.authorization = 'PASS';
      this.diagnostics.callback = 'CHECKING';
      this.diagnostics.tokenExchange = 'NOT CONFIGURED';
      this.diagnostics.userInfo = 'NOT CONFIGURED';
      this.diagnostics.tokenValidation = 'NOT CONFIGURED';

      await new Promise<void>((resolve, reject) => {
        this.callbackServer = http.createServer(async (req, res) => {
          await this.handleCallbackRequest(req, res, clientId, redirectUri, redirect.pathname);
        });

        this.callbackServer.once('error', (err) => {
          this.diagnostics.callback = 'FAIL';
          reject(new Error(`Failed to bind callback server on port ${redirect.port}: ${err.message}`));
        });

        this.callbackServer.listen(Number(redirect.port), redirect.hostname, () => {
          resolve();
        });
      });

      if (openExternalFn) {
        await openExternalFn(authorizationUrl);
      }

      return { authorizationUrl };
    } catch (err: any) {
      this.diagnostics.authorization = 'FAIL';
      this.closeCallbackServer();
      return { error: err?.message || 'Failed to start OAuth flow' };
    }
  }

  public async handleCallbackRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    clientId: string,
    redirectUri: string,
    expectedPathname: string
  ): Promise<void> {
    const callback = new URL(req.url || '/', redirectUri);
    if (callback.pathname !== expectedPathname) {
      res.writeHead(404).end('Not found');
      return;
    }

    const respond = (message: string, success: boolean) => {
      res.writeHead(success ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<html><body style="font-family:sans-serif;background:#090a0f;color:#fff;padding:40px"><h2>${
          success ? 'Roblox connected' : 'Roblox connection failed'
        }</h2><p>${message}</p><p>You can close this window.</p></body></html>`
      );
    };

    try {
      const returnedState = callback.searchParams.get('state');
      const errorParam = callback.searchParams.get('error');
      if (errorParam) {
        this.diagnostics.callback = 'FAIL';
        throw new Error(callback.searchParams.get('error_description') || `Roblox authorization failed: ${errorParam}`);
      }

      if (!this.activeSession) {
        this.diagnostics.callback = 'FAIL';
        throw new Error('No active OAuth session found.');
      }

      if (Date.now() - this.activeSession.createdAt > OAUTH_TIMEOUT_MS) {
        this.diagnostics.callback = 'FAIL';
        throw new Error('OAuth authorization request timed out.');
      }

      if (!returnedState || returnedState !== this.activeSession.state) {
        this.diagnostics.callback = 'FAIL';
        throw new Error('OAuth state validation failed.');
      }

      const code = callback.searchParams.get('code');
      if (!code) {
        this.diagnostics.callback = 'FAIL';
        throw new Error('Roblox callback did not contain an authorization code.');
      }

      this.diagnostics.callback = 'PASS';
      this.diagnostics.tokenExchange = 'CHECKING';

      const verifier = this.activeSession.verifier;
      const tokens = await exchangeCode(code, verifier, clientId, redirectUri);
      this.diagnostics.tokenExchange = 'PASS';
      this.diagnostics.userInfo = 'CHECKING';

      const user = await fetchUserInfo(tokens.accessToken);
      this.diagnostics.userInfo = 'PASS';
      this.diagnostics.tokenValidation = 'CHECKING';

      const status = statusFromUser(user, tokens);
      this.diagnostics.tokenValidation = 'PASS';

      this.tokens = tokens;
      this.status = status;

      respond('Your Roblox account was successfully connected and verified.', true);
      this.closeCallbackServer();
      this.onResultCallback?.({ status: this.status });
    } catch (err: any) {
      const errorMsg = err?.message || 'Connection failed.';
      this.status = {
        status: 'CONNECTION ERROR',
        lastChecked: new Date().toISOString(),
        oauthStatus: 'FAIL',
        tokenStatus: 'FAIL',
      };
      respond(errorMsg, false);
      this.closeCallbackServer();
      this.onResultCallback?.({ status: this.status, error: errorMsg });
    }
  }

  public async checkOAuth(): Promise<OAuthStatus> {
    if (!this.tokens?.accessToken) {
      this.status = { status: 'NOT CONNECTED', lastChecked: new Date().toISOString() };
      return this.status;
    }
    this.diagnostics.tokenValidation = 'CHECKING';
    try {
      const user = await fetchUserInfo(this.tokens.accessToken);
      this.status = statusFromUser(user, this.tokens, this.status.connectedAt);
      this.diagnostics.tokenValidation = 'PASS';
      return this.status;
    } catch {
      this.diagnostics.tokenValidation = 'FAIL';
      this.tokens = null;
      this.status = { status: 'ACCESS REVOKED', lastChecked: new Date().toISOString() };
      return this.status;
    }
  }

  public async disconnectOAuth(): Promise<void> {
    this.closeCallbackServer();
    if (this.tokens?.accessToken) {
      const { clientId } = getOAuthConfig();
      await revokeToken(this.tokens.accessToken, clientId);
      if (this.tokens.refreshToken) {
        await revokeToken(this.tokens.refreshToken, clientId);
      }
    }
    this.tokens = null;
    this.status = { status: 'NOT CONNECTED', lastChecked: new Date().toISOString() };
    this.refreshConfigDiagnostics();
    this.diagnostics.callback = 'NOT CONFIGURED';
    this.diagnostics.tokenExchange = 'NOT CONFIGURED';
    this.diagnostics.userInfo = 'NOT CONFIGURED';
    this.diagnostics.tokenValidation = 'NOT CONFIGURED';
  }
}
