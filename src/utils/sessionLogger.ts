export type SessionLogLevel = 'info' | 'warn' | 'error';

export type SessionLogEvent =
  | 'session_init'
  | 'session_restore_start'
  | 'session_restore_ok'
  | 'session_preserved_on_transient_error'
  | 'session_invalidated_401'
  | 'session_invalidated_banned'
  | 'token_saved'
  | 'token_storage_recovered'
  | 'token_removed'
  | 'firebase_auth_state_changed'
  | 'firebase_redirect_result'
  | 'firebase_session_recovered'
  | 'login_password_success'
  | 'login_password_failed'
  | 'login_google_popup_start'
  | 'login_google_success'
  | 'login_google_error'
  | 'register_success'
  | 'explicit_logout'
  | 'cross_tab_storage_sync';

export interface SessionLogEntry {
  ts: string;
  level: SessionLogLevel;
  event: SessionLogEvent;
  uid?: string;
  hasJwt?: boolean;
  hasFirebaseUser?: boolean;
  detail?: Record<string, unknown>;
}

const SESSION_LOG_STORAGE_KEY = 'zonestream_auth_session_logs_v1';
const MAX_LOGS = 60;

declare global {
  interface Window {
    __ZONESTREAM_SESSION_LOGS__?: SessionLogEntry[];
  }
}

function readLogs(): SessionLogEntry[] {
  try {
    const raw = sessionStorage.getItem(SESSION_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logSessionEvent(
  event: SessionLogEvent,
  options?: {
    level?: SessionLogLevel;
    uid?: string;
    hasJwt?: boolean;
    hasFirebaseUser?: boolean;
    detail?: Record<string, unknown>;
  }
): void {
  const level = options?.level || 'info';
  const entry: SessionLogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(options?.uid ? { uid: options.uid } : {}),
    ...(typeof options?.hasJwt === 'boolean' ? { hasJwt: options.hasJwt } : {}),
    ...(typeof options?.hasFirebaseUser === 'boolean'
      ? { hasFirebaseUser: options.hasFirebaseUser }
      : {}),
    ...(options?.detail ? { detail: options.detail } : {}),
  };

  try {
    const next = [...readLogs(), entry].slice(-MAX_LOGS);
    sessionStorage.setItem(SESSION_LOG_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.__ZONESTREAM_SESSION_LOGS__ = next;
    }
  } catch {
    // Ignore storage issues in restricted contexts
  }

  const prefix = `[ZoneStream AuthSession] ${event}`;
  if (level === 'error') {
    console.error(prefix, entry);
  } else if (level === 'warn') {
    console.warn(prefix, entry);
  } else {
    console.info(prefix, entry);
  }
}

export function getSessionLogs(): SessionLogEntry[] {
  return readLogs();
}
