import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-4 left-4 z-[70] flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-md border border-amber-400/40 px-3.5 py-2 text-xs font-bold text-white shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
      <span>Mode Offline — Menampilkan data tersimpan</span>
    </div>
  );
};
