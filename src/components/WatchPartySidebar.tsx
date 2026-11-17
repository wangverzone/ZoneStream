import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveWsUrl } from '../utils/apiBase';
import { AvatarDecoration } from './AvatarDecoration';
import { VerifiedBadge } from './VerifiedBadge';
import { StatusEmojiBadge } from './VipEmojis';
import { playSoundEffect } from '../utils/soundEffects';

interface WatchPartySidebarProps {
  episodeId: string;
  seriesTitle: string;
  mediaType?: 'anime' | 'donghua';
  poster?: string;
  roomId?: string;
  isOpen: boolean;
  onClose: () => void;
  currentTimeSeconds?: number;
  isPlayingVideo?: boolean;
  onRemoteSync?: (state: { isPlaying: boolean; currentTime: number }) => void;
}

interface NobarMessage {
  id: string;
  uid: string;
  username: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  activeBorder: string;
  statusEmoji: string;
  level: number;
  text: string;
  createdAt: string;
}

interface NobarParticipant {
  uid: string;
  username: string;
  name: string;
  photoUrl: string;
  role: 'member' | 'founder';
  isPremium: boolean;
  activeBadge: string;
  activeBorder: string;
  statusEmoji: string;
  level: number;
  joinedAt: string;
}

function getStoredAuthToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

function formatSyncTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function formatRelativeTime(iso: string): string {
  if (!iso) return 'Baru saja';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 30) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  return `${Math.floor(diff / 3600)}j lalu`;
}

export const WatchPartySidebar: React.FC<WatchPartySidebarProps> = ({
  episodeId,
  seriesTitle,
  mediaType = 'donghua',
  poster = '',
  roomId: propRoomId,
  isOpen,
  onClose,
  currentTimeSeconds = 0,
  isPlayingVideo = true,
  onRemoteSync,
}) => {
  const { user } = useAuth();
  const effectiveRoomId = propRoomId || `ep_${episodeId}`;

  const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat');
  const [messages, setMessages] = useState<NobarMessage[]>([]);
  const [participants, setParticipants] = useState<NobarParticipant[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [hostUid, setHostUid] = useState<string>('00000');
  const [hostName, setHostName] = useState<string>('VerzonFounder');
  const [roomPlaying, setRoomPlaying] = useState<boolean>(true);
  const [roomTime, setRoomTime] = useState<number>(0);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadRoomState = async () => {
    try {
      const token = getStoredAuthToken();
      const qs = new URLSearchParams({
        seriesTitle,
        episodeId,
        mediaType,
        poster,
      });
      const res = await fetch(
        `/api/features/nobar/room/${encodeURIComponent(effectiveRoomId)}?${qs.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const json = await res.json();
      if (res.ok && json.ok && json.room) {
        setMessages(Array.isArray(json.room.messages) ? json.room.messages : []);
        setParticipants(Array.isArray(json.room.participants) ? json.room.participants : []);
        setOnlineCount(Math.max(1, Number(json.room.onlineCount) || 1));
        setHostUid(json.room.hostUid || '00000');
        setHostName(json.room.hostName || 'VerzonFounder');
        setRoomPlaying(Boolean(json.room.isPlaying));
        setRoomTime(Math.max(0, Number(json.room.currentTime) || 0));
      }
    } catch {
      // Ignore transient network errors
    }
  };

  useEffect(() => {
    if (!isOpen || !effectiveRoomId) return;
    void loadRoomState();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRoomState();
      }
    }, 10000);
    return () => clearInterval(poll);
  }, [isOpen, effectiveRoomId, episodeId]);

  useEffect(() => {
    if (!isOpen || !effectiveRoomId) return;
    const token = getStoredAuthToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(resolveWsUrl(`/ws/chat?token=${encodeURIComponent(token)}`));
      wsRef.current = ws;

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'nobar:subscribe',
            roomId: effectiveRoomId,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (!data || data.roomId !== effectiveRoomId) return;

          if (data.type === 'nobar:chat' && data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev.slice(-59), data.message];
            });
            if (Array.isArray(data.participants)) {
              setParticipants(data.participants);
            }
            if (data.onlineCount) {
              setOnlineCount(Math.max(1, Number(data.onlineCount)));
            }
          } else if (data.type === 'nobar:participants') {
            if (Array.isArray(data.participants)) {
              setParticipants(data.participants);
            }
            if (data.onlineCount) {
              setOnlineCount(Math.max(1, Number(data.onlineCount)));
            }
          } else if (data.type === 'nobar:presence') {
            if (data.onlineCount) {
              setOnlineCount(Math.max(1, Number(data.onlineCount)));
            }
          } else if (data.type === 'nobar:sync') {
            const nextPlaying = Boolean(data.isPlaying);
            const nextTime = Math.max(0, Number(data.currentTime) || 0);
            setRoomPlaying(nextPlaying);
            setRoomTime(nextTime);
            setSyncBanner(
              `${data.senderName || 'Host'} menyinkronkan video (${
                nextPlaying ? 'Play' : 'Pause'
              } · ${formatSyncTimestamp(nextTime)})`
            );
            onRemoteSync?.({ isPlaying: nextPlaying, currentTime: nextTime });
            setTimeout(() => setSyncBanner(null), 4000);
          }
        } catch {
          // Ignore malformed WS frame
        }
      };
    } catch {
      // Fallback to polling
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'nobar:subscribe', roomId: '' }));
          ws.close();
        } catch {
          // Ignore close error
        }
      }
      wsRef.current = null;
    };
  }, [isOpen, effectiveRoomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isOpen]);

  const handleBroadcastSync = async (overridePlaying?: boolean) => {
    const token = getStoredAuthToken();
    if (!token) return;
    setSyncing(true);
    const nextPlay = overridePlaying !== undefined ? overridePlaying : isPlayingVideo;
    const nextSec = Math.max(0, Math.floor(currentTimeSeconds || roomTime + 15));

    try {
      // Emit low-latency WS frame first
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'nobar:sync',
            roomId: effectiveRoomId,
            isPlaying: nextPlay,
            currentTime: nextSec,
            episodeId,
            mediaType,
            seriesTitle,
          })
        );
      }

      // Persist & broadcast on server + register active room in Nobar Lobby
      await Promise.all([
        fetch(`/api/features/nobar/room/${encodeURIComponent(effectiveRoomId)}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            isPlaying: nextPlay,
            currentTime: nextSec,
            episodeId,
            seriesTitle,
          }),
        }),
        fetch('/api/features/nobar/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roomId: effectiveRoomId,
            title: `Nobar ${seriesTitle}`,
            seriesTitle,
            episodeId,
            mediaType,
            poster,
          }),
        }),
      ]);

      setRoomPlaying(nextPlay);
      setRoomTime(nextSec);
      setSyncBanner(`Berhasil sinkronkan waktu ke semua penonton (${formatSyncTimestamp(nextSec)})`);
      playSoundEffect('notification');
      setTimeout(() => setSyncBanner(null), 3500);
    } catch {
      // Ignore sync error
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const inviteUrl = `${window.location.origin}/watch/${mediaType}/${encodeURIComponent(
        episodeId
      )}?nobar=1&room=${encodeURIComponent(effectiveRoomId)}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      playSoundEffect('notification');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || sending) return;

    const token = getStoredAuthToken();
    if (!token || !user) {
      setSyncBanner('Silakan login terlebih dahulu untuk mengirim chat Nobar.');
      setTimeout(() => setSyncBanner(null), 3000);
      return;
    }

    setSending(true);
    setInputText('');

    try {
      const res = await fetch(
        `/api/features/nobar/room/${encodeURIComponent(effectiveRoomId)}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: clean }),
        }
      );
      const json = await res.json();
      if (res.ok && json.ok && json.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === json.message.id)) return prev;
          return [...prev.slice(-59), json.message];
        });
        playSoundEffect('chat');
      }
    } catch {
      // Ignore error
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full lg:w-88 h-[540px] lg:h-[600px] rounded-2xl bg-[#12151E] border border-white/10 flex flex-col shadow-2xl overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-3.5 py-3 bg-gradient-to-r from-[#1A1D29] to-[#23192D] border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>Nobar Live (Watch Party)</span>
              </h4>
              <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{seriesTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold">
              {onlineCount} Online
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-Time Sync Control Bar */}
        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleBroadcastSync(!roomPlaying)}
              disabled={syncing || !user}
              className="h-7 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Sinkronkan Play/Pause & Posisi Detik ke Semua Penonton"
            >
              {roomPlaying ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
              <span>{formatSyncTimestamp(roomTime)}</span>
              <RefreshCw className={`w-2.5 h-2.5 ml-0.5 ${syncing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleBroadcastSync(true)}
              disabled={syncing || !user}
              className="h-7 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Sync Room</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="h-7 px-2.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLink ? 'Tersalin!' : 'Undang Teman'}</span>
          </button>
        </div>

        {/* Mode Tabs: Live Chat vs Peserta Online */}
        <div className="mt-2.5 grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-black/30 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
              activeTab === 'chat'
                ? 'bg-[#E84A18] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Chat ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-1 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 transition-colors ${
              activeTab === 'members'
                ? 'bg-[#E84A18] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Penonton ({ Math.max(onlineCount, participants.length) })</span>
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncBanner && (
        <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-[10px] font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{syncBanner}</span>
        </div>
      )}

      {/* Body */}
      {activeTab === 'chat' ? (
        <>
          <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
            {messages.map((m) => {
              const isFounder = m.role === 'founder';
              const isHost = m.uid === hostUid;
              return (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl border ${
                    isFounder
                      ? 'bg-gradient-to-r from-amber-500/10 to-rose-500/10 border-amber-500/30'
                      : 'bg-[#181C28] border-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AvatarDecoration
                      src={m.photoUrl}
                      alt={m.name}
                      size="xs"
                      decorationId={m.activeBorder}
                      level={m.level}
                      isFounder={isFounder}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`text-[11px] font-extrabold truncate ${
                              isFounder
                                ? 'text-amber-300'
                                : m.isPremium
                                ? 'text-sky-300'
                                : 'text-white'
                            }`}
                          >
                            {m.name}
                          </span>
                          {(isFounder || m.isPremium) && (
                            <VerifiedBadge
                              badgeLabel={m.activeBadge}
                              isFounder={isFounder}
                              size="sm"
                            />
                          )}
                          {m.statusEmoji && <StatusEmojiBadge statusEmoji={m.statusEmoji} size="xs" />}
                          {isHost && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Host
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono shrink-0">
                          {formatRelativeTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 break-words leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t border-white/10 bg-[#161924] flex gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={user ? 'Kirim komentar Nobar real-time...' : 'Login untuk chat di Nobar...'}
              className="flex-1 h-9 px-3 rounded-xl bg-[#0E1118] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E84A18]"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="w-9 h-9 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 p-3 space-y-2 overflow-y-auto">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">Host Room Nobar</span>
            <span className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> {hostName}
            </span>
          </div>

          {participants.map((p) => (
            <div
              key={p.uid}
              className="p-2.5 rounded-xl bg-[#181C28] border border-white/5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarDecoration
                  src={p.photoUrl}
                  alt={p.name}
                  size="sm"
                  decorationId={p.activeBorder}
                  level={p.level}
                  isFounder={p.role === 'founder'}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-extrabold text-white truncate">{p.name}</span>
                    {(p.role === 'founder' || p.isPremium) && (
                      <VerifiedBadge
                        badgeLabel={p.activeBadge}
                        isFounder={p.role === 'founder'}
                        size="sm"
                      />
                    )}
                    {p.statusEmoji && <StatusEmojiBadge statusEmoji={p.statusEmoji} size="xs" />}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    @{p.username} · Lv.{p.role === 'founder' ? 'MAX' : p.level}
                  </p>
                </div>
              </div>
              {p.uid === hostUid && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                  Host
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
