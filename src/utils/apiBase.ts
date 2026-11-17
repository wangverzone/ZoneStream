const DEFAULT_APK_API_BASE = 'https://zonestream-beta.vercel.app';

export function isNativeCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    ZoneStreamNativeAuth?: { openGoogleAuthSheet?: (url: string) => void };
  };
  if (w.ZoneStreamNativeAuth) return true;
  if (w.Capacitor?.isNativePlatform?.()) return true;
  const platform = w.Capacitor?.getPlatform?.();
  if (platform === 'android' || platform === 'ios') return true;
  const { protocol, hostname, port } = window.location;
  if (protocol === 'capacitor:' || protocol === 'file:') return true;
  // Capacitor Android WebViewLocalServer runs at https://localhost (with empty port)
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && !port) return true;
  return false;
}

const ENV_API_BASE = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  if (ENV_API_BASE) return ENV_API_BASE;
  if (isNativeCapacitorRuntime()) return DEFAULT_APK_API_BASE;
  return '';
}

export function resolveApiUrl(urlOrPath: string): string {
  const input = String(urlOrPath || '');
  const base = getApiBaseUrl();
  if (!base) return input;
  if (input.startsWith('/api/') || input === '/api') {
    return `${base}${input}`;
  }
  if (typeof window !== 'undefined' && input.startsWith(`${window.location.origin}/api/`)) {
    const path = input.slice(window.location.origin.length);
    return `${base}${path}`;
  }
  return input;
}

export function resolveWsUrl(pathWithQuery: string): string {
  const cleanPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const base = getApiBaseUrl();
  if (base) {
    try {
      const parsed = new URL(base);
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
  if (bridgeInstalled || typeof window === 'undefined') {
    return;
  }
  const base = getApiBaseUrl();
  if (!base) {
    return;
  }
  bridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const activeBase = getApiBaseUrl() || base;
    if (typeof input === 'string') {
      if (input.startsWith('/api/') || input === '/api') {
        return originalFetch(`${activeBase}${input}`, init);
      }
      if (input.startsWith(`${window.location.origin}/api/`)) {
        const path = input.slice(window.location.origin.length);
        return originalFetch(`${activeBase}${path}`, init);
      }
    } else if (input instanceof URL) {
      const href = input.toString();
      if (href.startsWith(`${window.location.origin}/api/`)) {
        const path = href.slice(window.location.origin.length);
        return originalFetch(`${activeBase}${path}`, init);
      }
    } else if (input instanceof Request) {
      const reqUrl = input.url;
      if (reqUrl.startsWith(`${window.location.origin}/api/`)) {
        const path = reqUrl.slice(window.location.origin.length);
        return originalFetch(new Request(`${activeBase}${path}`, input), init);
      }
    }
    return originalFetch(input, init);
  };
}

// Install immediately at module evaluation time so any early fetch() calls are bridged
installCapacitorApiBridge();
