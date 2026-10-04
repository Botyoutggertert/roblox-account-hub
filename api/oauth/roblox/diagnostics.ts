import type { IncomingMessage, ServerResponse } from 'http';
import { getWebOAuthConfig, maskClientId } from '../../_lib/oauth';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const { clientId, clientSecret, redirectUri } = getWebOAuthConfig(req);
  const isClientIdConfigured = Boolean(clientId && clientId !== 'ROBLOX_OAUTH_CLIENT_ID');
  const isClientSecretConfigured = Boolean(
    clientSecret &&
    clientSecret !== 'ROBLOX_OAUTH_CLIENT_SECRET' &&
    clientSecret.trim().length > 0
  );
  const isConfigured = isClientIdConfigured && isClientSecretConfigured;

  const diagnostics = {
    clientId: isClientIdConfigured ? 'PASS' : 'NOT CONFIGURED',
    clientSecret: isClientSecretConfigured ? 'PASS' : 'NOT CONFIGURED',
    clientSecretConfigured: isClientSecretConfigured,
    authorization: isConfigured ? 'PASS' : 'NOT CONFIGURED',
    redirectUri: redirectUri ? 'PASS' : 'NOT CONFIGURED',
    callback: 'NOT CONFIGURED',
    tokenExchange: 'NOT CONFIGURED',
    userInfo: 'NOT CONFIGURED',
    tokenValidation: 'NOT CONFIGURED',
    maskedClientId: maskClientId(clientId),
    redirectUriValue: redirectUri || 'Not configured',
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(diagnostics));
}
