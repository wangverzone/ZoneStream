import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Crown,
  Image as ImageIcon,
  Lock,
  MessageCircle,
   Mic,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

function fileToCompressedDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(String(reader.result)); // fallback for videos/audio
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface GroupChatSummary {
  groupId: string;
  name: string;
  description: string;
  avatarUrl: string;
  creatorUid: string;
  members: string[];
  createdAt: string;
}

export function ChatPage() {
  const { peerUid = '', groupId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const isGroupRoom = Boolean(groupId || searchParams.get('group'));
  const activeChatId = groupId || searchParams.get('group') || peerUid;

  const navigate = useNavigate();
  const { user: me, isPremium } = useAuth();
  const canUseVip = Boolean(isPremium || me?.role === 'founder');

  const [chatTab, setChatTab] = useState<'dm' | 'group'>(isGroupRoom ? 'group' : 'dm');
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState<PublicCommunityUser[]>([]);

  const [peer, setPeer] = useState<PublicCommunityUser | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupChatSummary | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>('none');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState('');
  const [selectedSticker, setSelectedSticker] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' | 'audio' } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);

  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [isRecordingVn, setIsRecordingVn] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [sending, setSending] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    if (!me) return;
    try {
      const token = getToken();
      const [dmRes, grpRes] = await Promise.all([
        fetch('/api/social/conversations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/social/groups', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dmJson = await dmRes.json();
      const grpJson = await grpRes.json();
      if (dmJson.ok && Array.isArray(dmJson.conversations)) {
        setConversations(dmJson.conversations);
      }
      if (grpJson.ok && Array.isArray(grpJson.groups)) {
        setGroups(grpJson.groups);
      }
    } catch {
      // Ignore poll error
    }
  }, [me?.uid]);

  const loadDmThread = useCallback(
    async (silent = false) => {
      if (!me || !peerUid || isGroupRoom) return;
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
        // Keep thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, peerUid, isGroupRoom]
  );

  const loadGroupThread = useCallback(
    async (silent = false) => {
      const gId = groupId || searchParams.get('group');
      if (!me || !gId) return;
      if (!silent) setLoadingThread(true);
      try {
        const res = await fetch(`/api/social/groups/${encodeURIComponent(gId)}/messages`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json.ok) {
          setActiveGroup(json.group || null);
          setMessages(json.messages || []);
        }
      } catch {
        // Keep group thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, groupId, searchParams]
  );

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 6000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (isGroupRoom) {
      loadGroupThread(false);
      const t = setInterval(() => loadGroupThread(true), 3000);
      return () => clearInterval(t);
    } else if (peerUid) {
      loadDmThread(false);
      const t = setInterval(() => loadDmThread(true), 2500);
      return () => clearInterval(t);
    } else {
      setPeer(null);
      setActiveGroup(null);
      setMessages([]);
    }
  }, [peerUid, groupId, isGroupRoom, loadDmThread, loadGroupThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChatId]);

  // Search users for sidebar DM
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
    if (!me || sending) return;
    if (!draft.trim() && !selectedSticker && !mediaPreview) return;

    setSending(true);
    try {
      const endpoint = isGroupRoom
        ? `/api/social/groups/${encodeURIComponent(groupId || searchParams.get('group') || '')}/messages`
        : `/api/social/messages/${encodeURIComponent(peerUid)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          text: draft.trim(),
          sticker: selectedSticker,
          mediaUrl: mediaPreview?.url || '',
          mediaType: mediaPreview?.type || '',
          replyToId: replyTarget?._id || '',
          replySenderName: replyTarget
            ? replyTarget.senderUid === me.uid
              ? me.name
              : replyTarget.senderName || peer?.name || 'User'
            : '',
          replyText: replyTarget?.text || (replyTarget?.sticker ? '[Stiker VIP]' : replyTarget?.mediaType ? `[${replyTarget.mediaType}]` : ''),
        }),
      });
      const json = await res.json();
      if (res.ok && json.message) {
        setMessages((prev) => [...prev, json.message]);
        setDraft('');
        setSelectedSticker('');
        setMediaPreview(null);
        setReplyTarget(null);
        setShowEmojiDrawer(false);
        void loadConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToCompressedDataUrl(file, type === 'image' ? 1200 : 1280);
    setMediaPreview({ url: dataUrl, type });
  };

  const startVnRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setMediaPreview({ url: String(reader.result), type: 'audio' });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVn(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert('Gagal mengakses mikrofon untuk VN. Pastikan izin browser diaktifkan.');
    }
  };

  const stopVnRecording = () => {
    if (mediaRecorderRef.current && isRecordingVn) {
      mediaRecorderRef.current.stop();
      setIsRecordingVn(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/social/groups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          avatarUrl: newGroupAvatar.trim(),
          members: [],
        }),
      });
      const json = await res.json();
      if (res.ok && json.group) {
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupAvatar('');
        void loadConversations();
        navigate(`/chat?group=${json.group.groupId}`);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleChangeGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const gId = groupId || searchParams.get('group');
    const file = e.target.files?.[0];
    if (!file || !gId) return;
    const dataUrl = await fileToCompressedDataUrl(file, 800);
    try {
      const res = await fetch(`/api/social/groups/${encodeURIComponent(gId)}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      const json = await res.json();
      if (res.ok && json.avatarUrl) {
        setActiveGroup((prev) => (prev ? { ...prev, avatarUrl: json.avatarUrl } : prev));
        void loadConversations();
      }
    } catch {
      // Ignore
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
            Chat &amp; Grup WhatsApp ZoneStream
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
            Masuk akun terlebih dahulu untuk mulai chatting pribadi, buat grup anime &amp; donghua, kirim foto, video, VN, dan stiker VIP.
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

  const filteredGroups = sidebarSearch.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : groups;

  return (
    <Layout hideBottomNav={Boolean(peerUid || isGroupRoom)}>
      <input
        ref={groupAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleChangeGroupAvatar}
        className="hidden"
      />

      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 sm:pt-4 pb-0 sm:pb-6">
        <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] min-h-[560px] sm:rounded-3xl overflow-hidden border-t sm:border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shadow-2xl flex">
          {/* LEFT PANE: WhatsApp Inbox & Group List */}
          <aside
            className={`${
              peerUid || isGroupRoom ? 'hidden md:flex' : 'flex'
            } w-full md:w-[350px] lg:w-[390px] flex-col border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shrink-0`}
          >
            {/* Header & Tabs */}
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
                    WhatsApp Chat
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                    Online · {groups.length} Grup
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center gap-1 shadow transition-colors"
                  title="Buat Grup WhatsApp Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Grup</span>
                </button>
              </div>
            </div>

            {/* DM vs Group Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-[#111B21] border-b border-slate-200 dark:border-white/[0.06] gap-1">
              <button
                type="button"
                onClick={() => setChatTab('dm')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  chatTab === 'dm'
                    ? 'bg-white dark:bg-[#202C33] text-[#E84A18] shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Chat Pribadi ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setChatTab('group')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  chatTab === 'group'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Grup WhatsApp ({groups.length})
              </button>
            </div>

            {/* Sidebar Search */}
            <div className="p-2.5 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#111B21]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder={
                    chatTab === 'dm'
                      ? 'Cari obrolan atau user baru (nama/UID)...'
                      : 'Cari nama grup WhatsApp...'
                  }
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-[#202C33] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                />
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.05]">
              {chatTab === 'dm' ? (
                <>
                  {filteredConvos.map((c) => {
                    const active = c.peer.uid === peerUid && !isGroupRoom;
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
                                <span className="italic">Mulai obrolan baru</span>
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

                  {sidebarSearch.trim() && foundUsers.length > 0 && (
                    <div className="bg-slate-50/70 dark:bg-[#0D1418] pt-2">
                      <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-[#E84A18]">
                        Hasil Pencarian User
                      </p>
                      {foundUsers.map((u) => (
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
                        Belum ada obrolan pribadi. Cari user atau chat VerzonFounder (UID: 00000)!
                      </p>
                      <Link
                        to="/chat/00000"
                        className="inline-block px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
                      >
                        Chat VerzonFounder
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {filteredGroups.map((g) => {
                    const active = (groupId || searchParams.get('group')) === g.groupId;
                    return (
                      <Link
                        key={g.groupId}
                        to={`/chat?group=${g.groupId}`}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          active
                            ? 'bg-[#00A884]/15 dark:bg-[#2A3942]'
                            : 'hover:bg-slate-50 dark:hover:bg-[#202C33]/70'
                        }`}
                      >
                        <img
                          src={g.avatarUrl || defaultAvatarImg}
                          alt={g.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/20 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {g.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#00A884]/20 text-[#00A884] text-[10px] font-bold">
                              Grup
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">
                            {g.description || `${g.members?.length || 1} Anggota`}
                          </p>
                        </div>
                      </Link>
                    );
                  })}

                  {filteredGroups.length === 0 && (
                    <div className="p-8 text-center space-y-3">
                      <Users className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto" />
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        Belum ada grup WhatsApp. Buat grup baru sekarang untuk nonton bareng &amp; diskusi anime!
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCreateGroupModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#00A884] text-white text-xs font-bold"
                      >
                        Buat Grup WhatsApp
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* RIGHT PANE: WhatsApp Room (DM or Group) */}
          <section
            className={`${
              peerUid || isGroupRoom ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 relative`}
          >
            {!peerUid && !isGroupRoom ? (
              <div className="flex-1 wa-wallpaper flex flex-col items-center justify-center p-8 text-center">
                <div className="max-w-sm rounded-3xl bg-white/90 dark:bg-[#111B21]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 shadow-xl space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00A884]/15 text-[#00A884] flex items-center justify-center">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    ZoneStream WhatsApp Messenger
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                    Pilih chat pribadi atau buat Grup WhatsApp untuk mengirim pesan teks, foto, video, VN (Voice Note), dan stiker VIP tanpa batas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00A884] text-white text-xs font-bold shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Grup WhatsApp Baru</span>
                  </button>
                </div>
              </div>
            ) : isGroupRoom ? (
              /* GROUP CHAT ROOM */
              <>
                <div className="h-16 px-3 sm:px-5 bg-slate-50 dark:bg-[#202C33] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="md:hidden min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    {activeGroup && (
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative group">
                          <img
                            src={activeGroup.avatarUrl || defaultAvatarImg}
                            alt={activeGroup.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => groupAvatarInputRef.current?.click()}
                            title="Ganti Foto Profil Grup"
                            className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {activeGroup.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#00A884]/20 text-[#00A884] text-[10px] font-bold">
                              Grup WhatsApp
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {activeGroup.description || `${activeGroup.members?.length || 1} Anggota`} · Klik foto grup untuk ganti PP
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-[#00A884] hover:text-white text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ubah Foto Grup</span>
                  </button>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-6 py-4 space-y-2.5">
                  {loadingThread ? (
                    <div className="py-12 text-center text-xs text-slate-500">Memuat pesan grup...</div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Grup WhatsApp {activeGroup?.name} berhasil dibuat!
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">
                        Kirim teks, foto, video, atau rekaman suara VN sekarang.
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMine = m.senderUid === me.uid;
                      return (
                        <div
                          key={m._id}
                          className={`flex items-end gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMine && (
                            <img
                              src={m.senderPhoto || defaultAvatarImg}
                              alt={m.senderName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover shrink-0 mb-1"
                            />
                          )}

                          <div
                            className={`max-w-[80%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-sm ${
                              isMine
                                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-900 dark:text-white rounded-br-sm'
                                : 'bg-white dark:bg-[#202C33] text-slate-900 dark:text-white rounded-bl-sm'
                            }`}
                          >
                            {!isMine && (
                              <p className="text-[11px] font-bold text-[#E84A18] mb-0.5">
                                {m.senderName}
                              </p>
                            )}

                            {m.mediaType === 'image' && m.mediaUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black">
                                <img src={m.mediaUrl} alt="Media" className="w-full h-auto object-cover max-h-64" />
                              </div>
                            )}

                            {m.mediaType === 'video' && m.mediaUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black">
                                <video src={m.mediaUrl} controls className="w-full max-h-64 object-contain" />
                              </div>
                            )}

                            {m.mediaType === 'audio' && m.mediaUrl && (
                              <div className="mb-2 py-1 flex items-center gap-2">
                                <audio src={m.mediaUrl} controls className="h-9 w-52 sm:w-64" />
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
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Media Preview Bar */}
                {mediaPreview && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {mediaPreview.type === 'image' && (
                        <img src={mediaPreview.url} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      {mediaPreview.type === 'video' && <Video className="w-5 h-5 text-[#00A884]" />}
                      {mediaPreview.type === 'audio' && <Mic className="w-5 h-5 text-[#00A884]" />}
                      <span className="font-bold text-slate-800 dark:text-white truncate">
                        Lampiran {mediaPreview.type.toUpperCase()} siap dikirim
                      </span>
                    </div>
                    <button type="button" onClick={() => setMediaPreview(null)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* WhatsApp Composer for Groups */}
                <form
                  onSubmit={handleSend}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#202C33] border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2 shrink-0"
                >
                  <label className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0" title="Kirim Foto">
                    <ImageIcon className="w-5 h-5 text-[#00A884]" />
                    <input type="file" accept="image/*" onChange={(e) => handleMediaUpload(e, 'image')} className="hidden" />
                  </label>

                  <label className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0" title="Kirim Video">
                    <Video className="w-5 h-5 text-[#00A884]" />
                    <input type="file" accept="video/*" onChange={(e) => handleMediaUpload(e, 'video')} className="hidden" />
                  </label>

                  {isRecordingVn ? (
                    <div className="flex-1 flex items-center gap-2 px-4 h-10 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Merekam VN ({recordingSeconds}s)...</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Ketik pesan grup WhatsApp..."
                      className="flex-1 h-10 px-4 rounded-full bg-white dark:bg-[#2A3942] border border-slate-200 dark:border-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                    />
                  )}

                  {isRecordingVn ? (
                    <button
                      type="button"
                      onClick={stopVnRecording}
                      className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shrink-0 shadow"
                      title="Selesai Rekam VN"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startVnRecording}
                      className="w-10 h-10 rounded-full text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
                      title="Rekam Voice Note (VN)"
                    >
                      <Mic className="w-5 h-5 text-[#00A884]" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={sending || (!draft.trim() && !mediaPreview && !selectedSticker)}
                    className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#06CF9C] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow"
                    aria-label="Kirim"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              /* DM CHAT ROOM */
              <>
                <div className="h-16 px-3 sm:px-5 bg-slate-50 dark:bg-[#202C33] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="md:hidden min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    {peer && (
                      <Link to={`/u/${peer.uid}`} className="flex items-center gap-2.5 min-w-0 group">
                        <AvatarDecoration src={peer.photoUrl} alt={peer.name} decorationId={peer.activeBorder} size="sm">
                          {peer.isOnline && (
                            <span className="absolute bottom-0 right-0 z-30 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#202C33]" />
                          )}
                        </AvatarDecoration>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#E84A18] truncate">
                              {peer.name}
                            </span>
                            {(peer.isPremium || peer.role === 'founder') && (
                              <VerifiedBadge size="sm" isFounder={peer.role === 'founder'} badgeLabel={peer.activeBadge} />
                            )}
                            {(peer.isPremium || peer.role === 'founder') && peer.statusEmoji && (
                              <StatusEmojiBadge statusEmoji={peer.statusEmoji} size="xs" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {peer.isOnline ? 'Online' : `UID: ${peer.uid}`}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-6 py-4 space-y-2.5">
                  {loadingThread ? (
                    <div className="py-12 text-center text-xs text-slate-500">Memuat pesan...</div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Mulai obrolan dengan {peer?.name}
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMine = m.senderUid === me.uid;
                      return (
                        <div key={m._id} className={`flex items-end gap-1.5 group ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-sm ${
                              isMine
                                ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-900 dark:text-white rounded-br-sm'
                                : 'bg-white dark:bg-[#202C33] text-slate-900 dark:text-white rounded-bl-sm'
                            }`}
                          >
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
                                <CheckCheck className={`w-3.5 h-3.5 ${m.readAt ? 'text-sky-400' : 'text-slate-400'}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Emoji Drawer */}
                {showEmojiDrawer && (
                  <div className="p-3 bg-white dark:bg-[#1B252C] border-t border-slate-200 dark:border-white/[0.06] max-h-56 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2.5">
                      <button
                        type="button"
                        onClick={() => setEmojiTab('free')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          emojiTab === 'free' ? 'bg-[#E84A18] text-white' : 'bg-slate-100 dark:bg-[#2A3942] text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        Emoji Umum
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmojiTab('vip')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                          emojiTab === 'vip' ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white' : 'bg-slate-100 dark:bg-[#2A3942] text-amber-600'
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
                        <Link to="/profile" className="px-3 py-1 rounded-lg bg-[#E84A18] text-white font-bold">
                          Upgrade
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp Composer for DM */}
                <form
                  onSubmit={handleSend}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-[#202C33] border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setShowEmojiDrawer((s) => !s)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      showEmojiDrawer ? 'bg-[#E84A18] text-white' : 'text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
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
                    aria-label="Kirim"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111B21] border border-slate-200 dark:border-white/15 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[#00A884] text-white flex items-center justify-center shadow">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Buat Grup WhatsApp Baru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Grup diskusi anime &amp; donghua lintas device
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Nama Grup WhatsApp
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="contoh: Komunitas Donghua Indonesia"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Deskripsi Grup (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Tempat diskusi episode terbaru & spoiler..."
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  URL Foto Profil Grup (Opsional)
                </label>
                <input
                  type="url"
                  value={newGroupAvatar}
                  onChange={(e) => setNewGroupAvatar(e.target.value)}
                  placeholder="https://... (atau biarkan kosong untuk default)"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <button
                type="submit"
                disabled={creatingGroup}
                className="w-full h-11 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all"
              >
                {creatingGroup ? 'Membuat Grup...' : 'Buat Grup Sekarang'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
