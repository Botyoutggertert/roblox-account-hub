import type { IncomingMessage, ServerResponse } from 'http';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Handle CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const parsedUrl = new URL(req.url || '', `${proto}://${host}`);
  const targetUrl = parsedUrl.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing target url parameter' }));
    return;
  }

  try {
    const targetParsed = new URL(targetUrl);
    if (!targetParsed.hostname.endsWith('.roblox.com')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Only Roblox endpoints can be proxied' }));
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
      method: req.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': (req.headers['content-type'] as string) || 'application/json',
        'User-Agent': 'RobloxAccountHub/1.0',
      },
      body: bodyBuffer && bodyBuffer.length > 0 ? bodyBuffer : undefined,
    });

    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');

    const data = await response.text();
    res.end(data);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Proxy request failed' }));
  }
}
