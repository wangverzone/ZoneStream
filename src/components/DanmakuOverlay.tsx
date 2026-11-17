import React, { useEffect, useState } from 'react';
import { Crown, Eye, EyeOff, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveWsUrl } from '../utils/apiBase';
import { playSoundEffect } from '../utils/soundEffects';

export interface DanmakuBullet {
  id: string;
  episodeId: string;
  uid: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  text: string;
  color: string;
  lane: number;
  createdAt: string;
}

const VIP_COLORS = [
  { hex: '#FFFFFF', label: 'Putih', vipOnly: false },
  { hex: '#FACC15', label: 'Emas VIP', vipOnly: true },
  { hex: '#38BDF8', label: 'Aqua VIP', vipOnly: true },
  { hex: '#FB7185', label: 'Rose VIP', vipOnly: true },
  { hex: '#34D399', label: 'Jade VIP', vipOnly: true },
  { hex: '#C084FC', label: 'Ungu VIP', vipOnly: true },
];

const QUICK_REACTIONS = [
  '🔥 Epik Parah!',
  '👑 GG Banget!',
  '⚡ Gass Lanjut!',
  '😭 Merinding!',
];

function getStoredAuthToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

export function useEpisodeDanmaku(episodeId: string) {
  const [bullets, setBullets] = useState<DanmakuBullet[]>([]);
  const [enabled, setEnabled] = useState<boolean>(() => {
    return localStorage.getItem('zonestream_danmaku_enabled') !== 'false';
  });

  const toggleEnabled = () => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('zonestream_danmaku_enabled', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!episodeId) return;
    let cancelled = false;
    fetch(`/api/features/danmaku/${encodeURIComponent(episodeId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && Array.isArray(json.items)) {
          setBullets(json.items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) return;
    const token = getStoredAuthToken();
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(resolveWsUrl(`/ws/chat?token=${encodeURIComponent(token)}`));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (data?.type === 'danmaku:new' && data.episodeId === episodeId && data.item) {
            setBullets((prev) => {
              if (prev.some((b) => b.id === data.item.id)) return prev;
              return [...prev.slice(-45), data.item];
            });
          }
        } catch {
          // Ignore malformed WS message
        }
      };
    } catch {
      // Ignore WS error
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [episodeId]);

  const appendLocalBullet = (item: DanmakuBullet) => {
    setBullets((prev) => {
      if (prev.some((b) => b.id === item.id)) return prev;
      return [...prev.slice(-45), item];
    });
  };

  return {
    bullets,
    enabled,
    toggleEnabled,
    appendLocalBullet,
  };
}

export const DanmakuVideoOverlay: React.FC<{
  bullets: DanmakuBullet[];
  enabled: boolean;
}> = ({ bullets, enabled }) => {
  if (!enabled || bullets.length === 0) return null;

  const visibleBullets = bullets.slice(-14);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden z-10 select-none"
    >
      <style>{`
        @keyframes zsDanmakuFly {
          0% { transform: translateX(105%); }
          100% { transform: translateX(-140%); }
        }
      `}</style>
      {visibleBullets.map((b, idx) => {
        const laneIndex = (b.lane ?? idx) % 4;
        const topPercent = 8 + laneIndex * 14;
        const durationSec = 9 + (idx % 4) * 1.4;
        const delaySec = (idx % 6) * 1.1;
        const isFounder = b.role === 'founder';
        const isVip = b.isPremium || isFounder;

        return (
          <div
            key={b.id}
            style={{
              top: `${topPercent}%`,
              color: b.color || '#FFFFFF',
              animation: `zsDanmakuFly ${durationSec}s linear ${delaySec}s infinite`,
              textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)',
            }}
            className="absolute right-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-[1px] text-xs sm:text-sm font-extrabold tracking-wide"
          >
            {isFounder ? (
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5" /> FOUNDER
              </span>
            ) : isVip ? (
              <span className="px-1.5 py-0.2 rounded bg-sky-400/25 border border-sky-400/40 text-sky-300 text-[9px] font-black uppercase">
                VIP
              </span>
            ) : null}
            <span>{b.text}</span>
          </div>
        );
      })}
    </div>
  );
};

export const DanmakuControlBar: React.FC<{
  episodeId: string;
  enabled: boolean;
  onToggleEnabled: () => void;
  onBulletSent: (item: DanmakuBullet) => void;
}> = ({ episodeId, enabled, onToggleEnabled, onBulletSent }) => {
  const { user, isPremium } = useAuth();
  const isVipOrFounder = Boolean(user && (isPremium || user.role === 'founder'));

  const [text, setText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [sending, setSending] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const sendDanmaku = async (rawText: string) => {
    const clean = rawText.trim().slice(0, 85);
    if (!clean || sending) return;

    const token = getStoredAuthToken();
    if (!token || !user) {
      setStatusNote('Login terlebih dahulu untuk menembakkan komentar Danmaku ke layar video!');
      setTimeout(() => setStatusNote(null), 3000);
      return;
    }

    setSending(true);
    setText('');
    try {
      const res = await fetch(`/api/features/danmaku/${encodeURIComponent(episodeId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: clean,
          color: isVipOrFounder ? selectedColor : '#FFFFFF',
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok && json.item) {
        onBulletSent(json.item);
        playSoundEffect('chat');
      } else {
        setStatusNote(json.error || 'Gagal mengirim Danmaku');
        setTimeout(() => setStatusNote(null), 3000);
      }
    } catch {
      setStatusNote('Gagal menghubungi server');
      setTimeout(() => setStatusNote(null), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/[0.08] p-3 space-y-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleEnabled}
            className={`h-8 px-3 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors ${
              enabled
                ? 'bg-emerald-500/20 border border-emerald-500/35 text-emerald-400'
                : 'bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400'
            }`}
          >
            {enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Danmaku {enabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* VIP Color Picker */}
          <div className="flex items-center gap-1.5">
            {VIP_COLORS.map((c) => {
              const locked = c.vipOnly && !isVipOrFounder;
              const active = selectedColor === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      setStatusNote('Warna Danmaku Neon eksklusif untuk member VIP & Founder!');
                      setTimeout(() => setStatusNote(null), 3000);
                      return;
                    }
                    setSelectedColor(c.hex);
                  }}
                  title={locked ? `${c.label} (Khusus VIP)` : c.label}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    active ? 'scale-125 ring-2 ring-[#E84A18] border-white' : 'border-black/40 opacity-80'
                  } ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {/* Quick 1-Tap Reaction Danmaku */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_REACTIONS.map((rx) => (
            <button
              key={rx}
              type="button"
              disabled={sending}
              onClick={() => sendDanmaku(rx)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C202B] dark:hover:bg-[#252A38] text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0 transition-colors"
            >
              {rx}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Danmaku Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendDanmaku(text);
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <MessageSquarePlus className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              user
                ? 'Tembakkan komentar Danmaku melayang ke layar video...'
                : 'Login untuk kirim komentar Danmaku di layar video...'
            }
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-[#0E1118] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E84A18]"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-9 px-3.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim</span>
        </button>
      </form>

      {statusNote && (
        <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{statusNote}</span>
        </div>
      )}
    </div>
  );
};
