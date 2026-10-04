// Unified HTTP network client for Roblox APIs
// Automatically routes via Electron IPC (if desktop) or local Vite dev proxy / CORS fallback.

export interface HttpResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Record<string, string>;
}

export class NetworkClient {
  static async request<T = any>(
    url: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: any;
      timeoutMs?: number;
    } = {}
  ): Promise<HttpResponse<T>> {
    // 1. Desktop Electron IPC (Bypasses CORS natively)
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.robloxFetch;
    if (isElectron) {
      try {
        const response = await (window as any).electronAPI.robloxFetch(url, {
          method: options.method || 'GET',
          headers: options.headers,
          body: typeof options.body === 'object' ? JSON.stringify(options.body) : options.body,
        });
        return response;
      } catch (err: any) {
        return {
          status: 0,
          ok: false,
          data: { error: err.message || 'Desktop request failed' } as any,
          headers: {},
        };
      }
    }

    const isRobloxUrl = url.includes('.roblox.com');
    const bodyStr = typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;

    // Helper to execute fetch with timeout
    const doFetch = async (targetUrl: string): Promise<HttpResponse<T>> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

      try {
        const resp = await fetch(targetUrl, {
          method: options.method || 'GET',
          headers: {
            'Accept': 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
          },
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = resp.headers.get('content-type') || '';
        let data: any;
        if (contentType.includes('application/json')) {
          data = await resp.json();
        } else {
          data = await resp.text();
        }

        const headers: Record<string, string> = {};
        resp.headers.forEach((val, key) => {
          headers[key] = val;
        });

        return {
          status: resp.status,
          ok: resp.ok,
          data,
          headers,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    // 2. Primary Web Attempt: Route via local Vite proxy if it's a Roblox domain
    if (isRobloxUrl) {
      const localProxyUrl = `/api/roblox-proxy?url=${encodeURIComponent(url)}`;
      try {
        return await doFetch(localProxyUrl);
      } catch (proxyErr) {
        // Local proxy may be unavailable (e.g. static site preview or custom build)
        // Fall back to direct fetch first, then public CORS proxy
      }
    }

    // 3. Direct fetch attempt
    try {
      return await doFetch(url);
    } catch (directErr: any) {
      // 4. Fallback for Roblox URLs via public CORS proxy (e.g. corsproxy.io)
      if (isRobloxUrl) {
        try {
          const publicProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
          return await doFetch(publicProxyUrl);
        } catch {
          // Fallback also failed
        }
      }

      const isAbort = directErr.name === 'AbortError';
      return {
        status: 0,
        ok: false,
        data: { error: isAbort ? 'Request timed out' : directErr.message || 'Network request failed' } as any,
        headers: {},
      };
    }
  }

  static async openExternalUrl(url: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
      await (window as any).electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
