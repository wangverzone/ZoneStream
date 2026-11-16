import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Crown,
  Globe,
  Heart,
  Image as ImageIcon,
  Loader2,
  Lock,
  Maximize2,
  MessageCircle,
  Mic,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Shield,
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
import { AvatarWithBadges } from '../components/AvatarBadges';
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
import {
  compressImageForChat,
  formatFileSize,
  MAX_CHAT_IMAGE_BYTES,
  uploadCompressedChatImage,
} from '../utils/imageCompression';
import { playSoundEffect } from '../utils/soundEffects';
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
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
  pendingMembers?: string[];
  createdAt?: string;
}

export function ChatPage() {
  const { peerUid = '', groupId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const isGroupRoom = Boolean(groupId || searchParams.get('group'));
  const isGlobalRequested = searchParams.get('global') === '1';
  const isGlobalRoom = !peerUid && !isGroupRoom;
  const activeChatId = groupId || searchParams.get('group') || peerUid || (isGlobalRequested ? 'global' : '');

  const navigate = useNavigate();
  const { user: me, isPremium } = useAuth();
  const canUseVip = Boolean(isPremium || me?.role === 'founder');

  const [chatTab, setChatTab] = useState<'global' | 'dm' | 'group' | 'friends'>(
    isGroupRoom ? 'group' : isGlobalRequested ? 'global' : 'dm'
  );
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [globalMessages, setGlobalMessages] = useState<ChatMessageItem[]>([]);
  const requestedChannel = searchParams.get('channel');
  const initialGlobalChannel: 'ch1' | 'ch2' | 'ch3' | 'rekrut' =
    requestedChannel === 'ch2' || requestedChannel === 'ch3' || requestedChannel === 'rekrut'
      ? requestedChannel
      : 'ch1';
  const [globalChannel, setGlobalChannel] = useState<'ch1' | 'ch2' | 'ch3' | 'rekrut'>(initialGlobalChannel);
  const [globalOnlineCount, setGlobalOnlineCount] = useState<number>(1);
  const [friendsData, setFriendsData] = useState<{
    friends: PublicCommunityUser[];
    incomingRequests: PublicCommunityUser[];
    outgoingRequests: PublicCommunityUser[];
  }>({ friends: [], incomingRequests: [], outgoingRequests: [] });
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState<PublicCommunityUser[]>([]);

  const [peer, setPeer] = useState<PublicCommunityUser | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupChatSummary | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>('none');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState(() => searchParams.get('draft') || '');
  const [selectedSticker, setSelectedSticker] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: 'image' | 'video' | 'audio';
    originalSize?: number;
    compressedSize?: number;
    uploadedToFirebase?: boolean;
  } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [zoomMedia, setZoomMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);

  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUid, setInviteUid] = useState('');
  const [inviting, setInviting] = useState(false);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const seenThreadRef = useRef<{ key: string; ids: Set<string> } | null>(null);
  const seenGlobalRef = useRef<{ channel: string; ids: Set<string> } | null>(null);

  const trackIncomingSound = useCallback(
    (
      trackerRef: React.MutableRefObject<{ key: string; ids: Set<string> } | null>,
      key: string,
      list: ChatMessageItem[]
    ) => {
      const cur = trackerRef.current;
      if (!cur || cur.key !== key) {
        trackerRef.current = { key, ids: new Set(list.map((m) => m._id)) };
        return;
      }
      let hasNewFromOther = false;
      for (const m of list) {
        if (!cur.ids.has(m._id)) {
          cur.ids.add(m._id);
          if (m.senderUid && m.senderUid !== me?.uid) {
            hasNewFromOther = true;
          }
        }
      }
      if (hasNewFromOther) {
        playSoundEffect('chat');
      }
    },
    [me?.uid]
  );

  const loadFriends = useCallback(async () => {
    if (!me) return;
    try {
      const token = getToken();
      const res = await fetch('/api/social/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setFriendsData({
          friends: json.friends || [],
          incomingRequests: json.incomingRequests || [],
          outgoingRequests: json.outgoingRequests || [],
        });
      }
    } catch {
      // Ignore
    }
  }, [me?.uid]);

  const handleSendFriendRequest = async (targetUid: string) => {
    try {
      const token = getToken();
      const res = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid }),
      });
      const json = await res.json();
      if (res.ok) {
        void loadFriends();
        alert(json.message || 'Permintaan teman dikirim!');
      }
    } catch {
      alert('Gagal mengirim permintaan teman.');
    }
  };

  const handleAcceptFriend = async (requesterUid: string) => {
    try {
      const token = getToken();
      const res = await fetch('/api/social/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: requesterUid }),
      });
      const json = await res.json();
      if (res.ok) {
        void loadFriends();
        void loadConversations();
        alert(json.message || 'Pertemanan diterima!');
      }
    } catch {
      alert('Gagal menerima pertemanan.');
    }
  };

  const handleRemoveFriend = async (targetPeerUid: string) => {
    if (!confirm('Hapus pertemanan dengan user ini?')) return;
    try {
      const token = getToken();
      const res = await fetch('/api/social/friends/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: targetPeerUid }),
      });
      if (res.ok) {
        void loadFriends();
      }
    } catch {
      alert('Gagal menghapus pertemanan.');
    }
  };

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
      void loadFriends();
    } catch {
      // Ignore poll error
    }
  }, [me?.uid, loadFriends]);

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
          const incoming: ChatMessageItem[] = json.messages || [];
          trackIncomingSound(seenThreadRef, `dm:${peerUid}`, incoming);
          setPeer(json.peer || null);
          setRelationship(json.relationship || 'none');
          setMessages(incoming);
        }
      } catch {
        // Keep thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, peerUid, isGroupRoom, trackIncomingSound]
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
          const incoming: ChatMessageItem[] = json.messages || [];
          trackIncomingSound(seenThreadRef, `grp:${gId}`, incoming);
          setActiveGroup(json.group || null);
          setMessages(incoming);
        }
      } catch {
        // Keep group thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, groupId, searchParams, trackIncomingSound]
  );

  const loadGlobalThread = useCallback(
    async (silent = false) => {
      if (!me) return;
      if (!silent) setLoadingThread(true);
      try {
        const res = await fetch(
          `/api/social/global-messages?channel=${encodeURIComponent(globalChannel)}`,
          {
            headers: { Authorization: `Bearer ${getToken()}` },
          }
        );
        const json = await res.json();
        if (json.ok && Array.isArray(json.messages)) {
          const incoming: ChatMessageItem[] = json.messages;
          const cur = seenGlobalRef.current;
          if (!cur || cur.channel !== globalChannel) {
            seenGlobalRef.current = {
              channel: globalChannel,
              ids: new Set(incoming.map((m) => m._id)),
            };
          } else {
            let hasNewFromOther = false;
            for (const m of incoming) {
              if (!cur.ids.has(m._id)) {
                cur.ids.add(m._id);
                if (m.senderUid && m.senderUid !== me?.uid) {
                  hasNewFromOther = true;
                }
              }
            }
            if (hasNewFromOther) {
              playSoundEffect('chat');
            }
          }
          setGlobalMessages(incoming);
          if (typeof json.onlineCount === 'number') {
            setGlobalOnlineCount(json.onlineCount);
          }
        }
      } catch {
        // Keep global messages
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, globalChannel]
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
      loadGlobalThread(false);
      const t = setInterval(() => loadGlobalThread(true), 2500);
      return () => clearInterval(t);
    }
  }, [peerUid, groupId, isGroupRoom, loadDmThread, loadGroupThread, loadGlobalThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, globalMessages.length, activeChatId]);

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
        : isGlobalRoom
        ? '/api/social/global-messages'
        : `/api/social/messages/${encodeURIComponent(peerUid)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          channel: isGlobalRoom ? globalChannel : undefined,
          text: draft.trim(),
          sticker: selectedSticker,
          mediaUrl: mediaPreview?.url || '',
          mediaType: mediaPreview?.type || '',
          replyToId: replyTarget?._id || '',
          replySenderUid: replyTarget?.senderUid || '',
          replySenderIsVerified: Boolean(
            replyTarget?.senderIsPremium || replyTarget?.senderRole === 'founder'
          ),
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
        if (isGlobalRoom) {
          setGlobalMessages((prev) => [...prev, json.message]);
        } else {
          setMessages((prev) => [...prev, json.message]);
        }
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

  const handleDeleteGlobalMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/social/global-messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setGlobalMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch {
      // ignore
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setMediaError(null);
    if (type === 'image') {
      if (!file.type.startsWith('image/')) {
        setMediaError('File harus berupa gambar (JPG, PNG, WebP, atau GIF).');
        return;
      }
      setUploadingMedia(true);
      setUploadProgress(5);
      try {
        const uploaded = await uploadCompressedChatImage(file, me?.uid || 'anon', (pct) => {
          setUploadProgress(pct);
        });
        setMediaPreview({
          url: uploaded.url,
          type: 'image',
          originalSize: uploaded.compressed.originalSize,
          compressedSize: uploaded.compressed.compressedSize,
          uploadedToFirebase: uploaded.uploadedToFirebase,
        });
      } catch (err: any) {
        setMediaError(
          err?.message || 'Gagal mengompresi/mengunggah gambar (maksimal 1MB).'
        );
      } finally {
        setUploadingMedia(false);
      }
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setMediaPreview({ url: dataUrl, type });
    } catch {
      setMediaError('Gagal membaca file video.');
    }
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

  const handleInviteByUid = async (e: React.FormEvent) => {
    e.preventDefault();
    const gId = groupId || searchParams.get('group');
    if (!inviteUid.trim() || !gId || inviting) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/social/groups/${encodeURIComponent(gId)}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ targetUid: inviteUid.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || 'Berhasil mengundang user ke grup!');
        setInviteUid('');
        setShowInviteModal(false);
        void loadGroupThread(true);
      } else {
        alert(json.error || 'Gagal mengundang anggota.');
      }
    } catch {
      alert('Gagal mengundang anggota grup.');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const gId = groupId || searchParams.get('group');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !gId) return;
    try {
      const compressed = await compressImageForChat(file, {
        maxSizeBytes: MAX_CHAT_IMAGE_BYTES,
        maxDimension: 800,
      });
      const dataUrl = compressed.previewDataUrl;
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
            Chat &amp; Grup ZoneStream
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
    <Layout hideBottomNav={Boolean(peerUid || isGroupRoom || isGlobalRequested)}>
      <input
        ref={groupAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleChangeGroupAvatar}
        className="hidden"
      />

      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 sm:pt-4 pb-0 sm:pb-6">
        <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] min-h-[560px] sm:rounded-3xl overflow-hidden border-t sm:border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shadow-2xl flex">
          {/* LEFT PANE: Global Chat Entry + Chat Inbox & Group List */}
          <aside
            className={`${
              peerUid || isGroupRoom || isGlobalRequested ? 'hidden md:flex' : 'flex'
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
                    Chat &amp; Global Publik
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
                  title="Buat Grup Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Grup</span>
                </button>
              </div>
            </div>

            {/* Pinned Global Chat Card for All Users & New Logins */}
            <Link
              to="/chat?global=1"
              onClick={() => setChatTab('global')}
              className={`m-2.5 mb-1.5 p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                isGlobalRoom
                  ? 'bg-gradient-to-r from-[#E84A18]/20 via-amber-500/15 to-[#00A884]/15 border-[#E84A18]/50 shadow-sm'
                  : 'bg-slate-50 dark:bg-[#1B262C] border-slate-200 dark:border-white/10 hover:border-[#E84A18]/40'
              }`}
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E84A18] to-amber-500 text-white flex items-center justify-center shadow-lg shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Global Chat Komunitas
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-extrabold shrink-0">
                    Semua User
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                  {globalMessages.length > 0
                    ? `${globalMessages[globalMessages.length - 1].senderName}: ${
                        globalMessages[globalMessages.length - 1].text || '[Media / Stiker]'
                      }`
                    : 'Ruang obrolan terbuka untuk semua user & user baru login!'}
                </p>
              </div>
            </Link>

            {/* 3 Tabs: Chat, Grup, Teman */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-[#111B21] border-b border-slate-200 dark:border-white/[0.06] gap-1">
              <button
                type="button"
                onClick={() => setChatTab('dm')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all truncate px-1 ${
                  chatTab === 'dm'
                    ? 'bg-white dark:bg-[#202C33] text-[#E84A18] shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Chat ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setChatTab('group')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all truncate px-1 ${
                  chatTab === 'group'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Grup ({groups.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatTab('friends');
                  void loadFriends();
                }}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all truncate px-1 ${
                  chatTab === 'friends'
                    ? 'bg-white dark:bg-[#202C33] text-sky-500 shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Teman ({friendsData.friends.length})
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
                      : chatTab === 'group'
                      ? 'Cari nama grup...'
                      : 'Cari teman atau user baru...'
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
                        <div
                          key={u.uid}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-[#202C33] transition-colors"
                        >
                          <Link to={`/chat/${u.uid}`} className="flex items-center gap-3 min-w-0 flex-1">
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
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSendFriendRequest(u.uid)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow"
                              title="Tambah Teman"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Tambah</span>
                            </button>
                            <Link
                              to={`/chat/${u.uid}`}
                              className="p-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white"
                              title="Chat"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
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
              ) : chatTab === 'group' ? (
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
                        Belum ada grup. Buat grup baru sekarang untuk diskusi anime &amp; donghua!
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCreateGroupModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#00A884] text-white text-xs font-bold"
                      >
                        Buat Grup Baru
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* FRIENDS TAB */
                <div className="p-3 space-y-4">
                  {friendsData.incomingRequests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                        Permintaan Pertemanan Masuk ({friendsData.incomingRequests.length})
                      </p>
                      {friendsData.incomingRequests.map((req) => (
                        <div key={req.uid} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={req.photoUrl || defaultAvatarImg} alt={req.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{req.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">@{req.username || req.uid}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptFriend(req.uid)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow"
                            >
                              Terima
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFriend(req.uid)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-[11px] font-bold transition-colors"
                            >
                              Tolak
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      Daftar Teman ({friendsData.friends.length})
                    </p>
                    {friendsData.friends.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        Belum ada teman. Cari user di atas untuk menambah teman!
                      </p>
                    ) : (
                      friendsData.friends.map((f) => (
                        <div key={f.uid} className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white dark:bg-[#202C33] border border-slate-200 dark:border-white/5">
                          <Link to={`/chat/${f.uid}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={f.photoUrl || defaultAvatarImg} alt={f.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{f.name}</p>
                              <p className="text-[10px] text-emerald-500 font-semibold">Online • Klik untuk Chat</p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Link
                              to={`/chat/${f.uid}`}
                              className="p-2 rounded-xl bg-[#00A884] text-white hover:bg-[#06CF9C] shadow transition-colors"
                              title="Kirim Pesan"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveFriend(f.uid)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-500 hover:text-white dark:bg-white/5 text-slate-400 transition-colors"
                              title="Hapus Teman"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT PANE: Chat Room (Global, DM, or Group) */}
          <section
            className={`${
              peerUid || isGroupRoom || isGlobalRequested ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 relative`}
          >
            {isGlobalRoom ? (
              /* GLOBAL CHAT ROOM — Synced to each user's real profile (PP, Border, Verified, UID, Clan, Level, Charisma ♥) */
              <div className="flex-1 flex flex-col bg-[#0D0E12] text-white min-h-0">
                {/* Top Header */}
                <div className="h-14 px-4 bg-[#12141A] border-b border-white/[0.06] flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => (isGlobalRequested ? navigate('/chat') : navigate('/'))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:bg-white/10 transition-colors"
                    aria-label="Kembali"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-base font-extrabold tracking-wide text-white">
                    Chat Global
                  </h2>
                  <Link
                    to="/profile"
                    className="text-[11px] font-bold text-sky-400 hover:underline truncate max-w-[90px]"
                  >
                    #{me.uid}
                  </Link>
                </div>

                {/* Scam Warning + Channel Pills + Online Bar */}
                <div className="px-3 sm:px-4 pt-3 pb-2 space-y-2.5 bg-[#0D0E12] border-b border-white/[0.05] shrink-0">
                  <div className="rounded-xl bg-[#271F10] border border-amber-500/30 px-3.5 py-2.5 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] sm:text-xs text-amber-200/90 leading-snug">
                      Hati hati banyak Scam, jangan mudah percaya orang lain, dan dilarang berjualan
                    </p>
                  </div>

                  {/* Channel Selector Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    {(
                      [
                        { id: 'ch1', label: 'Ch 1' },
                        { id: 'ch2', label: 'Ch 2' },
                        { id: 'ch3', label: 'Ch 3' },
                        { id: 'rekrut', label: 'Rekrut Clan' },
                      ] as const
                    ).map((ch) => {
                      const active = globalChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setGlobalChannel(ch.id)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                            active
                              ? 'bg-sky-500/15 border-sky-500 text-sky-300 shadow-sm shadow-sky-500/20'
                              : 'bg-[#171920] border-white/10 text-gray-300 hover:border-white/25'
                          }`}
                        >
                          # {ch.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Online Count Indicator */}
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 px-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    <span>
                      {globalOnlineCount} online di{' '}
                      {globalChannel === 'rekrut'
                        ? 'Rekrut Clan'
                        : globalChannel.replace('ch', 'Ch ')}
                    </span>
                  </div>
                </div>

                {/* Global Messages Feed */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3.5 bg-[#0D0E12]">
                  {loadingThread && globalMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400">Memuat Chat Global...</div>
                  ) : globalMessages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-[#181A22] border border-white/10 p-4 text-center">
                      <Globe className="w-7 h-7 text-sky-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-white">
                        Belum ada pesan di channel ini
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Kirim pesan pertama sekarang dengan profil aslimu!
                      </p>
                    </div>
                  ) : (
                    globalMessages.map((m, msgIdx) => {
                      const isMine = m.senderUid === me.uid;
                      const isSenderFounder = m.senderRole === 'founder';
                      const isSenderVip = Boolean(m.senderIsPremium || isSenderFounder);
                      const senderLevel = isSenderFounder ? 9999 : (m.senderLevel || 1);
                      const senderCharisma = m.senderCharisma ?? 0;

                      return (
                        <div key={m._id} className="flex items-end gap-2.5 group">
                          {/* Real Profile Picture + Active Avatar Decoration + Interactive Clan Leader / Top Rank SVG Badges */}
                          <Link to={`/u/${m.senderUid}`} className="shrink-0 mb-0.5">
                            <AvatarWithBadges
                              uid={m.senderUid}
                              ownerName={m.senderName || 'User'}
                              clanLeader={
                                m.senderClan?.isLeader
                                  ? {
                                      isLeader: true,
                                      clanTag: m.senderClan.tag,
                                      clanName: m.senderClan.name,
                                      clanRank: m.senderClan.clanRank,
                                    }
                                  : null
                              }
                              topRank={
                                m.senderTopRank && m.senderTopRank <= 10
                                  ? {
                                      rank: m.senderTopRank,
                                      category: m.senderTopCategory,
                                    }
                                  : null
                              }
                              size="sm"
                              popoverAlign="left"
                              popoverPlacement={msgIdx < 2 ? 'bottom' : 'top'}
                            >
                              <AvatarDecoration
                                src={m.senderPhoto || defaultAvatarImg}
                                alt={m.senderName || 'User'}
                                decorationId={m.senderBorder}
                                size="sm"
                              />
                            </AvatarWithBadges>
                          </Link>

                          {/* Bubble + Timestamp Row */}
                          <div className="flex items-end gap-2 min-w-0 flex-1">
                            <div
                              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 border shadow-md ${
                                isMine
                                  ? 'bg-[#1E222D] border-sky-500/30'
                                  : 'bg-[#191B22] border-white/[0.06]'
                              }`}
                            >
                              {/* Reply Quote Box (if replying) */}
                              {m.replyText && (
                                <div className="mb-2 pl-2.5 border-l-2 border-gray-400/70 bg-black/25 rounded-r-lg px-2.5 py-1.5">
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 truncate">
                                    <span>{m.replySenderName || 'User'}</span>
                                    {m.replySenderUid && (
                                      <span className="text-gray-400 font-mono text-[10px]">
                                        #{m.replySenderUid}
                                      </span>
                                    )}
                                    {m.replySenderIsVerified && (
                                      <VerifiedBadge size="sm" isFounder={false} />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-300 truncate mt-0.5">
                                    {m.replyText}
                                  </p>
                                </div>
                              )}

                              {/* Sender Name + Verified Badge + #UID */}
                              <Link
                                to={`/u/${m.senderUid}`}
                                className="flex items-center gap-1.5 flex-wrap"
                              >
                                <span
                                  className={`text-xs font-extrabold hover:underline ${
                                    isSenderFounder
                                      ? 'text-amber-300'
                                      : isSenderVip
                                      ? 'text-violet-300'
                                      : 'text-emerald-300'
                                  }`}
                                >
                                  {m.senderName || 'User'}
                                </span>
                                {isSenderVip && (
                                  <VerifiedBadge
                                    size="sm"
                                    isFounder={isSenderFounder}
                                    badgeLabel={m.senderBadge}
                                  />
                                )}
                                <span className="text-[11px] text-gray-400 font-mono">
                                  #{m.senderUid}
                                </span>
                              </Link>

                              {/* Profile Badges Row: Real Clan, Real Level, Real Charisma ♥ */}
                              <div className="mt-1.5 mb-1.5 flex items-center gap-1.5 flex-wrap">
                                {m.senderClan?.tag && (
                                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-500/25 to-indigo-500/25 border border-sky-400/40 text-sky-200 text-[10px] font-extrabold inline-flex items-center gap-1">
                                    <Shield className="w-2.5 h-2.5 text-amber-400" />
                                    <span>{m.senderClan.tag}</span>
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 ${
                                    isSenderFounder
                                      ? 'bg-gradient-to-r from-amber-600/80 to-rose-600/80 text-white border border-amber-400/50'
                                      : senderLevel >= 50
                                      ? 'bg-rose-600/85 text-white'
                                      : 'bg-amber-600/80 text-amber-50'
                                  }`}
                                >
                                  <span>
                                    {isSenderFounder ? 'God Lvl 9999' : `Lvl ${senderLevel}`}
                                  </span>
                                </span>

                                <span className="px-2 py-0.5 rounded-full bg-rose-500/85 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                                  <Heart className="w-2.5 h-2.5 fill-current" />
                                  <span>{senderCharisma}</span>
                                </span>
                              </div>

                              {/* Attachments / Stickers */}
                              {m.mediaType === 'image' && m.mediaUrl && (
                                <div
                                  onClick={() => setZoomMedia({ url: m.mediaUrl!, type: 'image' })}
                                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer relative"
                                >
                                  <img
                                    src={m.mediaUrl}
                                    alt="Media"
                                    className="w-full h-auto object-cover max-h-64"
                                  />
                                </div>
                              )}

                              {m.mediaType === 'video' && m.mediaUrl && (
                                <div
                                  onClick={() => setZoomMedia({ url: m.mediaUrl!, type: 'video' })}
                                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer relative"
                                >
                                  <video src={m.mediaUrl} className="w-full max-h-64 object-contain" />
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

                              {/* Message Text */}
                              {m.text && (
                                <p className="text-xs sm:text-sm text-gray-100 leading-relaxed break-words whitespace-pre-wrap">
                                  {renderCommentRichText(m.text)}
                                </p>
                              )}

                              {/* Hover Actions */}
                              <div className="mt-1 flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => setReplyTarget(m)}
                                  className="text-[10px] text-gray-400 hover:text-sky-400 inline-flex items-center gap-0.5"
                                  title="Balas"
                                >
                                  <Reply className="w-3 h-3" />
                                  <span>Balas</span>
                                </button>
                                {(isMine || me.role === 'founder') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGlobalMessage(m._id)}
                                    className="text-[10px] text-gray-400 hover:text-rose-400 inline-flex items-center gap-0.5"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Timestamp beside bubble like screenshot */}
                            <span className="text-[10px] text-gray-500 font-mono-tabular shrink-0 pb-1">
                              {formatMsgTime(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply / Media Preview Bars */}
                {replyTarget && (
                  <div className="px-4 py-2 bg-[#161820] border-t border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 border-l-2 border-sky-400 pl-2">
                      <p className="font-bold text-sky-400 truncate">
                        Membalas {replyTarget.senderName || 'User'} #{replyTarget.senderUid}
                      </p>
                      <p className="text-gray-400 truncate">
                        {replyTarget.text || '[Media / Stiker]'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTarget(null)}
                      className="text-gray-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {mediaError && (
                  <div className="px-4 py-2 bg-rose-500/15 border-t border-rose-500/30 flex items-center justify-between gap-2 text-xs text-rose-300 font-semibold">
                    <span>{mediaError}</span>
                    <button type="button" onClick={() => setMediaError(null)} className="text-rose-300 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadingMedia && (
                  <div className="px-4 py-2 bg-[#161820] border-t border-white/[0.08] flex items-center gap-2.5 text-xs text-sky-300 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Mengompresi (&le; 1MB) &amp; mengunggah ke Firebase Storage... {uploadProgress}%</span>
                  </div>
                )}

                {mediaPreview && !uploadingMedia && (
                  <div className="px-4 py-2 bg-[#161820] border-t border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {mediaPreview.type === 'image' && (
                        <img
                          src={mediaPreview.url}
                          alt="Preview"
                          className="w-10 h-10 rounded-lg object-cover border border-white/10"
                        />
                      )}
                      {mediaPreview.type === 'video' && <Video className="w-5 h-5 text-sky-400" />}
                      {mediaPreview.type === 'audio' && <Mic className="w-5 h-5 text-sky-400" />}
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">
                          Lampiran {mediaPreview.type.toUpperCase()} siap dikirim
                        </p>
                        {mediaPreview.type === 'image' && mediaPreview.compressedSize && (
                          <p className="text-[10px] text-emerald-400 font-mono-tabular truncate">
                            {formatFileSize(mediaPreview.compressedSize)}
                            {mediaPreview.originalSize && mediaPreview.originalSize > mediaPreview.compressedSize
                              ? ` (dari ${formatFileSize(mediaPreview.originalSize)})`
                              : ''}
                            {mediaPreview.uploadedToFirebase ? ' · Firebase Storage' : ' · Terkompresi ≤ 1MB'}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaPreview(null)}
                      className="text-gray-400 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {showEmojiDrawer && (
                  <div className="p-3 bg-[#161820] border-t border-white/[0.08] max-h-56 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2.5">
                      <button
                        type="button"
                        onClick={() => setEmojiTab('free')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          emojiTab === 'free'
                            ? 'bg-sky-500 text-white'
                            : 'bg-[#222633] text-gray-300'
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
                            : 'bg-[#222633] text-amber-500'
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
                            onClick={() => setDraft((p) => `${p}${em}`.slice(0, 255))}
                            className="w-9 h-9 rounded-lg bg-[#222633] hover:scale-110 text-lg flex items-center justify-center transition-transform"
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
                        <span className="text-gray-200 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-500" />
                          Stiker eksklusif khusus Member VIP.
                        </span>
                        <Link to="/profile" className="px-3 py-1 rounded-lg bg-[#E84A18] text-white font-bold">
                          Upgrade
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Global Chat Composer matching screenshot (with 0/255 counter & blue send button) */}
                <form
                  onSubmit={handleSend}
                  className="px-3 pt-2 pb-2.5 bg-[#0D0E12] border-t border-white/[0.06] shrink-0 space-y-1"
                >
                  <div className="flex justify-end pr-1">
                    <span className="text-[10px] text-gray-500 font-mono-tabular">
                      {draft.length}/255
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5 h-11 px-3 rounded-full bg-[#1C1E26] border border-white/[0.07]">
                      <button
                        type="button"
                        onClick={() => setShowEmojiDrawer((s) => !s)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                          showEmojiDrawer ? 'text-sky-400' : 'text-gray-400 hover:text-white'
                        }`}
                        aria-label="Emoji dan Stiker"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      <label
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white cursor-pointer shrink-0"
                        title="Kirim Foto"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleMediaUpload(e, 'image')}
                          className="hidden"
                        />
                      </label>

                      {isRecordingVn ? (
                        <div className="flex-1 flex items-center gap-2 text-rose-400 text-xs font-bold px-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <span>VN ({recordingSeconds}s)...</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          maxLength={255}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Silakan masukkan pesan..."
                          className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none min-w-0"
                        />
                      )}

                      {isRecordingVn ? (
                        <button
                          type="button"
                          onClick={stopVnRecording}
                          className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0"
                          title="Stop VN"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startVnRecording}
                          className="w-7 h-7 rounded-full text-gray-400 hover:text-white flex items-center justify-center shrink-0"
                          title="Rekam Voice Note"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending || uploadingMedia || (!draft.trim() && !mediaPreview && !selectedSticker)}
                      className="w-12 h-11 rounded-2xl bg-[#1D7AFC] hover:bg-[#388BFF] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow-lg shadow-sky-500/25"
                      aria-label="Kirim"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                {/* Bottom Switcher Bar (Global | Clan | Teman) */}
                <div className="grid grid-cols-3 h-11 bg-[#12141A] border-t border-white/[0.06] shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/chat?global=1')}
                    className="text-xs font-extrabold text-white border-b-2 border-sky-400 flex items-center justify-center"
                  >
                    Global
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/leaderboard')}
                    className="text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center"
                  >
                    Clan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatTab('friends');
                      navigate('/chat');
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center"
                  >
                    Teman
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
                              Grup
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {activeGroup.description || `${activeGroup.members?.length || 1} Anggota`} · Klik foto untuk ganti PP
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#00A884] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow"
                      title="Tambah Anggota ke Grup dengan UID"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Tambah Teman (UID)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => groupAvatarInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-[#00A884] hover:text-white text-xs font-bold text-slate-700 dark:text-gray-200 hidden sm:inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ubah Foto</span>
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto wa-wallpaper px-3 sm:px-6 py-4 space-y-2.5">
                  {loadingThread ? (
                    <div className="py-12 text-center text-xs text-slate-500">Memuat pesan grup...</div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Grup {activeGroup?.name} berhasil dibuat!
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">
                        Kirim teks, foto (bisa diperbesar), video, atau VN sekarang.
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

                            {m.mediaType === 'image' && m.mediaUrl && (() => {
                              const url = m.mediaUrl || '';
                              return (
                                <div
                                  onClick={() => setZoomMedia({ url, type: 'image' })}
                                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer group/img relative"
                                >
                                  <img src={url} alt="Media" className="w-full h-auto object-cover max-h-64 group-hover/img:scale-105 transition-transform" />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Maximize2 className="w-5 h-5" />
                                  </div>
                                </div>
                              );
                            })()}

                            {m.mediaType === 'video' && m.mediaUrl && (() => {
                              const url = m.mediaUrl || '';
                              return (
                                <div
                                  onClick={() => setZoomMedia({ url, type: 'video' })}
                                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer group/vid relative"
                                >
                                  <video src={url} className="w-full max-h-64 object-contain" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                    <Play className="w-8 h-8 fill-white text-white drop-shadow" />
                                  </div>
                                </div>
                              );
                            })()}

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

                {mediaError && (
                  <div className="px-4 py-2 bg-rose-500/15 border-t border-rose-500/30 flex items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                    <span>{mediaError}</span>
                    <button type="button" onClick={() => setMediaError(null)} className="text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadingMedia && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5 text-xs text-[#00A884] font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Mengompresi (&le; 1MB) &amp; mengunggah ke Firebase Storage... {uploadProgress}%</span>
                  </div>
                )}

                {/* Media Preview Bar */}
                {mediaPreview && !uploadingMedia && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {mediaPreview.type === 'image' && (
                        <img src={mediaPreview.url} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                      )}
                      {mediaPreview.type === 'video' && <Video className="w-5 h-5 text-[#00A884]" />}
                      {mediaPreview.type === 'audio' && <Mic className="w-5 h-5 text-[#00A884]" />}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">
                          Lampiran {mediaPreview.type.toUpperCase()} siap dikirim
                        </p>
                        {mediaPreview.type === 'image' && mediaPreview.compressedSize && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono-tabular truncate">
                            {formatFileSize(mediaPreview.compressedSize)}
                            {mediaPreview.originalSize && mediaPreview.originalSize > mediaPreview.compressedSize
                              ? ` (dari ${formatFileSize(mediaPreview.originalSize)})`
                              : ''}
                            {mediaPreview.uploadedToFirebase ? ' · Firebase Storage' : ' · Terkompresi ≤ 1MB'}
                          </p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setMediaPreview(null)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Composer for Groups */}
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
                      placeholder="Ketik pesan grup..."
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
                            {m.mediaType === 'image' && m.mediaUrl && (
                              <div
                                onClick={() => setZoomMedia({ url: m.mediaUrl!, type: 'image' })}
                                className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer group/img relative"
                              >
                                <img
                                  src={m.mediaUrl}
                                  alt="Media"
                                  className="w-full h-auto object-cover max-h-64 group-hover/img:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Maximize2 className="w-5 h-5" />
                                </div>
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

                {mediaError && (
                  <div className="px-4 py-2 bg-rose-500/15 border-t border-rose-500/30 flex items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                    <span>{mediaError}</span>
                    <button type="button" onClick={() => setMediaError(null)} className="text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadingMedia && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5 text-xs text-[#00A884] font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Mengompresi (&le; 1MB) &amp; mengunggah ke Firebase Storage... {uploadProgress}%</span>
                  </div>
                )}

                {mediaPreview && !uploadingMedia && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A242B] border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {mediaPreview.type === 'image' && (
                        <img src={mediaPreview.url} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">
                          Lampiran {mediaPreview.type.toUpperCase()} siap dikirim
                        </p>
                        {mediaPreview.type === 'image' && mediaPreview.compressedSize && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono-tabular truncate">
                            {formatFileSize(mediaPreview.compressedSize)}
                            {mediaPreview.originalSize && mediaPreview.originalSize > mediaPreview.compressedSize
                              ? ` (dari ${formatFileSize(mediaPreview.originalSize)})`
                              : ''}
                            {mediaPreview.uploadedToFirebase ? ' · Firebase Storage' : ' · Terkompresi ≤ 1MB'}
                          </p>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setMediaPreview(null)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Composer for DM */}
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

                  <label
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
                    title="Kirim Foto (Kompresi ≤ 1MB)"
                  >
                    <ImageIcon className="w-5 h-5 text-[#00A884]" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleMediaUpload(e, 'image')}
                      className="hidden"
                    />
                  </label>

                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Ketik pesan untuk ${peer?.name || 'teman'}...`}
                    className="flex-1 h-10 px-4 rounded-full bg-white dark:bg-[#2A3942] border border-slate-200 dark:border-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E84A18]"
                  />

                  <button
                    type="submit"
                    disabled={sending || uploadingMedia || (!draft.trim() && !selectedSticker && !mediaPreview)}
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

      {/* Zoom Media Modal (Lightbox) */}
      {zoomMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setZoomMedia(null)}
              className="absolute top-4 right-4 z-50 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur shadow-lg transition-colors"
              aria-label="Tutup"
            >
              <X className="w-6 h-6" />
            </button>
            {zoomMedia.type === 'image' ? (
              <img src={zoomMedia.url} alt="Zoomed" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
            ) : (
              <video src={zoomMedia.url} controls autoPlay className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* Invite Friend by UID Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111B21] border border-slate-200 dark:border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[#00A884] text-white flex items-center justify-center shadow">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Tambah Anggota via UID
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Undang teman ke grup menggunakan UID unik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteByUid} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Masukkan UID Pengguna
                </label>
                <input
                  type="text"
                  required
                  value={inviteUid}
                  onChange={(e) => setInviteUid(e.target.value)}
                  placeholder="contoh: 00000 atau user_xyz"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full h-11 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all"
              >
                {inviting ? 'Mengirim Undangan...' : 'Undang ke Grup'}
              </button>
            </form>
          </div>
        </div>
      )}

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
                    Buat Grup Baru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Grup diskusi anime &amp; donghua
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
                  Nama Grup
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
