import type { IncomingMessage, ServerResponse } from 'http';
import { getWebOAuthConfig, maskClientId } from '../../_lib/oauth';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const { clientId, redirectUri } = getWebOAuthConfig(req);
  const isConfigured = Boolean(clientId && clientId !== 'ROBLOX_OAUTH_CLIENT_ID');

  const diagnostics = {
    clientId: isConfigured ? 'PASS' : 'NOT CONFIGURED',
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
