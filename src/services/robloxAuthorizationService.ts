import { StorageService } from './storageService';
import { OAuthDiagnostics, RobloxAuthStatus } from '../types/roblox';

const WEB_OAUTH_START_ENDPOINT = '/api/oauth/roblox/start';
const WEB_OAUTH_STATUS_ENDPOINT = '/api/oauth/roblox/status';
const WEB_OAUTH_DIAGNOSTICS_ENDPOINT = '/api/oauth/roblox/diagnostics';
const WEB_OAUTH_DISCONNECT_ENDPOINT = '/api/oauth/roblox/disconnect';

const electronApi = () => typeof window !== 'undefined' ? (window as any).electronAPI : undefined;

const disconnectedStatus = (): RobloxAuthStatus => ({
  status: 'NOT CONNECTED',
  lastChecked: new Date().toISOString(),
});

const defaultDiagnostics = (): OAuthDiagnostics => ({
  clientId: 'NOT CONFIGURED',
  authorization: 'NOT CONFIGURED',
  redirectUri: 'NOT CONFIGURED',
  callback: 'NOT CONFIGURED',
  tokenExchange: 'NOT CONFIGURED',
  userInfo: 'NOT CONFIGURED',
  tokenValidation: 'NOT CONFIGURED',
  maskedClientId: 'Not configured',
  redirectUriValue: 'Not configured',
});

const asRecord = (value: unknown): Record<string, any> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;

const normalizeStatus = (payload: unknown): RobloxAuthStatus => {
  const body = asRecord(payload);
  if (!body) throw new Error('The authorization service returned an invalid status response.');

  const nestedStatus = asRecord(body.status);
  const candidate = asRecord(body.authStatus) || nestedStatus || body;
  const rawStatus = typeof candidate.status === 'string'
    ? candidate.status
    : typeof body.status === 'string'
      ? body.status
      : undefined;
  const allowedStatuses = new Set([
    'CONNECTED',
    'NOT CONNECTED',
    'AUTHORIZATION EXPIRED',
    'ACCESS REVOKED',
    'CONNECTION ERROR',
  ]);
  if (!rawStatus || !allowedStatuses.has(rawStatus)) {
    throw new Error('The authorization service returned an invalid connection status.');
  }

  const normalized: RobloxAuthStatus = {
    ...candidate,
    status: rawStatus as RobloxAuthStatus['status'],
    lastChecked: typeof candidate.lastChecked === 'string'
      ? candidate.lastChecked
      : new Date().toISOString(),
  };

  if (rawStatus === 'CONNECTED') {
    const userId = Number(candidate.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error('The authorization service returned an invalid Roblox user identifier.');
    }
    if (typeof candidate.username !== 'string' || !candidate.username.trim()) {
      throw new Error('The authorization service did not return a verified Roblox username.');
    }
    normalized.userId = userId;
    normalized.username = candidate.username;
  } else {
    delete normalized.userId;
    delete normalized.username;
    delete normalized.displayName;
    delete normalized.avatarUrl;
    delete normalized.profileUrl;
    delete normalized.scope;
    delete normalized.connectedAt;
    delete normalized.expiresAt;
    delete normalized.lastVerified;
  }

  return normalized;
};

const requestJson = async (url: string, options: RequestInit = {}): Promise<unknown> => {
  const fullUrl = typeof window !== 'undefined' && window.location?.origin
    ? new URL(url, window.location.origin).toString()
    : url;
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const record = asRecord(body);
    const message = typeof record?.error === 'string'
      ? record.error
      : typeof record?.message === 'string'
        ? record.message
        : `Authorization service request failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
};

const cleanOAuthCallbackQuery = (url: URL): void => {
  const callbackKeys = [
    'oauth',
    'oauth_status',
    'oauth_error',
    'roblox_oauth',
    'roblox_oauth_status',
    'roblox_oauth_error',
    'error',
    'error_description',
    'code',
    'state',
  ];
  callbackKeys.forEach(key => url.searchParams.delete(key));
  const search = url.searchParams.toString();
  if (typeof history !== 'undefined' && typeof document !== 'undefined' && history.replaceState) {
    history.replaceState({}, document.title, `${url.pathname}${search ? `?${search}` : ''}${url.hash}`);
  }
};

const getCallbackResult = (url: URL): { present: boolean; error?: string } => {
  const statusValue = url.searchParams.get('roblox_oauth')
    || url.searchParams.get('roblox_oauth_status')
    || url.searchParams.get('oauth_status')
    || url.searchParams.get('oauth');
  const explicitError = url.searchParams.get('roblox_oauth_error')
    || url.searchParams.get('oauth_error');
  const hasOAuthMarkers = statusValue !== null || explicitError !== null;
  const providerError = hasOAuthMarkers
    ? url.searchParams.get('error_description') || url.searchParams.get('error')
    : null;
  const failedStatus = statusValue && ['error', 'failed', 'failure', 'denied'].includes(statusValue.toLowerCase());

  return {
    present: hasOAuthMarkers,
    error: explicitError || providerError || (failedStatus ? 'Roblox authorization was not completed.' : undefined),
  };
};

export class RobloxAuthorizationService {
  static getAuthStatus(): RobloxAuthStatus {
    return StorageService.getAuthStatus();
  }

  static saveAuthStatus(status: RobloxAuthStatus): void {
    StorageService.saveAuthStatus(status);
  }

  static onOAuthResult(listener: (result: { status?: RobloxAuthStatus; error?: string }) => void): () => void {
    const api = electronApi();
    if (!api?.onRobloxOAuthResult) return () => undefined;
    return api.onRobloxOAuthResult((result: { status?: unknown; error?: string }) => {
      if (!result.status) {
        listener({ error: result.error });
        return;
      }
      try {
        const status = normalizeStatus(result.status);
        this.saveAuthStatus(status);
        listener({ status, error: result.error });
      } catch (error: any) {
        listener({ error: error?.message || 'Invalid OAuth result.' });
      }
    });
  }

  static async initiateOAuthFlow(): Promise<string> {
    const api = electronApi();
    if (api?.startRobloxOAuth) {
      const result = await api.startRobloxOAuth();
      if (result.error) throw new Error(result.error);
      return result.authorizationUrl || '';
    }

    if (typeof window === 'undefined') {
      throw new Error('Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID to the real Client ID.');
    }

    // The server creates and stores state, nonce, and PKCE values. The renderer only navigates.
    window.location.assign(WEB_OAUTH_START_ENDPOINT);
    return WEB_OAUTH_START_ENDPOINT;
  }

  static async handleWebCallback(callbackUrl = window.location.href): Promise<RobloxAuthStatus | null> {
    if (electronApi()?.startRobloxOAuth) return null;

    const callback = new URL(callbackUrl, window.location.origin);
    const result = getCallbackResult(callback);
    if (!result.present) return null;
    cleanOAuthCallbackQuery(callback);

    const status = await this.checkStatus();
    if (result.error) throw new Error(result.error);
    return status;
  }

  static async checkStatus(): Promise<RobloxAuthStatus> {
    const api = electronApi();
    const payload = api?.checkRobloxOAuth
      ? await api.checkRobloxOAuth()
      : await requestJson(WEB_OAUTH_STATUS_ENDPOINT);
    const status = normalizeStatus(payload);
    this.saveAuthStatus(status);
    return status;
  }

  static async disconnect(): Promise<void> {
    const api = electronApi();
    if (api?.disconnectRobloxOAuth) {
      await api.disconnectRobloxOAuth();
    } else {
      try {
        await requestJson(WEB_OAUTH_DISCONNECT_ENDPOINT, { method: 'POST' });
      } catch {
        // Clear local credentials even if the backend is offline or unreachable
      }
    }
    StorageService.clearAuthStatus();
  }

  static async getDiagnostics(): Promise<OAuthDiagnostics> {
    const api = electronApi();
    if (api?.getRobloxOAuthDiagnostics) {
      const payload = await api.getRobloxOAuthDiagnostics();
      const diagnostics = asRecord(payload);
      if (!diagnostics) throw new Error('The authorization service returned invalid diagnostics.');
      return diagnostics as OAuthDiagnostics;
    }

    try {
      const payload = await requestJson(WEB_OAUTH_DIAGNOSTICS_ENDPOINT);
      const diagnostics = asRecord(payload);
      if (!diagnostics) return defaultDiagnostics();
      return diagnostics as OAuthDiagnostics;
    } catch {
      return defaultDiagnostics();
    }
  }

  static disconnectedStatus(): RobloxAuthStatus {
    return disconnectedStatus();
  }
}
