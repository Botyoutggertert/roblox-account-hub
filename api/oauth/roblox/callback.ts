import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  AUTH_COOKIE_NAME,
  ROBLOX_ISSUER,
  ROBLOX_JWKS_ENDPOINT,
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
  verifier?: string;
  redirectUri: string;
  createdAt: number;
}

type OAuthErrorCode =
  | 'access_denied'
  | 'session_missing'
  | 'session_invalid'
  | 'session_expired'
  | 'state_mismatch'
  | 'missing_code'
  | 'token_exchange_failed'
  | 'id_token_invalid'
  | 'userinfo_failed'
  | 'connection_failed';

interface RobloxJsonWebKey {
  kid?: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: string;
  use?: string;
  key_ops?: string[];
}

interface JsonWebKeySet {
  keys?: RobloxJsonWebKey[];
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  nonce?: string;
  sub?: string;
}

const SESSION_MAX_AGE_MS = 10 * 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 60;
const MAX_LOG_VALUE_LENGTH = 200;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const safeLogValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim()
    ? value.replace(/[\r\n\t]/g, ' ').slice(0, MAX_LOG_VALUE_LENGTH)
    : undefined;

const logOAuthError = (step: string, details: Record<string, unknown> = {}): void => {
  console.error('[Roblox OAuth callback]', { step, ...details });
};

const redirectWithError = (res: ServerResponse, code: OAuthErrorCode): void => {
  res.statusCode = 302;
  res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(code)}`);
  res.end();
};

const isSessionData = (value: unknown): value is SessionData => {
  const session = asRecord(value);
  return Boolean(
    session
    && typeof session.state === 'string' && session.state
    && typeof session.nonce === 'string' && session.nonce
    && (session.verifier === undefined || typeof session.verifier === 'string')
    && typeof session.redirectUri === 'string' && session.redirectUri
    && typeof session.createdAt === 'number' && Number.isFinite(session.createdAt)
  );
};

const decodeBase64UrlJson = <T>(value: string): T =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

const getAudience = (audience: string | string[] | undefined): string[] =>
  typeof audience === 'string' ? [audience] : Array.isArray(audience) ? audience : [];

const getVerificationKey = (jwk: RobloxJsonWebKey): crypto.KeyObject =>
  crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' });

async function validateIdToken(
  idToken: unknown,
  clientId: string,
  expectedNonce: string,
): Promise<IdTokenClaims> {
  if (typeof idToken !== 'string') throw new Error('missing_id_token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed_id_token');

  let header: JwtHeader;
  let claims: IdTokenClaims;
  try {
    header = decodeBase64UrlJson<JwtHeader>(parts[0]);
    claims = decodeBase64UrlJson<IdTokenClaims>(parts[1]);
  } catch {
    throw new Error('malformed_id_token');
  }

  if (header.alg !== 'ES256' || !header.kid) throw new Error('unsupported_id_token');

  const jwksResponse = await fetch(ROBLOX_JWKS_ENDPOINT, {
    headers: { Accept: 'application/json' },
  });
  const jwks = (await jwksResponse.json().catch(() => null)) as JsonWebKeySet | null;
  if (!jwksResponse.ok || !Array.isArray(jwks?.keys)) throw new Error('jwks_unavailable');

  const jwk = jwks.keys.find(key =>
    key.kid === header.kid
    && key.kty === 'EC'
    && key.crv === 'P-256'
    && (!key.alg || key.alg === 'ES256')
    && (!key.use || key.use === 'sig')
    && (!key.key_ops || key.key_ops.includes('verify'))
  );
  if (!jwk) throw new Error('signing_key_not_found');

  const signature = Buffer.from(parts[2], 'base64url');
  const signedValue = Buffer.from(`${parts[0]}.${parts[1]}`);
  const validSignature = crypto.verify(
    'sha256',
    signedValue,
    { key: getVerificationKey(jwk), dsaEncoding: 'ieee-p1363' },
    signature,
  );
  if (!validSignature) throw new Error('invalid_signature');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ROBLOX_ISSUER) throw new Error('invalid_issuer');
  const audiences = getAudience(claims.aud);
  if (!audiences.includes(clientId)) throw new Error('invalid_audience');
  if (claims.azp !== undefined && claims.azp !== clientId) throw new Error('invalid_authorized_party');
  if (audiences.length > 1 && claims.azp !== clientId) throw new Error('invalid_authorized_party');
  if (typeof claims.exp !== 'number' || claims.exp < now - CLOCK_TOLERANCE_SECONDS) throw new Error('expired_id_token');
  if (typeof claims.nbf === 'number' && claims.nbf > now + CLOCK_TOLERANCE_SECONDS) throw new Error('id_token_not_active');
  if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_TOLERANCE_SECONDS) throw new Error('invalid_issued_at');
  if (claims.nonce !== expectedNonce) throw new Error('invalid_nonce');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('missing_subject');

  return claims;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { clientId, clientSecret } = getWebOAuthConfig(req);
  const host = req.headers.host || 'localhost';
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
  const requestUrl = new URL(req.url || '/', `${proto}://${host}`);

  const providerError = requestUrl.searchParams.get('error');
  if (providerError) {
    setCookie(res, SESSION_COOKIE_NAME, '', { clear: true });
    logOAuthError('authorization_response', {
      providerError: safeLogValue(providerError),
      providerErrorDescription: safeLogValue(requestUrl.searchParams.get('error_description')),
    });
    redirectWithError(res, providerError === 'access_denied' ? 'access_denied' : 'connection_failed');
    return;
  }

  const code = requestUrl.searchParams.get('code');
  const returnedState = requestUrl.searchParams.get('state');
  const sessionCookie = getCookie(req, SESSION_COOKIE_NAME);
  setCookie(res, SESSION_COOKIE_NAME, '', { clear: true });

  if (!sessionCookie) {
    logOAuthError('session_cookie', { reason: 'missing' });
    redirectWithError(res, 'session_missing');
    return;
  }

  const decryptedSession = decryptPayload<unknown>(sessionCookie);
  if (!isSessionData(decryptedSession)) {
    logOAuthError('session_cookie', { reason: 'invalid_or_undecryptable' });
    redirectWithError(res, 'session_invalid');
    return;
  }
  const sessionData = decryptedSession;

  const sessionAge = Date.now() - sessionData.createdAt;
  if (sessionAge < 0 || sessionAge > SESSION_MAX_AGE_MS) {
    logOAuthError('session_cookie', { reason: 'expired', sessionAgeMs: sessionAge });
    redirectWithError(res, 'session_expired');
    return;
  }

  if (!returnedState || returnedState !== sessionData.state) {
    logOAuthError('state_validation', { reason: returnedState ? 'mismatch' : 'missing' });
    redirectWithError(res, 'state_mismatch');
    return;
  }

  if (!code) {
    logOAuthError('authorization_response', { reason: 'missing_code' });
    redirectWithError(res, 'missing_code');
    return;
  }

  let step: 'token_exchange' | 'id_token_validation' | 'userinfo' = 'token_exchange';
  try {
    if (!clientSecret || clientSecret === 'ROBLOX_OAUTH_CLIENT_SECRET') {
      logOAuthError('configuration', { reason: 'missing_client_secret' });
      redirectWithError(res, 'connection_failed');
      return;
    }

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: sessionData.redirectUri,
      }),
    });

    const tokenPayload = asRecord(await tokenResponse.json().catch(() => null));
    if (!tokenResponse.ok || typeof tokenPayload?.access_token !== 'string') {
      logOAuthError('token_exchange', {
        httpStatus: tokenResponse.status,
        providerError: safeLogValue(tokenPayload?.error),
        providerErrorDescription: safeLogValue(tokenPayload?.error_description),
      });
      redirectWithError(res, 'token_exchange_failed');
      return;
    }

    step = 'id_token_validation';
    let idTokenClaims: IdTokenClaims;
    try {
      idTokenClaims = await validateIdToken(tokenPayload.id_token, clientId, sessionData.nonce);
    } catch (error) {
      logOAuthError('id_token_validation', {
        reason: safeLogValue(error instanceof Error ? error.message : undefined) || 'validation_failed',
      });
      redirectWithError(res, 'id_token_invalid');
      return;
    }

    step = 'userinfo';
    const userResponse = await fetch(USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: 'application/json',
      },
    });

    const userPayload = asRecord(await userResponse.json().catch(() => null));
    if (!userResponse.ok || typeof userPayload?.sub !== 'string') {
      logOAuthError('userinfo', {
        httpStatus: userResponse.status,
        providerError: safeLogValue(userPayload?.error),
        providerErrorDescription: safeLogValue(userPayload?.error_description),
      });
      redirectWithError(res, 'userinfo_failed');
      return;
    }

    if (userPayload.sub !== idTokenClaims.sub) {
      logOAuthError('userinfo', { reason: 'subject_mismatch' });
      redirectWithError(res, 'userinfo_failed');
      return;
    }

    const userId = Number(userPayload.sub);
    const username = userPayload.preferred_username || userPayload.nickname || userPayload.name;
    if (!Number.isSafeInteger(userId) || userId <= 0 || typeof username !== 'string' || !username.trim()) {
      logOAuthError('userinfo', { reason: 'invalid_identity' });
      redirectWithError(res, 'userinfo_failed');
      return;
    }

    const now = new Date().toISOString();
    const authData = {
      status: 'CONNECTED',
      userId,
      username,
      displayName: typeof userPayload.name === 'string'
        ? userPayload.name
        : typeof userPayload.nickname === 'string' ? userPayload.nickname : username,
      avatarUrl: typeof userPayload.picture === 'string' ? userPayload.picture : undefined,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
      scope: typeof tokenPayload.scope === 'string' ? tokenPayload.scope.split(/\s+/) : ['openid', 'profile'],
      connectedAt: now,
      lastVerified: now,
      lastChecked: now,
      oauthStatus: 'PASS',
      tokenStatus: 'PASS',
      accessToken: tokenPayload.access_token,
      refreshToken: typeof tokenPayload.refresh_token === 'string' ? tokenPayload.refresh_token : undefined,
    };

    const encryptedAuth = encryptPayload(authData);
    setCookie(res, AUTH_COOKIE_NAME, encryptedAuth, { maxAgeSeconds: 30 * 24 * 60 * 60 });

    res.statusCode = 302;
    res.setHeader('Location', '/?roblox_oauth=success');
    res.end();
  } catch (error) {
    logOAuthError(step, {
      reason: error instanceof TypeError ? 'network_error' : 'unexpected_error',
    });
    redirectWithError(res, step === 'token_exchange'
      ? 'token_exchange_failed'
      : step === 'id_token_validation' ? 'id_token_invalid' : 'userinfo_failed');
  }
}
