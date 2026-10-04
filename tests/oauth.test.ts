import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { NetworkClient } from '../src/services/networkClient';
import { RobloxAuthorizationService } from '../src/services/robloxAuthorizationService';
import type { OAuthDiagnostics, RobloxAuthStatus } from '../src/types/roblox';

const AUTH_KEY = 'rah_official_auth_status_v1';
type ExpectedDiagnosticStatus = 'PASS' | 'FAIL' | 'NOT CONFIGURED' | 'CHECKING';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, String(value))),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
  };
};

const jsonResponse = (status: number, data: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
});

const installBrowser = (electronAPI?: Record<string, unknown>) => {
  const location = {
    href: 'http://localhost/callback',
    origin: 'http://localhost',
    assign: vi.fn(),
  };
  const windowValue = { electronAPI, location, open: vi.fn() };
  vi.stubGlobal('window', windowValue);
  vi.stubGlobal('document', { title: 'Account Hub' });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  return windowValue;
};

describe('OAuth browser and Electron facades', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorage());
    installBrowser();
  });

  it('routes network requests through the Electron bridge and serializes object bodies', async () => {
    const robloxFetch = vi.fn().mockResolvedValue({ status: 200, ok: true, data: { id: 1 }, headers: {} });
    installBrowser({ robloxFetch });

    await expect(NetworkClient.request('https://users.roblox.com/v1/users/1', {
      method: 'POST', headers: { 'X-Test': 'yes' }, body: { enabled: true },
    })).resolves.toMatchObject({ status: 200, ok: true, data: { id: 1 } });

    expect(robloxFetch).toHaveBeenCalledWith('https://users.roblox.com/v1/users/1', {
      method: 'POST', headers: { 'X-Test': 'yes' }, body: JSON.stringify({ enabled: true }),
    });
  });

  it('uses browser fetch when no Electron bridge exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { name: 'Builderman' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(NetworkClient.request('https://users.roblox.com/v1/users/1')).resolves.toMatchObject({
      status: 200, ok: true, data: { name: 'Builderman' },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('https://users.roblox.com/v1/users/1'));
  });

  it('navigates to the server OAuth facade without claiming connection', async () => {
    const browser = installBrowser();

    await expect(RobloxAuthorizationService.initiateOAuthFlow()).resolves.toEqual(expect.any(String));
    expect(browser.location.assign).toHaveBeenCalledOnce();
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
  });

  it('delegates start, status checks, diagnostics, and normalized result events to Electron', async () => {
    let bridgeListener: ((result: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    const onRobloxOAuthResult = vi.fn((listener: (result: unknown) => void) => {
      bridgeListener = listener;
      return unsubscribe;
    });
    const startRobloxOAuth = vi.fn().mockResolvedValue({ authorizationUrl: 'https://apis.roblox.com/oauth/v1/authorize?state=abc' });
    const checkRobloxOAuth = vi.fn().mockResolvedValue({ status: 'ACCESS REVOKED', tokenStatus: 'FAIL' });
    const getRobloxOAuthDiagnostics = vi.fn().mockResolvedValue({ callback: 'CHECKING' });
    installBrowser({ onRobloxOAuthResult, startRobloxOAuth, checkRobloxOAuth, getRobloxOAuthDiagnostics });

    const listener = vi.fn();
    expect(RobloxAuthorizationService.onOAuthResult(listener)).toBe(unsubscribe);
    bridgeListener?.({ status: { status: 'CONNECTED', userId: '123456', username: 'VerifiedUser' } });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      status: expect.objectContaining({ status: 'CONNECTED', userId: 123456, username: 'VerifiedUser' }),
    }));
    expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toMatchObject({ status: 'CONNECTED', userId: 123456 });

    await expect(RobloxAuthorizationService.initiateOAuthFlow()).resolves.toContain('authorize');
    await expect(RobloxAuthorizationService.checkStatus()).resolves.toMatchObject({ status: 'ACCESS REVOKED' });
    await expect(RobloxAuthorizationService.getDiagnostics()).resolves.toMatchObject({ callback: 'CHECKING' });
  });

  it('rejects invalid connected results from Electron rather than persisting them', () => {
    let bridgeListener: ((result: unknown) => void) | undefined;
    installBrowser({
      onRobloxOAuthResult: (listener: (result: unknown) => void) => {
        bridgeListener = listener;
        return vi.fn();
      },
    });
    const listener = vi.fn();
    RobloxAuthorizationService.onOAuthResult(listener);

    bridgeListener?.({ status: { status: 'CONNECTED', username: 'MissingId' } });
    expect(listener).toHaveBeenCalledWith({ error: expect.stringMatching(/identifier/i) });
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('propagates an Electron OAuth start error without marking the account connected', async () => {
    installBrowser({ startRobloxOAuth: vi.fn().mockResolvedValue({ error: 'Browser launch failed' }) });
    await expect(RobloxAuthorizationService.initiateOAuthFlow()).rejects.toThrow('Browser launch failed');
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
  });
});

describe('OAuth callback and status handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorage());
    installBrowser();
  });

  it('does not report CONNECTED before callback status verification completes', async () => {
    let resolveStatus!: (value: ReturnType<typeof jsonResponse>) => void;
    const pendingStatus = new Promise<ReturnType<typeof jsonResponse>>(resolve => { resolveStatus = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => pendingStatus));

    const callback = RobloxAuthorizationService.handleWebCallback(
      'http://localhost/callback?roblox_oauth=success&keep=this#section',
    );
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();

    resolveStatus(jsonResponse(200, {
      status: 'CONNECTED', userId: 123456, username: 'VerifiedUser', displayName: 'Verified User',
    }));
    await expect(callback).resolves.toMatchObject({ status: 'CONNECTED', userId: 123456 });
    expect(JSON.parse(localStorage.getItem(AUTH_KEY)!)).toMatchObject({ status: 'CONNECTED', userId: 123456 });
    expect(history.replaceState).toHaveBeenCalledWith({}, 'Account Hub', '/callback?keep=this#section');
  });

  it('returns null for an ordinary URL and does not request status', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(RobloxAuthorizationService.handleWebCallback('http://localhost/dashboard?tab=profile')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces callback errors and strips OAuth query data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'NOT CONNECTED' })));

    await expect(RobloxAuthorizationService.handleWebCallback(
      'http://localhost/callback?roblox_oauth=failed&oauth_error=User%20cancelled&keep=this',
    )).rejects.toThrow('User cancelled');
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
    expect(history.replaceState).toHaveBeenCalledWith({}, 'Account Hub', '/callback?keep=this');
  });

  it('refuses a server CONNECTED response without verified identity fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'CONNECTED', username: 'MissingId' })));

    await expect(RobloxAuthorizationService.checkStatus()).rejects.toThrow(/identifier/i);
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('normalizes non-connected status and removes stale identity fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
      status: 'ACCESS REVOKED', userId: 123456, username: 'StaleUser', displayName: 'Stale User', tokenStatus: 'FAIL',
    })));

    await expect(RobloxAuthorizationService.checkStatus()).resolves.toEqual(expect.objectContaining({
      status: 'ACCESS REVOKED', tokenStatus: 'FAIL',
    }));
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY)!);
    expect(stored).not.toHaveProperty('userId');
    expect(stored).not.toHaveProperty('username');
  });

  it('accepts diagnostics CHECKING as a typed lifecycle state', async () => {
    expectTypeOf<OAuthDiagnostics['callback']>().toEqualTypeOf<ExpectedDiagnosticStatus>();
    const diagnostics: OAuthDiagnostics = {
      clientId: 'PASS', authorization: 'PASS', redirectUri: 'PASS', callback: 'CHECKING',
      tokenExchange: 'NOT CONFIGURED', userInfo: 'NOT CONFIGURED', tokenValidation: 'NOT CONFIGURED',
      maskedClientId: 'clie••••2345', redirectUriValue: 'http://localhost/callback',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, diagnostics)));

    await expect(RobloxAuthorizationService.getDiagnostics()).resolves.toEqual(diagnostics);
  });
});
