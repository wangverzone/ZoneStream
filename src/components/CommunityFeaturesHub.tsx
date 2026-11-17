import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Crown,
  Flame,
  Gift,
  Megaphone,
  Play,
  Plus,
  Radio,
  ShoppingBag,
  Sparkles,
  Target,
  Ticket,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveApiUrl, resolveWsUrl } from '../utils/apiBase';
import { playSoundEffect } from '../utils/soundEffects';
import { AvatarDecoration } from './AvatarDecoration';

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  category: 'event' | 'promo' | 'info' | 'giftcode';
  redeemCode?: string;
  isActive: boolean;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
}

interface QuestItem {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardExp: number;
  actionLink: string;
  actionLabel: string;
}

interface ShopItem {
  id: string;
  category: 'vip' | 'exp' | 'frame';
  name: string;
  description: string;
  coinCost: number;
  vipDays?: number;
  bonusExp?: number;
  frameId?: string;
  badgeTag?: string;
}

interface NobarRoomSummary {
  roomId: string;
  title: string;
  seriesTitle: string;
  episodeId: string;
  mediaType: 'anime' | 'donghua';
  poster: string;
  hostUid: string;
  hostName: string;
  hostPhotoUrl: string;
  hostBorder: string;
  hostBadge: string;
  clanTag?: string;
  isPlaying: boolean;
  currentTime: number;
  onlineCount: number;
  updatedAt: string;
}

interface RedeemCodeSummary {
  code: string;
  description: string;
  coins: number;
  exp: number;
  vipDays: number;
  maxClaims: number;
  claimedCount?: number;
  claimedBy?: string[];
  alreadyClaimed?: boolean;
}

type ModalTab = 'quests' | 'shop' | 'redeem' | 'nobar' | 'founder';

function getStoredAuthToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

export interface CommunityFeaturesHubProps {
  initialTab?: ModalTab;
  startOpened?: boolean;
  className?: string;
  hideHeader?: boolean;
  inline?: boolean;
}

export const CommunityFeaturesHub: React.FC<CommunityFeaturesHubProps> = ({
  initialTab = 'quests',
  startOpened = false,
  className = '',
  hideHeader = false,
  inline = false,
}) => {
  const { user, applyUserSnapshot, refreshUser, getLocalHistory } = useAuth();
  const navigate = useNavigate();

  const isFounder =
    Boolean(user) &&
    (user?.role === 'founder' || user?.email?.toLowerCase() === 'wanglin72kk@gmail.com');

  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [nobarRooms, setNobarRooms] = useState<NobarRoomSummary[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCodeSummary[]>([]);

  const [modalOpen, setModalOpen] = useState(startOpened);
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [shopFilter, setShopFilter] = useState<'all' | 'vip' | 'exp' | 'frame'>('all');

  const [redeemInput, setRedeemInput] = useState('');
  const [freeChestAvailable, setFreeChestAvailable] = useState(true);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: ModalTab; code?: string }>).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
        if (detail.code) setRedeemInput(detail.code);
        if (!inline) {
          setModalOpen(true);
        }
      }
    };
    window.addEventListener('zonestream:open-features', handleOpenEvent);
    return () => window.removeEventListener('zonestream:open-features', handleOpenEvent);
  }, [inline]);

  // Founder controls state
  const [bcastTitle, setBcastTitle] = useState('EVENT SPESIAL ZONESTREAM');
  const [bcastMessage, setBcastMessage] = useState('');
  const [bcastCategory, setBcastCategory] = useState<'event' | 'promo' | 'info' | 'giftcode'>('giftcode');
  const [bcastRedeemCode, setBcastRedeemCode] = useState('');

  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeDesc, setNewCodeDesc] = useState('');
  const [newCodeCoins, setNewCodeCoins] = useState('150');
  const [newCodeExp, setNewCodeExp] = useState('250');
  const [newCodeVipDays, setNewCodeVipDays] = useState('1');
  const [newCodeQuota, setNewCodeQuota] = useState('100');
  const [newCodeBroadcast, setNewCodeBroadcast] = useState(true);

  const loadBroadcastsAndNobar = async () => {
    try {
      const [bRes, nRes] = await Promise.all([
        fetch('/api/features/broadcast'),
        fetch('/api/features/nobar/rooms'),
      ]);
      const [bJson, nJson] = await Promise.all([bRes.json(), nRes.json()]);
      if (bJson?.ok && Array.isArray(bJson.broadcasts)) {
        setBroadcasts(bJson.broadcasts);
      }
      if (nJson?.ok && Array.isArray(nJson.rooms)) {
        setNobarRooms(nJson.rooms);
      }
    } catch {
      // Ignore transient error
    }
  };

  const loadAuthenticatedFeatures = async () => {
    const token = getStoredAuthToken();
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [sRes, qRes, rRes, cRes] = await Promise.all([
        fetch('/api/features/shop', { headers }),
        token ? fetch('/api/features/quests', { headers }) : Promise.resolve(null),
        token ? fetch('/api/features/redeem/codes', { headers }) : Promise.resolve(null),
        token ? fetch('/api/features/chest/status', { headers }) : Promise.resolve(null),
      ]);

      const sJson = await sRes.json();
      if (sJson?.ok && Array.isArray(sJson.items)) {
        setShopItems(sJson.items);
      }

      if (qRes) {
        const qJson = await qRes.json();
        if (qJson?.ok && Array.isArray(qJson.quests)) {
          setQuests(qJson.quests);
        }
      }

      if (rRes) {
        const rJson = await rRes.json();
        if (rJson?.ok && Array.isArray(rJson.codes)) {
          setRedeemCodes(rJson.codes);
        }
      }

      if (cRes) {
        const cJson = await cRes.json();
        if (cJson?.ok) {
          setFreeChestAvailable(Boolean(cJson.freeAvailableToday));
        }
      }
    } catch {
      // Ignore transient fetch errors
    }
  };

  useEffect(() => {
    void loadBroadcastsAndNobar();
    void loadAuthenticatedFeatures();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadBroadcastsAndNobar();
        if (modalOpen) {
          void loadAuthenticatedFeatures();
        }
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [user?.uid, modalOpen]);

  // Real-time WebSocket listener for Founder Broadcast & Active Nobar Rooms
  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(resolveWsUrl(`/ws/chat?token=${encodeURIComponent(token)}`));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (!data) return;
          if (data.type === 'broadcast:updated' && Array.isArray(data.broadcasts)) {
            setBroadcasts(data.broadcasts);
          } else if (data.type === 'nobar:rooms_updated' && data.room) {
            setNobarRooms((prev) => {
              const filtered = prev.filter((r) => r.roomId !== data.room.roomId);
              return [data.room, ...filtered];
            });
          }
        } catch {
          // Ignore malformed WS message
        }
      };
    } catch {
      // Ignore WS connection error
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
  }, [user?.uid]);

  const openModalWithTab = (tab: ModalTab, prefillRedeem?: string) => {
    setFeedback(null);
    setActiveTab(tab);
    if (prefillRedeem) {
      setRedeemInput(prefillRedeem);
    }
    setModalOpen(true);
    void loadAuthenticatedFeatures();
    void loadBroadcastsAndNobar();
  };

  const handleOpenLuckyChest = async () => {
    const token = getStoredAuthToken();
    if (!token || !user) {
      navigate('/profile');
      return;
    }

    setBusyActionId('open_chest');
    setFeedback(null);
    try {
      const res = await fetch('/api/features/chest/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal membuka Peti Harta.' });
      } else {
        playSoundEffect('levelUp');
        setFreeChestAvailable(false);
        setFeedback({ type: 'ok', text: json.message });
        if (json.user) applyUserSnapshot(json.user);
        await Promise.all([refreshUser(), loadAuthenticatedFeatures()]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    const token = getStoredAuthToken();
    if (!token || !user) {
      navigate('/profile');
      return;
    }

    setBusyActionId(questId);
    setFeedback(null);
    try {
      const res = await fetch('/api/features/quests/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal mengklaim misi.' });
      } else {
        playSoundEffect('levelUp');
        setFeedback({ type: 'ok', text: json.message });
        if (json.user) applyUserSnapshot(json.user);
        await Promise.all([refreshUser(), loadAuthenticatedFeatures()]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleBuyShopItem = async (itemId: string) => {
    const token = getStoredAuthToken();
    if (!token || !user) {
      navigate('/profile');
      return;
    }

    setBusyActionId(itemId);
    setFeedback(null);
    try {
      const res = await fetch('/api/features/shop/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal membeli item.' });
      } else {
        playSoundEffect('levelUp');
        setFeedback({ type: 'ok', text: json.message });
        if (json.user) applyUserSnapshot(json.user);
        await Promise.all([refreshUser(), loadAuthenticatedFeatures()]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRedeemCode = async (overrideCode?: string) => {
    const codeToClaim = String(overrideCode ?? redeemInput)
      .trim()
      .toUpperCase();
    if (!codeToClaim) return;

    const token = getStoredAuthToken();
    if (!token || !user) {
      navigate('/profile');
      return;
    }

    setBusyActionId(`redeem_${codeToClaim}`);
    setFeedback(null);
    try {
      const res = await fetch('/api/features/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: codeToClaim }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal mengklaim Kode Redeem.' });
      } else {
        playSoundEffect('levelUp');
        setRedeemInput('');
        setFeedback({ type: 'ok', text: json.message });
        if (json.user) applyUserSnapshot(json.user);
        await Promise.all([refreshUser(), loadAuthenticatedFeatures()]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateQuickNobarRoom = async () => {
    const token = getStoredAuthToken();
    if (!token || !user) {
      navigate('/profile');
      return;
    }

    const recentHistory = getLocalHistory();
    const latestWatched = recentHistory[0];
    if (!latestWatched) {
      setFeedback({
        type: 'err',
        text: 'Pilih dan putar salah satu episode anime/donghua terlebih dahulu untuk membuka Room Nobar!',
      });
      return;
    }

    setBusyActionId('create_nobar');
    setFeedback(null);
    try {
      const roomId = `room_${latestWatched.episodeId.slice(0, 32)}_${user.uid.slice(0, 5)}`;
      const res = await fetch('/api/features/nobar/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          title: `Nobar ${latestWatched.title} Ep ${latestWatched.episodeNumber}`,
          seriesTitle: latestWatched.title,
          episodeId: latestWatched.episodeId,
          mediaType: latestWatched.type,
          poster: latestWatched.poster,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok && json.room) {
        setModalOpen(false);
        navigate(
          `/watch/${json.room.mediaType}/${encodeURIComponent(
            json.room.episodeId
          )}?nobar=1&room=${encodeURIComponent(json.room.roomId)}`
        );
      } else {
        setFeedback({ type: 'err', text: json.error || 'Gagal membuat Room Nobar.' });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleFounderPostBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAuthToken();
    if (!token || !isFounder || !bcastMessage.trim()) return;

    setBusyActionId('post_bcast');
    setFeedback(null);
    try {
      const res = await fetch('/api/features/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: bcastTitle,
          message: bcastMessage,
          category: bcastCategory,
          redeemCode: bcastRedeemCode,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal mengirim pengumuman.' });
      } else {
        playSoundEffect('levelUp');
        setBcastMessage('');
        setBroadcasts(json.broadcasts || []);
        setFeedback({
          type: 'ok',
          text: 'Broadcast Pengumuman Founder berhasil dipublikasikan secara real-time ke semua user!',
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleFounderDeleteBroadcast = async (id: string) => {
    const token = getStoredAuthToken();
    if (!token || !isFounder) return;
    try {
      const res = await fetch(`/api/features/broadcast/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBroadcasts(json.broadcasts || []);
      }
    } catch {
      // Ignore error
    }
  };

  const handleFounderCreateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAuthToken();
    if (!token || !isFounder || !newCodeName.trim()) return;

    setBusyActionId('create_code');
    setFeedback(null);
    try {
      const res = await fetch('/api/features/redeem/codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: newCodeName.trim().toUpperCase(),
          description: newCodeDesc.trim(),
          coins: Number(newCodeCoins) || 0,
          exp: Number(newCodeExp) || 0,
          vipDays: Number(newCodeVipDays) || 0,
          maxClaims: Number(newCodeQuota) || 100,
          alsoBroadcast: newCodeBroadcast,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.error || 'Gagal membuat Kode Redeem.' });
      } else {
        playSoundEffect('levelUp');
        setNewCodeName('');
        setNewCodeDesc('');
        setFeedback({
          type: 'ok',
          text: `Kode Redeem ${json.code.code} berhasil dibuat${
            newCodeBroadcast ? ' & langsung diumumkan di Banner Beranda!' : '!'
          }`,
        });
        await Promise.all([loadAuthenticatedFeatures(), loadBroadcastsAndNobar()]);
      }
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menghubungi server.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleFounderDeleteRedeemCode = async (code: string) => {
    const token = getStoredAuthToken();
    if (!token || !isFounder) return;
    try {
      const res = await fetch(`/api/features/redeem/codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok && Array.isArray(json.codes)) {
        setRedeemCodes(json.codes);
      }
    } catch {
      // Ignore error
    }
  };

  const claimableQuestsCount = quests.filter((q) => q.completed && !q.claimed).length;
  const topBroadcast = broadcasts[0] || null;
  const unlockedFramesSet = new Set(user?.unlockedStreakFrames || []);

  const filteredShopItems = shopItems.filter((item) =>
    shopFilter === 'all' ? true : item.category === shopFilter
  );

  const renderBroadcastBanner = () => {
    if (!topBroadcast) return null;
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#261423] via-[#1C182B] to-[#172133] border border-amber-400/25 px-3.5 py-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/35 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-amber-300 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                  {topBroadcast.title}
                </span>
                <span className="text-[10px] text-slate-400 font-bold truncate">
                  oleh {topBroadcast.createdByName}
                </span>
              </div>
              <p className="text-xs text-slate-100 font-semibold mt-0.5 line-clamp-2 leading-snug">
                {topBroadcast.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {topBroadcast.redeemCode && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setActiveTab('redeem');
                  setRedeemInput(topBroadcast.redeemCode || '');
                  if (!inline) setModalOpen(true);
                }}
                className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-md transition-transform active:scale-95"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Klaim</span>
              </button>
            )}
            {isFounder && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setActiveTab('founder');
                  if (!inline) setModalOpen(true);
                }}
                className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-amber-200 text-[10px] font-extrabold"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTabButtons = (isInlineMode: boolean) => (
    <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar ${isInlineMode ? 'p-1' : ''}`}>
      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setActiveTab('quests');
        }}
        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-colors ${
          activeTab === 'quests'
            ? 'bg-emerald-500 text-slate-950 shadow'
            : isInlineMode
            ? 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-white/10'
            : 'bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <Target className="w-3.5 h-3.5" />
        <span>Misi Harian</span>
        {claimableQuestsCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
            {claimableQuestsCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setActiveTab('shop');
        }}
        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-colors ${
          activeTab === 'shop'
            ? 'bg-amber-400 text-slate-950 shadow'
            : isInlineMode
            ? 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-white/10'
            : 'bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <ShoppingBag className="w-3.5 h-3.5" />
        <span>Toko Koin</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setActiveTab('redeem');
        }}
        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-colors ${
          activeTab === 'redeem'
            ? 'bg-purple-500 text-white shadow'
            : isInlineMode
            ? 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-white/10'
            : 'bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <Ticket className="w-3.5 h-3.5" />
        <span>Kode Redeem</span>
      </button>

      <button
        type="button"
        onClick={() => {
          setFeedback(null);
          setActiveTab('nobar');
        }}
        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-colors ${
          activeTab === 'nobar'
            ? 'bg-rose-500 text-white shadow'
            : isInlineMode
            ? 'bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-white/10'
            : 'bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <Radio className="w-3.5 h-3.5" />
        <span>Nobar ({nobarRooms.length})</span>
      </button>

      {isFounder && (
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setActiveTab('founder');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1.5 transition-colors ${
            activeTab === 'founder'
              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow'
              : 'bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-300'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Panel Founder</span>
        </button>
      )}
    </div>
  );

  const renderFeedbackAlert = () => {
    if (!feedback) return null;
    return (
      <div
        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
          feedback.type === 'ok'
            ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-300'
            : 'bg-rose-500/15 border border-rose-500/35 text-rose-600 dark:text-rose-300'
        }`}
      >
        <span>{feedback.text}</span>
        <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderTabContent = () => (
    <div className="space-y-3">
              {/* TAB #3: MISI HARIAN & MINGGUAN */}
              {activeTab === 'quests' && (
                <div className="space-y-2.5">
                  {!user ? (
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                      <p className="text-xs font-bold text-slate-300">
                        Login terlebih dahulu untuk menyelesaikan Misi Harian dan mengumpulkan Koin &amp; EXP gratis!
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setModalOpen(false);
                          navigate('/profile');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-extrabold"
                      >
                        Login Sekarang
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* PETI HARTA HARIAN (DAILY LUCKY CHEST) */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/15 border border-amber-400/35 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500/25 border border-amber-400/40 flex items-center justify-center shrink-0">
                            <Gift className="w-6 h-6 text-amber-300 animate-bounce" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-extrabold text-amber-200">
                                Peti Harta Keberuntungan Harian
                              </h4>
                              {freeChestAvailable && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-black uppercase">
                                  1x Gratis!
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Menangkan 40–450 Koin, 80–700 EXP, atau Jackpot VIP Gratis!
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busyActionId === 'open_chest'}
                          onClick={handleOpenLuckyChest}
                          className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-extrabold shrink-0 shadow-md hover:opacity-95 disabled:opacity-50"
                        >
                          {busyActionId === 'open_chest'
                            ? 'Membuka...'
                            : freeChestAvailable
                            ? 'Buka Gratis!'
                            : 'Buka (50 Koin)'}
                        </button>
                      </div>

                      {quests.map((q) => {
                      const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                      return (
                        <div
                          key={q.id}
                          className="p-3.5 rounded-2xl bg-[#1A1E2B] border border-white/10 flex flex-col gap-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                    q.period === 'weekly'
                                      ? 'bg-purple-500/20 text-purple-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {q.period === 'weekly' ? 'Mingguan' : 'Harian'}
                                </span>
                                <h4 className="text-xs font-extrabold text-white">{q.title}</h4>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{q.description}</p>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-extrabold">
                                +{q.rewardCoins} Koin
                              </span>
                              <span className="text-[10px] text-sky-300 font-bold mt-0.5">
                                +{q.rewardExp} EXP
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span>Progres Misi</span>
                                <span>
                                  {q.progress}/{q.target} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {q.claimed ? (
                              <span className="h-8 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Diklaim
                              </span>
                            ) : q.completed ? (
                              <button
                                type="button"
                                disabled={busyActionId === q.id}
                                onClick={() => handleClaimQuest(q.id)}
                                className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[11px] font-extrabold shadow-md hover:opacity-95 disabled:opacity-50 shrink-0"
                              >
                                {busyActionId === q.id ? 'Mengklaim...' : 'Klaim Hadiah'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalOpen(false);
                                  navigate(q.actionLink);
                                }}
                                className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold shrink-0"
                              >
                                {q.actionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </>
                  )}
                </div>
              )}

              {/* TAB #4: TOKO KOIN (COIN SHOP) */}
              {activeTab === 'shop' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    {(['all', 'vip', 'exp', 'frame'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setShopFilter(cat)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-extrabold transition-colors ${
                          shopFilter === cat
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {cat === 'all'
                          ? 'Semua Item'
                          : cat === 'vip'
                          ? 'Paket VIP'
                          : cat === 'exp'
                          ? 'Booster EXP'
                          : 'Bingkai 3D'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredShopItems.map((item) => {
                      const alreadyOwned =
                        item.category === 'frame' &&
                        Boolean(item.frameId && unlockedFramesSet.has(item.frameId));
                      const isEquipped =
                        item.category === 'frame' && user?.activeBorder === item.frameId;

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-[#1A1E2B] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.category === 'frame' && item.frameId ? (
                              <AvatarDecoration
                                src={user?.photoUrl || ''}
                                alt={user?.name || 'ZS'}
                                size="md"
                                decorationId={item.frameId}
                                level={user?.level || 10}
                                isFounder={user?.role === 'founder'}
                              />
                            ) : (
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                  item.category === 'vip'
                                    ? 'bg-amber-500/15 border-amber-400/35 text-amber-300'
                                    : 'bg-sky-500/15 border-sky-400/35 text-sky-300'
                                }`}
                              >
                                {item.category === 'vip' ? (
                                  <Crown className="w-6 h-6" />
                                ) : (
                                  <Zap className="w-6 h-6" />
                                )}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-extrabold text-white">{item.name}</h4>
                                {item.badgeTag && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">
                                    {item.badgeTag}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={busyActionId === item.id || isEquipped}
                            onClick={() => handleBuyShopItem(item.id)}
                            className={`h-9 px-3.5 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-1 transition-all ${
                              isEquipped
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                                : alreadyOwned
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-md hover:opacity-95'
                            } disabled:opacity-50`}
                          >
                            {busyActionId === item.id ? (
                              <span>Proses...</span>
                            ) : isEquipped ? (
                              <span>Terpasang</span>
                            ) : alreadyOwned ? (
                              <span>Pasang</span>
                            ) : (
                              <>
                                <Coins className="w-3.5 h-3.5" />
                                <span>{item.coinCost.toLocaleString('id-ID')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB #6: KODE REDEEM (GIFT CODE) */}
              {activeTab === 'redeem' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-[#1A1E2B] border border-purple-500/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-400" />
                      <div>
                        <h4 className="text-xs font-extrabold text-white">
                          Klaim Kode Redeem Founder
                        </h4>
                        <p className="text-[11px] text-slate-300">
                          Masukkan kode unik untuk mendapatkan Koin, EXP, atau VIP Gratis secara instan!
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={redeemInput}
                        onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                        placeholder="Contoh: ZONESTREAMBERKAH"
                        className="flex-1 h-10 px-3.5 rounded-xl bg-black/40 border border-white/15 text-xs font-extrabold tracking-wider text-white uppercase placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        disabled={!redeemInput.trim() || Boolean(busyActionId)}
                        onClick={() => handleRedeemCode()}
                        className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-extrabold shadow-lg disabled:opacity-50"
                      >
                        {busyActionId?.startsWith('redeem_') ? 'Mengklaim...' : 'Klaim Sekarang'}
                      </button>
                    </div>
                  </div>

                  {/* Active Public Redeem Codes List */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-extrabold text-slate-300">
                      Kode Redeem Aktif yang Tersedia:
                    </h5>
                    {redeemCodes.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Belum ada kode publik aktif saat ini. Pantau terus Broadcast Founder!
                      </p>
                    ) : (
                      redeemCodes.map((c) => {
                        const claimedCount = c.claimedCount ?? c.claimedBy?.length ?? 0;
                        const isClaimed =
                          c.alreadyClaimed ||
                          Boolean(user && Array.isArray(c.claimedBy) && c.claimedBy.includes(user.uid));
                        return (
                          <div
                            key={c.code}
                            className="p-3 rounded-2xl bg-[#1A1E2B] border border-white/10 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/35 text-purple-300 font-mono text-xs font-extrabold">
                                  {c.code}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  Kuota: {claimedCount}/{c.maxClaims}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1">{c.description}</p>
                            </div>

                            {isClaimed ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 text-[11px] font-extrabold shrink-0">
                                Sudah Diklaim
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRedeemCode(c.code)}
                                disabled={Boolean(busyActionId)}
                                className="h-8 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-[11px] font-extrabold shrink-0"
                              >
                                Klaim 1-Klik
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB #2: ROOM NOBAR (WATCH PARTY) */}
              {activeTab === 'nobar' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 to-orange-500/15 border border-rose-500/30 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-rose-400" />
                        <span>Nobar (Watch Party) Real-Time</span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Tonton anime &amp; donghua bareng teman/guild dengan posisi detik ter-sinkronisasi &amp; live chat!
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyActionId === 'create_nobar'}
                      onClick={handleCreateQuickNobarRoom}
                      className="h-9 px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold shrink-0 flex items-center gap-1 shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Room</span>
                    </button>
                  </div>

                  {nobarRooms.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#1A1E2B] border border-white/10 text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-300">
                        Belum ada Room Nobar yang sedang live detik ini.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Buka episode anime/donghua mana saja lalu klik ikon <strong>Watch Party (Nobar)</strong> atau klik tombol <strong>Buat Room</strong> di atas!
                      </p>
                    </div>
                  ) : (
                    nobarRooms.map((room) => (
                      <div
                        key={room.roomId}
                        className="p-3 rounded-2xl bg-[#1A1E2B] border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {room.poster ? (
                            <img
                              src={resolveApiUrl(room.poster)}
                              alt={room.seriesTitle}
                              className="w-12 h-16 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                          ) : (
                            <AvatarDecoration
                              src={room.hostPhotoUrl}
                              alt={room.hostName}
                              size="md"
                              decorationId={room.hostBorder}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                {room.onlineCount} Penonton
                              </span>
                              {room.clanTag && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">
                                  [{room.clanTag}]
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-extrabold text-white truncate mt-1">
                              {room.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              Host: <strong className="text-slate-200">{room.hostName}</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setModalOpen(false);
                            navigate(
                              `/watch/${room.mediaType}/${encodeURIComponent(
                                room.episodeId
                              )}?nobar=1&room=${encodeURIComponent(room.roomId)}`
                            );
                          }}
                          className="h-9 px-3.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold shrink-0 flex items-center gap-1 shadow"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Gabung</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB #5 & #6: PANEL KHUSUS FOUNDER */}
              {activeTab === 'founder' && isFounder && (
                <div className="space-y-5">
                  {/* Form Broadcast Pengumuman Founder */}
                  <form
                    onSubmit={handleFounderPostBroadcast}
                    className="p-4 rounded-2xl bg-[#1A1E2B] border border-amber-500/30 space-y-3"
                  >
                    <h4 className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <Megaphone className="w-4 h-4" />
                      <span>Kirim Broadcast Pengumuman Live (Beranda Semua User)</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={bcastTitle}
                        onChange={(e) => setBcastTitle(e.target.value)}
                        placeholder="Judul Banner (Misal: EVENT SPESIAL)"
                        className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={bcastRedeemCode}
                        onChange={(e) => setBcastRedeemCode(e.target.value.toUpperCase())}
                        placeholder="Kode Redeem (Opsional)"
                        className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white uppercase"
                      />
                    </div>

                    <textarea
                      rows={2}
                      value={bcastMessage}
                      onChange={(e) => setBcastMessage(e.target.value)}
                      placeholder="Tulis isi pengumuman yang akan tampil secara real-time di Beranda seluruh user..."
                      className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                    />

                    <button
                      type="submit"
                      disabled={busyActionId === 'post_bcast' || !bcastMessage.trim()}
                      className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-extrabold shadow disabled:opacity-50"
                    >
                      {busyActionId === 'post_bcast'
                        ? 'Mempublikasikan...'
                        : 'Publikasikan Broadcast Sekarang'}
                    </button>

                    {broadcasts.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400">
                          Pengumuman Aktif Saat Ini:
                        </span>
                        {broadcasts.map((b) => (
                          <div
                            key={b.id}
                            className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-extrabold text-amber-300 truncate">
                                {b.title}
                              </p>
                              <p className="text-[10px] text-slate-300 truncate">{b.message}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFounderDeleteBroadcast(b.id)}
                              className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </form>

                  {/* Form Buat Kode Redeem Baru */}
                  <form
                    onSubmit={handleFounderCreateRedeemCode}
                    className="p-4 rounded-2xl bg-[#1A1E2B] border border-purple-500/30 space-y-3"
                  >
                    <h4 className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                      <Ticket className="w-4 h-4" />
                      <span>Buat Kode Redeem (Gift Code) Baru</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newCodeName}
                        onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                        placeholder="Nama Kode (Misal: JUMATBERKAH)"
                        className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs font-extrabold text-white uppercase"
                      />
                      <input
                        type="text"
                        value={newCodeDesc}
                        onChange={(e) => setNewCodeDesc(e.target.value)}
                        placeholder="Deskripsi singkat"
                        className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Hadiah Koin</label>
                        <input
                          type="number"
                          value={newCodeCoins}
                          onChange={(e) => setNewCodeCoins(e.target.value)}
                          className="w-full h-8 px-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Hadiah EXP</label>
                        <input
                          type="number"
                          value={newCodeExp}
                          onChange={(e) => setNewCodeExp(e.target.value)}
                          className="w-full h-8 px-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Hari VIP</label>
                        <input
                          type="number"
                          value={newCodeVipDays}
                          onChange={(e) => setNewCodeVipDays(e.target.value)}
                          className="w-full h-8 px-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400">Kuota Klaim</label>
                        <input
                          type="number"
                          value={newCodeQuota}
                          onChange={(e) => setNewCodeQuota(e.target.value)}
                          className="w-full h-8 px-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCodeBroadcast}
                        onChange={(e) => setNewCodeBroadcast(e.target.checked)}
                        className="rounded border-white/20"
                      />
                      <span>Umumkan otomatis Kode Redeem ini di Banner Broadcast Beranda</span>
                    </label>

                    <button
                      type="submit"
                      disabled={busyActionId === 'create_code' || !newCodeName.trim()}
                      className="w-full h-9 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-extrabold shadow disabled:opacity-50"
                    >
                      {busyActionId === 'create_code' ? 'Membuat Kode...' : 'Buat & Aktifkan Kode Redeem'}
                    </button>

                    {redeemCodes.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400">
                          Daftar Semua Kode Redeem:
                        </span>
                        {redeemCodes.map((c) => (
                          <div
                            key={c.code}
                            className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-extrabold text-purple-300 font-mono">
                                {c.code}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-2">
                                (+{c.coins} Koin, +{c.exp} EXP, +{c.vipDays}d VIP · Diklaim:{' '}
                                {c.claimedBy?.length ?? c.claimedCount ?? 0}/{c.maxClaims})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFounderDeleteRedeemCode(c.code)}
                              className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </form>
                </div>
              )}
    </div>
  );

  if (inline) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Header with coins & level badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E84A18] to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Pusat Aktivitas &amp; Hadiah
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                Misi Harian · Toko Koin · Gift Code · Ruang Nobar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-extrabold">
              <Coins className="w-3.5 h-3.5" />
              {(user?.coins ?? 0).toLocaleString('id-ID')} Koin
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-300 text-xs font-bold">
              Lv.{user?.role === 'founder' ? 'MAX' : user?.level || 1}
            </span>
          </div>
        </div>

        {/* Top broadcast banner if present */}
        {renderBroadcastBanner()}

        {/* Tab selection buttons */}
        <div className="bg-slate-100/80 dark:bg-[#151823] p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10">
          {renderTabButtons(true)}
        </div>

        {/* Feedback alert */}
        {renderFeedbackAlert()}

        {/* Active tab content */}
        <div className="pt-1">
          {renderTabContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              Pusat Misi &amp; Hadiah Komunitas
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold hidden sm:inline">
            Toko Koin, Misi Harian &amp; Room Nobar
          </span>
        </div>
      )}

      {renderBroadcastBanner()}

      {/* QUICK ACCESS BAR: #3 MISI HARIAN, #4 TOKO KOIN, #6 KODE REDEEM, #2 ROOM NOBAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => openModalWithTab('quests')}
          className="relative p-3 rounded-2xl bg-white dark:bg-[#161822] hover:bg-slate-50 dark:hover:bg-[#1C1F2B] border border-slate-200/80 dark:border-white/[0.08] flex items-center sm:flex-col sm:justify-center gap-2.5 sm:gap-1.5 text-left sm:text-center transition-all active:scale-[0.98] shadow-sm dark:shadow-none"
        >
          {claimableQuestsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
              {claimableQuestsCount}
            </span>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
              Misi Harian
            </span>
            <span className="block text-[10px] sm:text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 truncate">
              +Koin &amp; EXP
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => openModalWithTab('shop')}
          className="relative p-3 rounded-2xl bg-white dark:bg-[#161822] hover:bg-slate-50 dark:hover:bg-[#1C1F2B] border border-slate-200/80 dark:border-white/[0.08] flex items-center sm:flex-col sm:justify-center gap-2.5 sm:gap-1.5 text-left sm:text-center transition-all active:scale-[0.98] shadow-sm dark:shadow-none"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
              Toko Koin
            </span>
            <span className="block text-[10px] sm:text-[9px] text-amber-600 dark:text-amber-300 font-bold mt-0.5 truncate">
              {(user?.coins ?? 0).toLocaleString('id-ID')} Koin
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => openModalWithTab('redeem')}
          className="relative p-3 rounded-2xl bg-white dark:bg-[#161822] hover:bg-slate-50 dark:hover:bg-[#1C1F2B] border border-slate-200/80 dark:border-white/[0.08] flex items-center sm:flex-col sm:justify-center gap-2.5 sm:gap-1.5 text-left sm:text-center transition-all active:scale-[0.98] shadow-sm dark:shadow-none"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
              Gift Code
            </span>
            <span className="block text-[10px] sm:text-[9px] text-purple-600 dark:text-purple-300 font-bold mt-0.5 truncate">
              Klaim Hadiah
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => openModalWithTab('nobar')}
          className="relative p-3 rounded-2xl bg-white dark:bg-[#161822] hover:bg-slate-50 dark:hover:bg-[#1C1F2B] border border-slate-200/80 dark:border-white/[0.08] flex items-center sm:flex-col sm:justify-center gap-2.5 sm:gap-1.5 text-left sm:text-center transition-all active:scale-[0.98] shadow-sm dark:shadow-none"
        >
          {nobarRooms.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
              LIVE
            </span>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
              Room Nobar
            </span>
            <span className="block text-[10px] sm:text-[9px] text-rose-600 dark:text-rose-400 font-bold mt-0.5 truncate">
              {nobarRooms.length > 0 ? `${nobarRooms.length} Room Aktif` : 'Nobar Bareng'}
            </span>
          </div>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[88vh] rounded-t-3xl sm:rounded-3xl bg-[#13161F] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3.5 bg-[#191D2A] border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E84A18]/20 border border-[#E84A18]/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#E84A18]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">ZoneStream Hub &amp; Hadiah</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1 text-amber-300 font-extrabold">
                      <Coins className="w-3.5 h-3.5" />
                      {(user?.coins ?? 0).toLocaleString('id-ID')} Koin
                    </span>
                    <span>•</span>
                    <span className="text-sky-300 font-bold">
                      Lv.{user?.role === 'founder' ? 'MAX' : user?.level || 1} ({user?.exp || 0} EXP)
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-3 py-2 bg-[#151823] border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {renderTabButtons(false)}
            </div>

            {/* Feedback Banner */}
            {renderFeedbackAlert()}

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {renderTabContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
