import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';

/**
 * Custom Vite plugin to proxy Roblox API requests during development and preview.
 * This completely avoids browser CORS restrictions when running locally.
 */
function robloxCorsProxyPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    try {
      const parsedUrl = new URL(req.url || '', 'http://localhost:5173');
      const targetUrl = parsedUrl.searchParams.get('url');

      // Preflight CORS request
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.end();
        return;
      }

      if (!targetUrl) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing target url parameter' }));
        return;
      }

      let bodyBuffer: Buffer | undefined;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        bodyBuffer = Buffer.concat(chunks);
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': (req.headers['content-type'] as string) || 'application/json',
          'User-Agent': 'RobloxAccountHub/1.0',
        },
        body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
      });

      res.statusCode = response.status;
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      const data = await response.text();
      res.end(data);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ error: err.message || 'Proxy request failed' }));
    }
  };

  return {
    name: 'roblox-cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/roblox-proxy', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/roblox-proxy', handler);
    },
  };
}

/**
 * Custom Vite plugin to handle web OAuth endpoints during development and preview.
 */
function robloxWebOAuthPlugin(): Plugin {
  let activeOAuthSession: {
    state: string;
    nonce: string;
    verifier: string;
    createdAt: number;
  } | null = null;

  let currentAuthStatus: any = {
    status: 'NOT CONNECTED',
    lastChecked: new Date().toISOString(),
  };

  const AUTHORIZE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/authorize';
  const TOKEN_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token';
  const USERINFO_ENDPOINT = 'https://apis.roblox.com/oauth/v1/userinfo';
  const REVOKE_ENDPOINT = 'https://apis.roblox.com/oauth/v1/token/revoke';
  let storedTokens: any = null;

  const base64Url = (buf: Buffer) =>
    buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const getEnvConfig = () => {
    const env = loadEnv('development', process.cwd(), '');
    const clientId = String(env.VITE_ROBLOX_OAUTH_CLIENT_ID || env.ROBLOX_OAUTH_CLIENT_ID || '').trim();
    const redirectUri = String(
      env.VITE_ROBLOX_OAUTH_REDIRECT_URI || env.ROBLOX_OAUTH_REDIRECT_URI || 'http://localhost:5173/'
    ).trim();
    return { clientId, redirectUri };
  };

  const maskClientId = (id?: string) => {
    if (!id || id === 'ROBLOX_OAUTH_CLIENT_ID' || id === 'VITE_ROBLOX_OAUTH_CLIENT_ID') return 'Not configured';
    if (id.length <= 8) return '••••••••';
    return `${id.slice(0, 4)}••••${id.slice(-4)}`;
  };

  const handler = async (req: any, res: any, next: any) => {
    try {
      const parsedUrl = new URL(req.url || '', 'http://localhost:5173');
      const pathname = parsedUrl.pathname;
      const { clientId, redirectUri } = getEnvConfig();
      const isClientConfigured = Boolean(
        clientId &&
        clientId !== 'ROBLOX_OAUTH_CLIENT_ID' &&
        clientId !== 'VITE_ROBLOX_OAUTH_CLIENT_ID'
      );

      // 1. GET /api/oauth/roblox/diagnostics
      if (pathname === '/api/oauth/roblox/diagnostics') {
        const diagnostics = {
          clientId: isClientConfigured ? 'PASS' : 'NOT CONFIGURED',
          authorization: isClientConfigured ? 'PASS' : 'NOT CONFIGURED',
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
        res.end(JSON.stringify(diagnostics));
        return;
      }

      // 2. GET /api/oauth/roblox/status
      if (pathname === '/api/oauth/roblox/status') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(currentAuthStatus));
        return;
      }

      // 3. POST /api/oauth/roblox/disconnect
      if (pathname === '/api/oauth/roblox/disconnect') {
        if (storedTokens?.refreshToken && clientId) {
          try {
            await fetch(REVOKE_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token: storedTokens.refreshToken, client_id: clientId }),
            });
          } catch {}
        }
        storedTokens = null;
        currentAuthStatus = {
          status: 'NOT CONNECTED',
          lastChecked: new Date().toISOString(),
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(currentAuthStatus));
        return;
      }

      // 4. GET /api/oauth/roblox/start
      if (pathname === '/api/oauth/roblox/start') {
        if (!isClientConfigured) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID to the real Client ID.' }));
          return;
        }

        const state = base64Url(crypto.randomBytes(32));
        const nonce = base64Url(crypto.randomBytes(32));
        const verifier = base64Url(crypto.randomBytes(64));
        const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());

        activeOAuthSession = {
          state,
          nonce,
          verifier,
          createdAt: Date.now(),
        };

        const authUrl = new URL(AUTHORIZE_ENDPOINT);
        authUrl.search = new URLSearchParams({
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
        res.setHeader('Location', authUrl.toString());
        res.end();
        return;
      }

      // 5. Callback handler (either /api/oauth/roblox/callback OR root / if redirectUri is root)
      const isCallbackPath = pathname === '/api/oauth/roblox/callback';
      const isRootWithCode = pathname === '/' && parsedUrl.searchParams.has('code') && parsedUrl.searchParams.has('state');

      if (isCallbackPath || isRootWithCode) {
        const error = parsedUrl.searchParams.get('error');
        if (error) {
          const desc = parsedUrl.searchParams.get('error_description') || error;
          res.statusCode = 302;
          res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(desc)}`);
          res.end();
          return;
        }

        const returnedState = parsedUrl.searchParams.get('state');
        const code = parsedUrl.searchParams.get('code');

        if (!activeOAuthSession || !returnedState || returnedState !== activeOAuthSession.state) {
          res.statusCode = 302;
          res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=OAuth+state+validation+failed');
          res.end();
          return;
        }

        const verifier = activeOAuthSession.verifier;
        activeOAuthSession = null;

        // Exchange code for tokens
        const tokenRes = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            code_verifier: verifier,
            client_id: clientId,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = (await tokenRes.json().catch(() => null)) as any;
        if (!tokenRes.ok || !tokenData?.access_token) {
          const msg = tokenData?.error_description || tokenData?.error || 'Token exchange failed';
          res.statusCode = 302;
          res.setHeader('Location', `/?roblox_oauth=failed&oauth_error=${encodeURIComponent(msg)}`);
          res.end();
          return;
        }

        // Fetch User Info
        const userRes = await fetch(USERINFO_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/json',
          },
        });

        const userData = (await userRes.json().catch(() => null)) as any;
        if (!userRes.ok || !userData?.sub) {
          res.statusCode = 302;
          res.setHeader('Location', '/?roblox_oauth=failed&oauth_error=Failed+to+fetch+Roblox+user+profile');
          res.end();
          return;
        }

        const userId = Number(userData.sub);
        const username = userData.preferred_username || userData.nickname || userData.name;
        const now = new Date().toISOString();

        storedTokens = tokenData;
        currentAuthStatus = {
          status: 'CONNECTED',
          userId,
          username,
          displayName: userData.name || userData.nickname || username,
          avatarUrl: userData.picture,
          profileUrl: `https://www.roblox.com/users/${userId}/profile`,
          scope: typeof tokenData.scope === 'string' ? tokenData.scope.split(/\s+/) : ['openid', 'profile'],
          connectedAt: now,
          lastChecked: now,
          lastVerified: now,
          oauthStatus: 'PASS',
          tokenStatus: 'PASS',
        };

        res.statusCode = 302;
        res.setHeader('Location', '/?roblox_oauth=success');
        res.end();
        return;
      }

      next();
    } catch (err: any) {
      next(err);
    }
  };

  return {
    name: 'roblox-web-oauth',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), robloxCorsProxyPlugin(), robloxWebOAuthPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
