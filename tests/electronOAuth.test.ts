import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import {
  validateClientId,
  validateRedirectUri,
  generatePkce,
  buildAuthorizationUrl,
  maskClientId,
  exchangeCode,
  fetchUserInfo,
  statusFromUser,
  revokeToken,
  ElectronOAuthManager,
  freshDiagnostics,
  AUTHORIZE_ENDPOINT,
  TOKEN_ENDPOINT,
  USERINFO_ENDPOINT,
  REVOKE_ENDPOINT,
} from '../electron/oauthService';

describe('Electron OAuth Implementation Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Configuration Validation', () => {
    it('rejects empty or missing client ID', () => {
      expect(() => validateClientId('')).toThrow('Roblox OAuth is not configured');
      expect(() => validateClientId('   ')).toThrow('Roblox OAuth is not configured');
    });

    it('rejects the literal string placeholder ROBLOX_OAUTH_CLIENT_ID', () => {
      expect(() => validateClientId('ROBLOX_OAUTH_CLIENT_ID')).toThrow(
        'Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID to the real Client ID.'
      );
    });

    it('rejects invalid client ID patterns', () => {
      expect(() => validateClientId('abc')).toThrow('The configured Roblox OAuth Client ID is invalid.');
      expect(() => validateClientId('client with spaces')).toThrow('The configured Roblox OAuth Client ID is invalid.');
    });

    it('accepts valid alphanumeric client IDs', () => {
      expect(() => validateClientId('1234567890123456')).not.toThrow();
      expect(() => validateClientId('valid_client-id-123')).not.toThrow();
    });

    it('masks client ID without leaking full secret credentials', () => {
      expect(maskClientId(undefined)).toBe('Not configured');
      expect(maskClientId('ROBLOX_OAUTH_CLIENT_ID')).toBe('Not configured');
      expect(maskClientId('12345678')).toBe('••••••••');
      expect(maskClientId('1234567890123456')).toBe('1234••••3456');
    });

    it('validates loopback redirect URIs strictly', () => {
      expect(() => validateRedirectUri('')).toThrow('Roblox OAuth is not configured');
      expect(() => validateRedirectUri('https://example.com/oauth')).toThrow('Desktop OAuth redirect URI must be an HTTP loopback URL');
      expect(() => validateRedirectUri('http://127.0.0.1')).toThrow('must include a fixed loopback port');
      expect(() => validateRedirectUri('http://localhost')).toThrow('must include a fixed loopback port');

      const parsed = validateRedirectUri('http://127.0.0.1:53682/oauth/callback');
      expect(parsed.hostname).toBe('127.0.0.1');
      expect(parsed.port).toBe('53682');
      expect(parsed.pathname).toBe('/oauth/callback');

      const parsedLocalhost = validateRedirectUri('http://localhost:53682/oauth/callback');
      expect(parsedLocalhost.hostname).toBe('localhost');
    });
  });

  describe('PKCE and Authorization Parameters', () => {
    it('generates secure PKCE parameters including S256 challenge, verifier, state, and nonce', () => {
      const pkce = generatePkce();

      expect(pkce.verifier).toBeDefined();
      expect(pkce.challenge).toBeDefined();
      expect(pkce.state).toBeDefined();
      expect(pkce.nonce).toBeDefined();

      // Verify S256 challenge calculation matches verifier
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(pkce.verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      expect(pkce.challenge).toBe(expectedChallenge);
      expect(pkce.state.length).toBeGreaterThanOrEqual(32);
      expect(pkce.nonce.length).toBeGreaterThanOrEqual(32);
    });

    it('builds an authorization URL with all required OpenID and PKCE parameters', () => {
      const authUrl = buildAuthorizationUrl({
        clientId: 'test-client-12345',
        redirectUri: 'http://127.0.0.1:53682/oauth/callback',
        state: 'test-state-abc',
        nonce: 'test-nonce-xyz',
        challenge: 'test-challenge-123',
      });

      const parsed = new URL(authUrl);
      expect(parsed.origin + parsed.pathname).toBe(AUTHORIZE_ENDPOINT);
      expect(parsed.searchParams.get('client_id')).toBe('test-client-12345');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:53682/oauth/callback');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid profile');
      expect(parsed.searchParams.get('state')).toBe('test-state-abc');
      expect(parsed.searchParams.get('nonce')).toBe('test-nonce-xyz');
      expect(parsed.searchParams.get('code_challenge')).toBe('test-challenge-123');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  describe('Token Exchange and User Verification', () => {
    it('exchanges code for tokens with Roblox token endpoint', async () => {
      const mockTokens = {
        access_token: 'mock-access-token-123',
        refresh_token: 'mock-refresh-token-456',
        expires_in: 3600,
        scope: 'openid profile',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTokens,
      });

      const result = await exchangeCode(
        'mock-auth-code',
        'mock-verifier',
        'my-client-id',
        'http://127.0.0.1:53682/oauth/callback',
        fetchMock as any
      );

      expect(fetchMock).toHaveBeenCalledWith(
        TOKEN_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      expect(result.accessToken).toBe('mock-access-token-123');
      expect(result.refreshToken).toBe('mock-refresh-token-456');
      expect(result.scope).toEqual(['openid', 'profile']);
      expect(result.expiresAt).toBeDefined();
    });

    it('fails token exchange when Roblox returns an error', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'Code has expired' }),
      });

      await expect(
        exchangeCode(
          'bad-code',
          'mock-verifier',
          'my-client-id',
          'http://127.0.0.1:53682/oauth/callback',
          fetchMock as any
        )
      ).rejects.toThrow('Code has expired');
    });

    it('fetches userinfo and validates required OpenID profile claims', async () => {
      const mockUserInfo = {
        sub: '123456789',
        name: 'RobloxianTester',
        preferred_username: 'RobloxianTester',
        nickname: 'Tester',
        picture: 'https://images.rbxcdn.com/avatar.png',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUserInfo,
      });

      const user = await fetchUserInfo('mock-access-token', fetchMock as any);
      expect(fetchMock).toHaveBeenCalledWith(
        USERINFO_ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );
      expect(user.sub).toBe('123456789');
      expect(user.preferred_username).toBe('RobloxianTester');
    });

    it('constructs authenticated identity using Roblox user ID as primary identifier', () => {
      const user = {
        sub: '987654321',
        preferred_username: 'RobloxPlayer',
        nickname: 'DisplayPlayer',
        picture: 'https://tr.rbxcdn.com/avatar.png',
      };
      const tokens = {
        accessToken: 'access-token',
        scope: ['openid', 'profile'],
      };

      const status = statusFromUser(user, tokens);
      expect(status.status).toBe('CONNECTED');
      expect(status.userId).toBe(987654321);
      expect(status.username).toBe('RobloxPlayer');
      expect(status.displayName).toBe('DisplayPlayer');
      expect(status.profileUrl).toBe('https://www.roblox.com/users/987654321/profile');
      expect(status.avatarUrl).toBe('https://tr.rbxcdn.com/avatar.png');
      expect(status.oauthStatus).toBe('PASS');
      expect(status.tokenStatus).toBe('PASS');
    });

    it('rejects userinfo with invalid or non-numeric sub', () => {
      const user = {
        sub: 'not-a-number',
        preferred_username: 'RobloxPlayer',
      };
      const tokens = { accessToken: 'access', scope: ['openid'] };

      expect(() => statusFromUser(user as any, tokens)).toThrow('Roblox returned an invalid user identifier.');
    });
  });

  describe('Revocation and Security', () => {
    it('calls token revoke endpoint with refresh token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      await revokeToken('refresh-token-123', 'client-id-123', fetchMock as any);

      expect(fetchMock).toHaveBeenCalledWith(
        REVOKE_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('never exposes sensitive tokens in diagnostics', () => {
      const diag = freshDiagnostics();
      const serialized = JSON.stringify(diag);

      expect(serialized).not.toContain('access_token');
      expect(serialized).not.toContain('refresh_token');
      expect(serialized).not.toContain('client_secret');
      expect(serialized).not.toContain('verifier');
    });
  });

  describe('ElectronOAuthManager Lifecycle', () => {
    it('initializes in NOT CONFIGURED state when no client ID exists', () => {
      delete process.env.ROBLOX_OAUTH_CLIENT_ID;
      const manager = new ElectronOAuthManager();
      const diag = manager.getDiagnostics();

      expect(diag.clientId).toBe('NOT CONFIGURED');
      expect(diag.authorization).toBe('NOT CONFIGURED');
      expect(diag.callback).toBe('NOT CONFIGURED');
      expect(diag.tokenExchange).toBe('NOT CONFIGURED');
      expect(diag.userInfo).toBe('NOT CONFIGURED');
      expect(diag.tokenValidation).toBe('NOT CONFIGURED');
      expect(manager.getStatus().status).toBe('NOT CONNECTED');
    });

    it('sets clientId and authorization to PASS when valid client ID is set', () => {
      process.env.ROBLOX_OAUTH_CLIENT_ID = 'valid_client_id_1234';
      process.env.ROBLOX_OAUTH_REDIRECT_URI = 'http://127.0.0.1:53682/oauth/callback';

      const manager = new ElectronOAuthManager();
      const diag = manager.getDiagnostics();

      expect(diag.clientId).toBe('PASS');
      expect(diag.authorization).toBe('PASS');
      expect(diag.redirectUri).toBe('PASS');
      expect(diag.maskedClientId).toContain('••••');
    });

    it('fails startOAuth when client ID is missing', async () => {
      delete process.env.ROBLOX_OAUTH_CLIENT_ID;
      const manager = new ElectronOAuthManager();
      const result = await manager.startOAuth();

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Roblox OAuth is not configured');
      expect(manager.getDiagnostics().authorization).toBe('FAIL');
    });

    it('handles callback rejection when state does not match', async () => {
      process.env.ROBLOX_OAUTH_CLIENT_ID = 'valid_client_id_1234';
      const manager = new ElectronOAuthManager();

      const resHeaders: Record<string, string> = {};
      let responseBody = '';
      let responseStatus = 0;

      const mockRes: any = {
        writeHead: vi.fn((status: number, headers: any) => {
          responseStatus = status;
          Object.assign(resHeaders, headers);
        }),
        end: vi.fn((body: string) => {
          responseBody = body;
        }),
      };

      const mockReq: any = {
        url: '/oauth/callback?state=wrong-state&code=test-code',
      };

      await manager.handleCallbackRequest(
        mockReq,
        mockRes,
        'valid_client_id_1234',
        'http://127.0.0.1:53682/oauth/callback',
        '/oauth/callback'
      );

      expect(responseStatus).toBe(400);
      expect(responseBody).toContain('Roblox connection failed');
      expect(manager.getStatus().status).toBe('CONNECTION ERROR');
      expect(manager.getDiagnostics().callback).toBe('FAIL');
    });

    it('disconnects and clears all credentials and status', async () => {
      process.env.ROBLOX_OAUTH_CLIENT_ID = 'valid_client_id_1234';
      const manager = new ElectronOAuthManager();
      await manager.disconnectOAuth();

      expect(manager.getStatus().status).toBe('NOT CONNECTED');
      expect(manager.getDiagnostics().callback).toBe('NOT CONFIGURED');
      expect(manager.getDiagnostics().tokenExchange).toBe('NOT CONFIGURED');
    });
  });
});
