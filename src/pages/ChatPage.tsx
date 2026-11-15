import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Crown,
  Lock,
  MessageCircle,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AvatarDecoration } from '../components/AvatarDecoration';
import {
  FREE_EMOJIS,
  StatusEmojiBadge,
  VIP_EMOJIS,
  VipStickerCard,
  renderCommentRichText,
} from '../components/VipEmojis';
import { useAuth } from '../context/AuthContext';
import type {
  ChatConversationSummary,
  ChatMessageItem,
  PublicCommunityUser,
  RelationshipStatus,
} from '../types';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

function getToken(): string {
  return (
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    ''
  );
}

function formatMsgTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'Hari Ini';
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ChatPage() {
  const { peerUid = '' } = useParams();
  const navigate = useNavigate();
  const { user: me, isPremium } = useAuth();
  const canUseVip = Boolean(isPremium || me?.role === 'founder');

  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState<PublicCommunityUser[]>([]);
  const [peer, setPeer] = useState<PublicCommunityUser | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>('none');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState('');
  const [selectedSticker, setSelectedSticker] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [sending, setSending] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!me) return;
    try {
      const res = await fetch('/api/social/conversations', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.conversations)) {
        setConversations(json.conversations);
      }
    } catch {
      // Ignore polling hiccup
    }
  }, [me?.uid]);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!me || !peerUid) return;
      if (!silent) setLoadingThread(true);
      try {
        const res = await fetch(`/api/social/messages/${encodeURIComponent(peerUid)}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json.ok) {
          setPeer(json.peer || null);
          setRelationship(json.relationship || 'none');
          setMessages(json.messages || []);
        }
      } catch {
        // Keep current thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, peerUid]
  );

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 5000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!peerUid) {
      setPeer(null);
      setMessages([]);
      return;
    }
    loadMessages(false);
    const t = setInterval(() => loadMessages(true), 2500);
    return () => clearInterval(t);
  }, [peerUid, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peerUid]);

  // Search new users right inside WhatsApp sidebar
  useEffect(() => {
    const q = sidebarSearch.trim();
    if (!q) {
      setFoundUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/social/users?q=${encodeURIComponent(q)}&limit=10`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.ok && Array.isArray(json.users)) {
          setFoundUsers(json.users.filter((u: PublicCommunityUser) => u.uid !== me?.uid));
        }
      } catch {
        setFoundUsers([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [sidebarSearch, me?.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !peerUid || sending) return;
    if (!draft.trim() && !selectedSticker) return;

    setSending(true);
    try {
      const res = await fetch(`/api/social/messages/${encodeURIComponent(peerUid)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          text: draft.trim(),
          sticker: selectedSticker,
          replyToId: replyTarget?._id || '',
          replySenderName: replyTarget
            ? replyTarget.senderUid === me.uid
              ? me.name
              : peer?.name || 'User'
            : '',
          replyText: replyTarget?.text || (replyTarget?.sticker ? '[Stiker VIP]' : ''),
        }),
      });
      const json = await res.json();
      if (res.ok && json.message) {
        setMessages((prev) => [...prev, json.message]);
        setDraft('');
        setSelectedSticker('');
        setReplyTarget(null);
        setShowEmojiDrawer(false);
        void loadConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    const res = await fetch(`/api/social/messages/${encodeURIComponent(msgId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
      void loadConversations();
    }
  };

  const handleFriendAction = async (action: 'request' | 'accept' | 'remove') => {
    if (!peer || friendBusy) return;
    setFriendBusy(true);
    try {
      const res = await fetch(`/api/social/friends/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ targetUid: peer.uid }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setRelationship(json.relationship);
        void loadConversations();
      }
    } finally {
      setFriendBusy(false);
    }
  };

  if (!me) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 pt-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Chat WhatsApp ZoneStream
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
            Masuk akun terlebih dahulu untuk mulai chatting, kirim stiker VIP, dan berteman dengan pengguna lain atau VerzonFounder.
          </p>
          <Link
            to="/profile"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#E84A18] text-white text-xs font-bold shadow-lg shadow-[#E84A18]/25"
          >
            Masuk / Daftar Sekarang
          </Link>
        </div>
      </Layout>
    );
  }

  const filteredConvos = sidebarSearch.trim()
    ? conversations.filter((c) => {
        const q = sidebarSearch.toLowerCase();
        return (
          c.peer.name.toLowerCase().includes(q) ||
          c.peer.username.toLowerCase().includes(q) ||
          c.peer.uid.includes(q)
        );
      })
    : conversations;

  return (
    <Layout hideBottomNav={Boolean(peerUid)}>
      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 sm:pt-4 pb-0 sm:pb-6">
        <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] min-h-[540px] sm:rounded-3xl overflow-hidden border-t sm:border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shadow-2xl flex">
          {/* LEFT PANE: WhatsApp Chat List */}
          <aside
            className={`${
              peerUid ? 'hidden md:flex' : 'flex'
            } w-full md:w-[340px] lg:w-[380px] flex-col border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shrink-0`}
          >
            {/* Sidebar Header */}
            <div className="h-16 px-4 bg-slate-50 dark:bg-[#202C33] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Link to="/profile" className="shrink-0">
                  <AvatarDecoration
                    src={me.photoUrl}
                    alt={me.name}
                    decorationId={me.activeBorder}
                    size="sm"
                  />
                </Link>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Obrolan
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                    ZoneStream Messenger
                  </p>
                </div>
              </div>

              <Link
                to="/community"
                className="px-3 py-1.5 rounded-xl bg-[#E84A18]/15 hover:bg-[#E84A18] text-[#E84A18] hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Cari User</span>
              </Link>
            </div>

            {/* Sidebar Search */}
            <div className="p-2.5 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111B21]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Cari obrolan atau user baru (nama/UID)..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-[#202C33] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E84A18]"
                />
              </div>
            </div>

            {/* Conversation + Quick User Results */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.05]">
              {filteredConvos.map((c) => {
                const active = c.peer.uid === peerUid;
                const pVip = Boolean(c.peer.isPremium || c.peer.role === 'founder');
                return (
                  <Link
                    key={c.peer.uid}
                    to={`/chat/${c.peer.uid}`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      active
                        ? 'bg-[#E84A18]/10 dark:bg-[#2A3942]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#202C33]/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <AvatarDecoration
                        src={c.peer.photoUrl}
                        alt={c.peer.name}
                        decorationId={c.peer.activeBorder}
                        size="md"
                      >
                        {c.peer.isOnline && (
                          <span className="absolute bottom-0 right-0 z-30 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111B21]" />
                        )}
                      </AvatarDecoration>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {c.peer.name}
                          </span>
                          {pVip && (
                            <VerifiedBadge
                              size="sm"
                              isFounder={c.peer.role === 'founder'}
                              badgeLabel={c.peer.activeBadge}
                            />
                          )}
                          {pVip && c.peer.statusEmoji && (
                            <StatusEmojiBadge statusEmoji={c.peer.statusEmoji} size="xs" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-gray-400 font-mono-tabular shrink-0">
                          {formatMsgTime(c.lastMessage?.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 dark:text-gray-400 truncate flex items-center gap-1">
                          {c.lastMessage ? (
                            <>
                              {c.lastMessage.senderUid === me.uid && (
                                <CheckCheck
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    c.lastMessage.readAt ? 'text-sky-400' : 'text-slate-400'
                                  }`}
                                />
                              )}
                              <span className="truncate">
                                {c.lastMessage.text ||
                                  (c.lastMessage.sticker ? 'Mengirim Stiker VIP' : '')}
                              </span>
                            </>
                          ) : (
                            <span className="italic">Teman · Mulai obrolan</span>
                          )}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25D366] text-[#0B141A] text-[10px] font-extrabold flex items-center justify-center font-mono-tabular shrink-0">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Also show matching users from global search to start a new chat instantly */}
              {sidebarSearch.trim() && foundUsers.length > 0 && (
                <div className="bg-slate-50/70 dark:bg-[#0D1418] pt-2">
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-[#E84A18]">
                    Mulai Chat Baru
                  </p>
                  {foundUsers
                    .filter((u) => !conversations.some((c) => c.peer.uid === u.uid))
                    .map((u) => (
                      <Link
                        key={u.uid}
                        to={`/chat/${u.uid}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-[#202C33] transition-colors"
                      >
                        <img
                          src={u.photoUrl || defaultAvatarImg}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {u.name}
                            </span>
                            {(u.isPremium || u.role === 'founder') && (
                              <VerifiedBadge
                                size="sm"
                                isFounder={u.role === 'founder'}
                                badgeLabel={u.activeBadge}
                              />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            @{u.username} · UID: {u.uid}
                          </p>
                        </div>
                      </Link>
                    ))}
                </div>
              )}

              {filteredConvos.length === 0 && !sidebarSearch.trim() && (
                <div className="p-8 text-center space-y-3">
                  <MessageCircle className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Belum ada obrolan aktif. Cari teman atau chat VerzonFounder (UID: 00000)!
                  </p>
                  <div className="flex flex-col gap-2">
                    {me.uid !== '00000' && (
                      <Link
                        to="/chat/00000"
                        className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
                      >
                        Chat VerzonFounder
                      </Link>
                    )}
                    <Link
                      to="/community"
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202C33] text-slate-700 dark:text-gray-200 text-xs font-bold"
                    >
                      Cari Semua User
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT PANE: WhatsApp Conversation Room */}
          <section
            className={`${
              peerUid ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 relative`}
          >
            {!peerUid ? (
              <div className="flex-1 wa-wallpaper flex flex-col items-center justify-center p-8 text-center">
                <div className="max-w-sm rounded-3xl bg-white/90 dark:bg-[#111B21]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 shadow-xl space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    ZoneStream Messenger
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                    Pilih teman di sebelah kiri untuk mulai mengobrol gaya WhatsApp lengkap dengan centang biru, balas pesan, dan stiker eksklusif VIP.
                  </p>
                  <Link
                    to="/community"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
                  >
                    <Users className="w-4 h-4" />
                    <span>Temukan Teman Baru</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Top Bar */}
                <div className="h-16 px-3 sm:px-5 bg-slate-50 dark:bg-[#202C33] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="md:hidden min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Kembali ke daftar obrolan"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    {peer && (
                      <Link
                        to={`/u/${peer.uid}`}
                        className="flex items-center gap-2.5 min-w-0 group"
                      >
                        <div className="relative shrink-0">
                          <AvatarDecoration
                            src={peer.photoUrl}
                            alt={peer.name}
                            decorationId={peer.activeBorder}
                            size="sm"
                          >
                            {peer.isOnline && (
                              <span className="absolute bottom-0 right-0 z-30 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#202C33]" />
                            )}
                          </AvatarDecoration>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#E84A18] truncate">
                              {peer.name}
                            </span>
                            {(peer.isPremium || peer.role === 'founder') && (
                              <VerifiedBadge
                                size="sm"
                                isFounder={peer.role === 'founder'}
                                badgeLabel={peer.activeBadge}
                              />
                            )}
                            {(peer.isPremium || peer.role === 'founder') && peer.statusEmoji && (
                              <StatusEmojiBadge statusEmoji={peer.statusEmoji} size="xs" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {peer.isOnline
                              ? 'Online'
                              : `UID: ${peer.uid} · ${peer.role === 'founder' ? 'Lv. ∞' : `Lv. ${peer.level}`}`}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>

                  {peer && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {relationship === 'none' && (
                        <button
                          type="button"
                          disabled={friendBusy}
                          onClick={() => handleFriendAction('request')}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white/10 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Tambah Teman</span>
                        </button>
                      )}
                      {relationship === 'pending_received' && (
                        <button
                          type="button"
                          disabled={friendBusy}
                          onClick={() => handleFriendAction('accept')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Terima Teman</span>
                        </button>
                      )}
                      {relationship === 'friend' && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[11px] font-bold">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Teman</span>
                        </span>
                      )}
                      <Link
                        to={`/u/${peer.uid}`}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 hover:border-[#E84A18]"
                      >
                        Profil
                      </Link>
                    </div>
                  )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-6 py-4 space-y-2.5">
                  {loadingThread ? (
                    <div className="py-12 text-center text-xs text-slate-500 dark:text-gray-300">
                      Memuat riwayat pesan...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Mulai percakapan dengan {peer?.name || 'pengguna ini'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">
                        Kirim salam, ajak nonton bareng, atau kirim stiker eksklusif!
                      </p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isMine = m.senderUid === me.uid;
                      const prevDay =
                        idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : '';
                      const curDay = new Date(m.createdAt).toDateString();
                      const showDayChip = idx === 0 || prevDay !== curDay;

                      return (
                        <React.Fragment key={m._id}>
                          {showDayChip && (
                            <div className="flex justify-center my-2">
                              <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-[#182229] text-[10px] font-bold text-slate-600 dark:text-gray-300 shadow-sm">
                                {formatDayLabel(m.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`flex items-end gap-1.5 group ${
                              isMine ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {isMine && (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => setReplyTarget(m)}
                                  className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40"
                                  aria-label="Balas"
                                >
                                  <Reply className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMsg(m._id)}
                                  className="p-1.5 rounded-full bg-black/20 text-white hover:bg-rose-600"
                                  aria-label="Hapus"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <div
                              className={`max-w-[80%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-sm ${
                                isMine
                                  ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-900 dark:text-white rounded-br-sm'
                                  : 'bg-white dark:bg-[#202C33] text-slate-900 dark:text-white rounded-bl-sm'
                              }`}
                            >
                              {m.replyText && (
                                <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-black/25 border-l-2 border-[#E84A18] text-[11px]">
                                  <p className="font-bold text-[#E84A18] truncate">
                                    {m.replySenderName || 'Pesan'}
                                  </p>
                                  <p className="text-slate-600 dark:text-gray-300 truncate">
                                    {m.replyText}
                                  </p>
                                </div>
                              )}

                              {m.sticker && (
                                <div className="mb-1">
                                  <VipStickerCard stickerId={m.sticker} />
                                </div>
                              )}

                              {m.text && (
                                <p className="text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
                                  {renderCommentRichText(m.text)}
                                </p>
                              )}

                              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-gray-300/80 font-mono-tabular">
                                <span>{formatMsgTime(m.createdAt)}</span>
                                {isMine && (
                                  <CheckCheck
                                    className={`w-3.5 h-3.5 ${
                                      m.readAt
                                        ? 'text-sky-500 dark:text-sky-400'
                                        : 'text-slate-400 dark:text-gray-400'
                                    }`}
                                  />
                                )}
                              </div>
                            </div>

                            {!isMine && (
                              <button
                                type="button"
                                onClick={() => setReplyTarget(m)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 transition-opacity"
                                aria-label="Balas"
                              >
                                <Reply className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply / Selected Sticker Preview */}
                {(replyTarget || selectedSticker) && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      {replyTarget && (
                        <div className="truncate">
                          <span className="font-bold text-[#E84A18]">
                            Membalas{' '}
                            {replyTarget.senderUid === me.uid ? me.name : peer?.name}:{' '}
                          </span>
                          <span className="text-slate-600 dark:text-gray-300">
                            {replyTarget.text || '[Stiker VIP]'}
                          </span>
                        </div>
                      )}
                      {selectedSticker && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                          Stiker VIP dipilih
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget(null);
                        setSelectedSticker('');
                      }}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Emoji & VIP Stickers Drawer */}
                {showEmojiDrawer && (
                  <div className="p-3 bg-white dark:bg-[#1B252C] border-t border-slate-200 dark:border-white/[0.06] max-h-56 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2.5">
                      <button
                        type="button"
                        onClick={() => setEmojiTab('free')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          emojiTab === 'free'
                            ? 'bg-[#E84A18] text-white'
                            : 'bg-slate-100 dark:bg-[#2A3942] text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        Emoji Umum
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmojiTab('vip')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                          emojiTab === 'vip'
                            ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white'
                            : 'bg-slate-100 dark:bg-[#2A3942] text-amber-600 dark:text-amber-300'
                        }`}
                      >
                        <Crown className="w-3 h-3" />
                        <span>Stiker VIP</span>
                      </button>
                    </div>

                    {emojiTab === 'free' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {FREE_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setDraft((p) => `${p}${em}`)}
                            className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#2A3942] hover:scale-110 text-lg flex items-center justify-center transition-transform"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    ) : canUseVip ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {VIP_EMOJIS.map((v) => {
                          const Icon = v.icon;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedSticker(v.id);
                                setShowEmojiDrawer(false);
                              }}
                              className={`p-2 rounded-xl border text-left flex items-center gap-1.5 hover:scale-[1.02] transition-transform ${v.bgClass} ${v.borderClass} ${v.textClass}`}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="text-[11px] font-bold truncate">{v.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                        <span className="text-slate-700 dark:text-gray-200 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-500" />
                          Stiker eksklusif khusus Member Premium.
                        </span>
                        <Link
                          to="/profile"
                          className="px-3 py-1 rounded-lg bg-[#E84A18] text-white font-bold"
                        >
                          Upgrade
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp Composer */}
                <form
                  onSubmit={handleSend}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#202C33] border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setShowEmojiDrawer((s) => !s)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      showEmojiDrawer
                        ? 'bg-[#E84A18] text-white'
                        : 'text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    aria-label="Emoji dan Stiker"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Ketik pesan untuk ${peer?.name || 'teman'}...`}
                    className="flex-1 h-10 px-4 rounded-full bg-white dark:bg-[#2A3942] border border-slate-200 dark:border-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E84A18]"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!draft.trim() && !selectedSticker)}
                    className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#06CF9C] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow"
                    aria-label="Kirim Pesan"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
