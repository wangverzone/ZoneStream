const RAW_API_BASE = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return RAW_API_BASE;
}

export function resolveApiUrl(urlOrPath: string): string {
  const input = String(urlOrPath || '');
  if (!RAW_API_BASE) return input;
  if (input.startsWith('/api/') || input === '/api') {
    return `${RAW_API_BASE}${input}`;
  }
  return input;
}

export function resolveWsUrl(pathWithQuery: string): string {
  const cleanPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  if (RAW_API_BASE) {
    try {
      const parsed = new URL(RAW_API_BASE);
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${parsed.host}${cleanPath}`;
    } catch {
      // Fallback to window origin below
    }
  }
  if (typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}${cleanPath}`;
  }
  return cleanPath;
}

let bridgeInstalled = false;

export function installCapacitorApiBridge(): void {
  if (bridgeInstalled || typeof window === 'undefined' || !RAW_API_BASE) {
    return;
  }
  bridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === 'string' && (input.startsWith('/api/') || input === '/api')) {
      return originalFetch(`${RAW_API_BASE}${input}`, init);
    }
    if (input instanceof Request) {
      const reqUrl = input.url;
      if (reqUrl.startsWith(`${window.location.origin}/api/`)) {
        const path = reqUrl.slice(window.location.origin.length);
        return originalFetch(new Request(`${RAW_API_BASE}${path}`, input), init);
      }
    }
    return originalFetch(input, init);
  };
}
