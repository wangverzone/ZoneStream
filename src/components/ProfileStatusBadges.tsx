import React, { useEffect, useState } from 'react';

const TOKEN_STORAGE_KEY = 'zonestream_session_token_v1';
const LEGACY_TOKEN_KEY = 'donghive_session_token_v1';
const MANUAL_OFFLINE_KEY = 'zonestream_manual_offline_v1';

function getStoredToken(): string {
  try {
    return (
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_TOKEN_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function isManualOfflineMode(): boolean {
  try {
    return localStorage.getItem(MANUAL_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface OnlineStatusPillProps {
  dbIsOnline?: boolean;
  isOwnProfile?: boolean;
  onSyncNow?: () => Promise<void> | void;
}

export const OnlineStatusPill: React.FC<OnlineStatusPillProps> = ({
  dbIsOnline = true,
  isOwnProfile = false,
  onSyncNow,
}) => {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [manualOffline, setManualOffline] = useState<boolean>(isManualOfflineMode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const effectiveOnline = isOwnProfile
    ? Boolean(browserOnline && !manualOffline && (dbIsOnline ?? true))
    : Boolean(browserOnline && dbIsOnline);

  const handleToggle = async () => {
    if (!isOwnProfile || busy) return;
    const nextOffline = !manualOffline;
    setManualOffline(nextOffline);
    try {
      localStorage.setItem(MANUAL_OFFLINE_KEY, String(nextOffline));
    } catch {
      // ignore
    }
    const token = getStoredToken();
    if (!token) return;
    setBusy(true);
    try {
      await fetch('/api/user/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ online: !nextOffline }),
      });
      if (onSyncNow) await onSyncNow();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  if (isOwnProfile) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        title="Klik untuk ganti status Online / Offline"
        className={`px-3 py-1 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors ${
          effectiveOnline
            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
            : 'bg-slate-200/80 dark:bg-[#181B24]/95 border-slate-300 dark:border-white/15 text-slate-600 dark:text-gray-400 hover:bg-slate-300/70'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {effectiveOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              effectiveOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-gray-500'
            }`}
          />
        </span>
        <span>{effectiveOnline ? 'Online' : 'Offline'}</span>
      </button>
    );
  }

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1.5 ${
        effectiveOnline
          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-200/80 dark:bg-[#181B24]/95 border-slate-300 dark:border-white/15 text-slate-600 dark:text-gray-400'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {effectiveOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            effectiveOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-gray-500'
          }`}
        />
      </span>
      <span>{effectiveOnline ? 'Online' : 'Offline'}</span>
    </span>
  );
};
