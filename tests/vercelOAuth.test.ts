import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encryptPayload,
  decryptPayload,
  getCookie,
  setCookie,
  SESSION_COOKIE_NAME,
  AUTH_COOKIE_NAME,
} from '../api/_lib/oauth';
import diagnosticsHandler from '../api/oauth/roblox/diagnostics';
import startHandler from '../api/oauth/roblox/start';
import statusHandler from '../api/oauth/roblox/status';
import disconnectHandler from '../api/oauth/roblox/disconnect';

describe('Vercel OAuth Handlers Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Cookie Encryption and Security', () => {
    it('encrypts and decrypts session data with AES-256-GCM', () => {
      const data = { state: 'test-state-123', verifier: 'verifier-456', nonce: 'nonce-789' };
      const encrypted = encryptPayload(data);

      expect(encrypted).toBeTypeOf('string');
      expect(encrypted).not.toContain('test-state-123');

      const decrypted = decryptPayload<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('returns null when decrypting corrupted or tampered ciphertext', () => {
      expect(decryptPayload('invalid.token.here')).toBeNull();
      expect(decryptPayload('')).toBeNull();
    });

    it('extracts named cookies from request headers', () => {
      const req: any = {
        headers: {
          cookie: 'other=123; rah_oauth_session=my-session-token; tracking=xyz',
        },
      };
      expect(getCookie(req, 'rah_oauth_session')).toBe('my-session-token');
      expect(getCookie(req, 'missing')).toBeNull();
    });

    it('sets HttpOnly, SameSite=Lax, and Secure cookie headers', () => {
      process.env.NODE_ENV = 'production';
      const headers: Record<string, any> = {};
      const res: any = {
        getHeader: (k: string) => headers[k],
        setHeader: (k: string, v: any) => {
          headers[k] = v;
        },
      };

      setCookie(res, SESSION_COOKIE_NAME, 'sample-token', { maxAgeSeconds: 600 });
      const cookieVal = headers['Set-Cookie'];

      expect(cookieVal).toContain(`${SESSION_COOKIE_NAME}=sample-token`);
      expect(cookieVal).toContain('HttpOnly');
      expect(cookieVal).toContain('SameSite=Lax');
      expect(cookieVal).toContain('Secure');
      expect(cookieVal).toContain('Max-Age=600');
    });
  });

  describe('Diagnostics Handler', () => {
    it('returns NOT CONFIGURED when ROBLOX_OAUTH_CLIENT_ID is unset', () => {
      delete process.env.ROBLOX_OAUTH_CLIENT_ID;
      let output = '';
      const res: any = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = { headers: { host: 'localhost:3000' } };

      diagnosticsHandler(req, res);
      const parsed = JSON.parse(output);

      expect(parsed.clientId).toBe('NOT CONFIGURED');
      expect(parsed.authorization).toBe('NOT CONFIGURED');
    });

    it('returns PASS when ROBLOX_OAUTH_CLIENT_ID is set', () => {
      process.env.ROBLOX_OAUTH_CLIENT_ID = '123456789012';
      let output = '';
      const res: any = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = { headers: { host: 'myapp.vercel.app' } };

      diagnosticsHandler(req, res);
      const parsed = JSON.parse(output);

      expect(parsed.clientId).toBe('PASS');
      expect(parsed.authorization).toBe('PASS');
      expect(parsed.maskedClientId).toBe('1234••••9012');
    });
  });

  describe('Start Handler', () => {
    it('rejects with 400 when client ID is missing', () => {
      delete process.env.ROBLOX_OAUTH_CLIENT_ID;
      let output = '';
      const res: any = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = { headers: { host: 'localhost:3000' } };

      startHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(output).toContain('Roblox OAuth is not configured');
    });

    it('sets session cookie and redirects to Roblox authorize endpoint with PKCE parameters', () => {
      process.env.ROBLOX_OAUTH_CLIENT_ID = '123456789012';
      const headers: Record<string, any> = {};
      const res: any = {
        statusCode: 0,
        getHeader: (k: string) => headers[k],
        setHeader: (k: string, v: any) => {
          headers[k] = v;
        },
        end: vi.fn(),
      };
      const req: any = { headers: { host: 'myapp.vercel.app' } };

      startHandler(req, res);
      expect(res.statusCode).toBe(302);
      expect(headers['Location']).toContain('https://apis.roblox.com/oauth/v1/authorize');
      expect(headers['Location']).toContain('code_challenge_method=S256');
      expect(headers['Location']).toContain('nonce=');
      expect(headers['Set-Cookie']).toContain(SESSION_COOKIE_NAME);
    });
  });

  describe('Status and Disconnect Handlers', () => {
    it('returns NOT CONNECTED when no auth cookie is present', () => {
      let output = '';
      const res: any = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = { headers: {} };

      statusHandler(req, res);
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('NOT CONNECTED');
    });

    it('returns authenticated user identity without exposing access tokens', () => {
      const authCookie = encryptPayload({
        status: 'CONNECTED',
        userId: 123456,
        username: 'RobloxTester',
        displayName: 'Tester',
        accessToken: 'sensitive-access-token-secret',
        refreshToken: 'sensitive-refresh-token-secret',
      });

      let output = '';
      const res: any = {
        statusCode: 0,
        setHeader: vi.fn(),
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${authCookie}` },
      };

      statusHandler(req, res);
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('CONNECTED');
      expect(parsed.userId).toBe(123456);
      expect(parsed.username).toBe('RobloxTester');
      expect(output).not.toContain('sensitive-access-token-secret');
      expect(output).not.toContain('sensitive-refresh-token-secret');
    });

    it('clears auth cookie and returns NOT CONNECTED on disconnect', async () => {
      const headers: Record<string, any> = {};
      let output = '';
      const res: any = {
        statusCode: 0,
        getHeader: (k: string) => headers[k],
        setHeader: (k: string, v: any) => {
          headers[k] = v;
        },
        end: vi.fn((body: string) => {
          output = body;
        }),
      };
      const req: any = { headers: {} };

      await disconnectHandler(req, res);
      expect(headers['Set-Cookie']).toContain('Max-Age=0');
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('NOT CONNECTED');
    });
  });
});
