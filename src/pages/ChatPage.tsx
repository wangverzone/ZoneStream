import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Camera,
  CheckCheck,
  Globe,
  Info,
  MessageCircle,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AvatarDecoration } from '../components/AvatarDecoration';
import { StatusEmojiBadge } from '../components/VipEmojis';
import { ChatDateDivider, formatChatDateLabel, isSameCalendarDay } from '../components/chat/ChatDateDivider';
import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { ChatComposer } from '../components/chat/ChatComposer';
import { useAuth } from '../context/AuthContext';
import type {
  ChatConversationSummary,
  ChatMessageItem,
  PublicCommunityUser,
  RelationshipStatus,
} from '../types';
import { resolveWsUrl } from '../utils/apiBase';
import {
  compressImageForChat,
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

function makePairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join(':');
}

function formatMsgTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(iso?: string): string {
  if (!iso) return 'Offline';
  const diffMin = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `Aktif ${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Aktif ${diffHr} jam lalu`;
  return `Aktif ${Math.floor(diffHr / 24)} hr lalu`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mergeMessageList(prev: ChatMessageItem[], incoming: ChatMessageItem): ChatMessageItem[] {
  const idx = prev.findIndex((m) => m._id === incoming._id);
  if (idx >= 0) {
    const copy = [...prev];
    copy[idx] = { ...copy[idx], ...incoming };
    return copy;
  }
  return [...prev, incoming];
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

type WallpaperMode = 'pattern' | 'clean' | 'aurora';

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ChatPage() {
  const { peerUid = '', groupId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const activeGroupId = groupId || searchParams.get('group') || '';
  const isGroupRoom = Boolean(activeGroupId);
  const isGlobalRequested = searchParams.get('global') === '1';
  const isGlobalRoom = !peerUid && !isGroupRoom;
  const activeChatId = activeGroupId || peerUid || (isGlobalRequested ? 'global' : '');

  const navigate = useNavigate();
  const { user: me, isPremium } = useAuth();
  const canUseVip = Boolean(isPremium || me?.role === 'founder');
  const isFounder = me?.role === 'founder';

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
  const [editTarget, setEditTarget] = useState<ChatMessageItem | null>(null);

  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
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
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vnCancelledRef = useRef(false);

  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingPeers, setTypingPeers] = useState<Record<string, { name: string; expiresAt: number }>>({});

  // Modern UX States: In-room search, Scroll-to-bottom FAB, Highlight jump, Wallpaper, Toasts, Confirm Dialog
  const [roomSearchOpen, setRoomSearchOpen] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(0);
  const [wallpaperMode, setWallpaperMode] = useState<WallpaperMode>(() => {
    const saved = localStorage.getItem('zonestream_chat_wallpaper');
    return saved === 'clean' || saved === 'aurora' ? saved : 'pattern';
  });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const isAtBottomRef = useRef<boolean>(true);
  const seenThreadRef = useRef<{ key: string; ids: Set<string> } | null>(null);
  const seenGlobalRef = useRef<{ channel: string; ids: Set<string> } | null>(null);
  const prevGlobalMsgCountRef = useRef<number>(0);
  const prevThreadMsgCountRef = useRef<number>(0);

  const showToast = useCallback((type: ToastState['type'], message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Compute current active room type & WebSocket roomKey
  const activeRoomType: 'dm' | 'group' | 'global' = isGroupRoom
    ? 'group'
    : isGlobalRoom
    ? 'global'
    : 'dm';

  const activeRoomKey = useMemo(() => {
    if (!me?.uid) return '';
    if (isGroupRoom && activeGroupId) return `group:${activeGroupId}`;
    if (peerUid) return `dm:${makePairKey(me.uid, peerUid)}`;
    return `global:${globalChannel}`;
  }, [me?.uid, isGroupRoom, activeGroupId, peerUid, globalChannel]);

  const activeRoomKeyRef = useRef(activeRoomKey);
  activeRoomKeyRef.current = activeRoomKey;

  const activeRoomTypeRef = useRef(activeRoomType);
  activeRoomTypeRef.current = activeRoomType;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setUnreadBelow(0);
    setShowScrollFab(false);
    isAtBottomRef.current = true;
  }, []);

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isAtBottomRef.current = nearBottom;
    setShowScrollFab(!nearBottom);
    if (nearBottom) {
      setUnreadBelow(0);
    }
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageId);
      setTimeout(() => {
        setHighlightedMsgId((cur) => (cur === messageId ? null : cur));
      }, 1800);
    }
  }, []);

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
        showToast('success', json.message || 'Permintaan teman dikirim!');
      } else {
        showToast('error', json.error || 'Gagal mengirim permintaan teman.');
      }
    } catch {
      showToast('error', 'Gagal mengirim permintaan teman.');
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
        showToast('success', json.message || 'Pertemanan diterima!');
      }
    } catch {
      showToast('error', 'Gagal menerima pertemanan.');
    }
  };

  const handleRemoveFriend = (targetPeerUid: string, targetName = 'user ini') => {
    setConfirmDialog({
      title: 'Hapus Pertemanan',
      message: `Yakin ingin menghapus ${targetName} dari daftar teman Anda?`,
      confirmLabel: 'Hapus Teman',
      danger: true,
      onConfirm: async () => {
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
            showToast('info', 'Pertemanan dihapus.');
          }
        } catch {
          showToast('error', 'Gagal menghapus pertemanan.');
        }
      },
    });
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
      if (!me || !activeGroupId) return;
      if (!silent) setLoadingThread(true);
      try {
        const res = await fetch(`/api/social/groups/${encodeURIComponent(activeGroupId)}/messages`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json.ok) {
          const incoming: ChatMessageItem[] = json.messages || [];
          trackIncomingSound(seenThreadRef, `grp:${activeGroupId}`, incoming);
          setActiveGroup(json.group || null);
          setMessages(incoming);
        }
      } catch {
        // Keep group thread
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [me?.uid, activeGroupId, trackIncomingSound]
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

  // Clean up expired typing indicators every 1s
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setTypingPeers((prev) => {
        let changed = false;
        const next: Record<string, { name: string; expiresAt: number }> = {};
        for (const [uid, info] of Object.entries(prev)) {
          if (info.expiresAt > now) {
            next[uid] = info;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Reset typing / search / edit state on room switch
  useEffect(() => {
    setTypingPeers({});
    setRoomSearchOpen(false);
    setRoomSearchQuery('');
    setReplyTarget(null);
    setEditTarget(null);
    setUnreadBelow(0);
    setShowScrollFab(false);
    isAtBottomRef.current = true;
    prevThreadMsgCountRef.current = 0;
    prevGlobalMsgCountRef.current = 0;
  }, [activeRoomKey]);

  // Real-time WebSocket Connection with exponential-backoff reconnect & state sync
  useEffect(() => {
    if (!me?.uid) return;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;
    let hasConnectedOnce = false;

    const connectWs = () => {
      if (cancelled) return;
      const token = getToken();
      if (!token) return;

      const wsUrl = resolveWsUrl(`/ws/chat?token=${encodeURIComponent(token)}`);
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }
        attempt = 0;
        setWsConnected(true);

        if (activeRoomKeyRef.current) {
          socket.send(JSON.stringify({ type: 'subscribe', roomKey: activeRoomKeyRef.current }));
        }

        // Sync missed messages if this was a reconnect
        if (hasConnectedOnce) {
          void loadConversations();
          if (activeRoomTypeRef.current === 'group') void loadGroupThread(true);
          else if (activeRoomTypeRef.current === 'dm') void loadDmThread(true);
          else void loadGlobalThread(true);
        }
        hasConnectedOnce = true;

        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!data || typeof data !== 'object') return;

        if (data.type === 'chat:message' && data.message) {
          const msg = data.message as ChatMessageItem;
          const isIncomingFromOther = Boolean(msg.senderUid && msg.senderUid !== me.uid);

          if (data.roomType === 'global') {
            if (data.roomKey === activeRoomKeyRef.current) {
              setGlobalMessages((prev) => {
                const existed = prev.some((m) => m._id === msg._id);
                if (!existed && isIncomingFromOther) {
                  playSoundEffect('chat');
                }
                return mergeMessageList(prev, msg);
              });
            }
          } else {
            if (data.roomKey === activeRoomKeyRef.current) {
              setMessages((prev) => {
                const existed = prev.some((m) => m._id === msg._id);
                if (!existed && isIncomingFromOther) {
                  playSoundEffect('chat');
                  if (data.roomType === 'dm' && peerUid) {
                    // Mark read quietly via GET when peer message arrives while open
                    void loadDmThread(true);
                  }
                }
                return mergeMessageList(prev, msg);
              });
            } else if (isIncomingFromOther) {
              playSoundEffect('chat');
            }
            void loadConversations();
          }

          // Clear typing indicator for sender
          if (msg.senderUid) {
            setTypingPeers((prev) => {
              if (!prev[msg.senderUid]) return prev;
              const next = { ...prev };
              delete next[msg.senderUid];
              return next;
            });
          }
          return;
        }

        if (data.type === 'chat:reaction' && data.messageId) {
          if (data.roomKey === activeRoomKeyRef.current) {
            const updater = (prev: ChatMessageItem[]) =>
              prev.map((m) =>
                m._id === data.messageId ? { ...m, reactions: data.reactions || {} } : m
              );
            if (data.roomType === 'global') setGlobalMessages(updater);
            else setMessages(updater);
          }
          return;
        }

        if (data.type === 'chat:edit' && data.messageId) {
          if (data.roomKey === activeRoomKeyRef.current) {
            const updater = (prev: ChatMessageItem[]) =>
              prev.map((m) =>
                m._id === data.messageId
                  ? { ...m, text: data.text, editedAt: data.editedAt || new Date().toISOString() }
                  : m
              );
            if (data.roomType === 'global') setGlobalMessages(updater);
            else setMessages(updater);
          }
          return;
        }

        if (data.type === 'chat:delete' && data.messageId) {
          if (data.roomKey === activeRoomKeyRef.current) {
            const remover = (prev: ChatMessageItem[]) =>
              prev.filter((m) => m._id !== data.messageId);
            if (data.roomType === 'global') setGlobalMessages(remover);
            else setMessages(remover);
          }
          return;
        }

        if (data.type === 'chat:read' && data.roomType === 'dm') {
          if (data.roomKey === activeRoomKeyRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.senderUid === me.uid && !m.readAt
                  ? { ...m, readAt: data.readAt || new Date().toISOString() }
                  : m
              )
            );
          }
          void loadConversations();
          return;
        }

        if (data.type === 'chat:typing' && data.uid && data.uid !== me.uid) {
          if (data.roomKey === activeRoomKeyRef.current) {
            setTypingPeers((prev) => {
              const next = { ...prev };
              if (data.isTyping) {
                next[data.uid] = {
                  name: data.name || 'Seseorang',
                  expiresAt: Date.now() + 4000,
                };
              } else {
                delete next[data.uid];
              }
              return next;
            });
          }
        }
      };

      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (wsRef.current === socket) wsRef.current = null;
        setWsConnected(false);
        if (!cancelled) {
          const delay = Math.min(15000, 1500 * Math.pow(2, attempt));
          attempt += 1;
          reconnectTimer = setTimeout(connectWs, delay);
        }
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // Ignore
        }
      };
    };

    connectWs();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [me?.uid]);

  // Subscribe socket to active room when room switches
  useEffect(() => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN && activeRoomKey) {
      socket.send(JSON.stringify({ type: 'subscribe', roomKey: activeRoomKey }));
    }
  }, [activeRoomKey, wsConnected]);

  // Adaptive sidebar conversation sync (slower when WS is alive, faster fallback when offline)
  useEffect(() => {
    void loadConversations();
    const intervalMs = wsConnected ? 20000 : 5000;
    const t = setInterval(loadConversations, intervalMs);
    return () => clearInterval(t);
  }, [loadConversations, wsConnected]);

  // Initial load + adaptive fallback polling ONLY when WS disconnected
  useEffect(() => {
    if (isGroupRoom) {
      void loadGroupThread(false);
      const t = setInterval(() => loadGroupThread(true), wsConnected ? 25000 : 3000);
      return () => clearInterval(t);
    } else if (peerUid) {
      void loadDmThread(false);
      const t = setInterval(() => loadDmThread(true), wsConnected ? 25000 : 2500);
      return () => clearInterval(t);
    } else {
      setPeer(null);
      setActiveGroup(null);
      setMessages([]);
      void loadGlobalThread(false);
      const t = setInterval(() => loadGlobalThread(true), wsConnected ? 25000 : 2500);
      return () => clearInterval(t);
    }
  }, [peerUid, activeGroupId, isGroupRoom, wsConnected, loadDmThread, loadGroupThread, loadGlobalThread]);

  // Smart auto-scroll & unread badge counter when messages arrive
  useEffect(() => {
    const activeList = isGlobalRoom ? globalMessages : messages;
    const prevRef = isGlobalRoom ? prevGlobalMsgCountRef : prevThreadMsgCountRef;
    const prevCount = prevRef.current;
    prevRef.current = activeList.length;

    if (prevCount === 0 && activeList.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    if (activeList.length > prevCount) {
      const added = activeList.length - prevCount;
      const latest = activeList[activeList.length - 1];
      if (isAtBottomRef.current || latest?.senderUid === me?.uid) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setUnreadBelow(0);
      } else {
        setUnreadBelow((u) => u + added);
      }
    }
  }, [messages.length, globalMessages.length, isGlobalRoom, me?.uid]);

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

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !activeRoomKey || !me) return;
      socket.send(
        JSON.stringify({
          type: 'typing',
          roomType: activeRoomType,
          roomKey: activeRoomKey,
          peerUid: activeRoomType === 'dm' ? peerUid : '',
          name: me.name,
          isTyping,
        })
      );
    },
    [activeRoomKey, activeRoomType, peerUid, me?.name]
  );

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (editTarget) return;

      const now = Date.now();
      if (next.trim().length > 0) {
        if (now - lastTypingEmitRef.current > 1800) {
          lastTypingEmitRef.current = now;
          emitTyping(true);
        }
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
          emitTyping(false);
        }, 2500);
      } else {
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        emitTyping(false);
      }
    },
    [editTarget, emitTyping]
  );

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!me || sending) return;

    // Handle Edit Submission
    if (editTarget) {
      const trimmed = draft.trim();
      if (!trimmed) return;
      setSending(true);
      try {
        const res = await fetch(
          `/api/social/chat/${activeRoomType}/${encodeURIComponent(editTarget._id)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ text: trimmed }),
          }
        );
        const json = await res.json();
        if (res.ok) {
          const applyEdit = (prev: ChatMessageItem[]) =>
            prev.map((m) =>
              m._id === editTarget._id
                ? { ...m, text: json.text || trimmed, editedAt: json.editedAt || new Date().toISOString() }
                : m
            );
          if (isGlobalRoom) setGlobalMessages(applyEdit);
          else setMessages(applyEdit);
          setEditTarget(null);
          setDraft('');
          showToast('success', 'Pesan berhasil diperbarui.');
        } else {
          showToast('error', json.error || 'Gagal mengedit pesan.');
        }
      } catch {
        showToast('error', 'Gagal mengedit pesan.');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!draft.trim() && !selectedSticker && !mediaPreview) return;

    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    emitTyping(false);

    setSending(true);
    try {
      const endpoint = isGroupRoom
        ? `/api/social/groups/${encodeURIComponent(activeGroupId)}/messages`
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
          replyText:
            replyTarget?.text ||
            (replyTarget?.sticker
              ? '[Stiker VIP]'
              : replyTarget?.mediaType
              ? `[${replyTarget.mediaType}]`
              : ''),
        }),
      });
      const json = await res.json();
      if (res.ok && json.message) {
        if (isGlobalRoom) {
          setGlobalMessages((prev) => mergeMessageList(prev, json.message));
        } else {
          setMessages((prev) => mergeMessageList(prev, json.message));
        }
        setDraft('');
        setSelectedSticker('');
        setMediaPreview(null);
        setReplyTarget(null);
        setShowEmojiDrawer(false);
        void loadConversations();
        scrollToBottom('smooth');
      } else {
        showToast('error', json.error || 'Gagal mengirim pesan.');
      }
    } catch {
      showToast('error', 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!me) return;

      let previousReactions: Record<string, string[]> | undefined;
      const optimisticToggle = (prev: ChatMessageItem[]) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          previousReactions = m.reactions;
          const next: Record<string, string[]> = {};
          if (m.reactions && typeof m.reactions === 'object') {
            for (const [k, list] of Object.entries(m.reactions)) {
              if (Array.isArray(list) && list.length > 0) {
                next[k] = [...list];
              }
            }
          }
          const cur = next[emoji] || [];
          if (cur.includes(me.uid)) {
            const filtered = cur.filter((id) => id !== me.uid);
            if (filtered.length > 0) next[emoji] = filtered;
            else delete next[emoji];
          } else {
            next[emoji] = [...cur, me.uid];
          }
          return { ...m, reactions: next };
        });

      if (isGlobalRoom) setGlobalMessages(optimisticToggle);
      else setMessages(optimisticToggle);

      try {
        const res = await fetch(
          `/api/social/chat/${activeRoomType}/${encodeURIComponent(messageId)}/react`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ emoji }),
          }
        );
        const json = await res.json();
        if (res.ok && json.reactions) {
          const applyReaction = (prev: ChatMessageItem[]) =>
            prev.map((m) => (m._id === messageId ? { ...m, reactions: json.reactions } : m));
          if (isGlobalRoom) setGlobalMessages(applyReaction);
          else setMessages(applyReaction);
        } else {
          const rollback = (prev: ChatMessageItem[]) =>
            prev.map((m) => (m._id === messageId ? { ...m, reactions: previousReactions || {} } : m));
          if (isGlobalRoom) setGlobalMessages(rollback);
          else setMessages(rollback);
          showToast('error', json.error || 'Gagal memperbarui reaksi.');
        }
      } catch {
        const rollback = (prev: ChatMessageItem[]) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions: previousReactions || {} } : m));
        if (isGlobalRoom) setGlobalMessages(rollback);
        else setMessages(rollback);
      }
    },
    [me?.uid, activeRoomType, isGlobalRoom, showToast]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const endpoint =
        activeRoomType === 'global'
          ? `/api/social/global-messages/${encodeURIComponent(messageId)}`
          : activeRoomType === 'group'
          ? `/api/social/groups/messages/${encodeURIComponent(messageId)}`
          : `/api/social/messages/${encodeURIComponent(messageId)}`;

      try {
        const res = await fetch(endpoint, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          if (activeRoomType === 'global') {
            setGlobalMessages((prev) => prev.filter((m) => m._id !== messageId));
          } else {
            setMessages((prev) => prev.filter((m) => m._id !== messageId));
          }
          showToast('info', 'Pesan dihapus.');
        } else {
          const json = await res.json().catch(() => ({}));
          showToast('error', json.error || 'Gagal menghapus pesan.');
        }
      } catch {
        showToast('error', 'Gagal menghapus pesan.');
      }
    },
    [activeRoomType, showToast]
  );

  const handleCopyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast('success', 'Teks disalin ke clipboard.');
      } catch {
        showToast('error', 'Tidak dapat menyalin teks.');
      }
    },
    [showToast]
  );

  const handleStartEdit = useCallback((msg: ChatMessageItem) => {
    setReplyTarget(null);
    setEditTarget(msg);
    setDraft(msg.text || '');
  }, []);

  const uploadImageFile = useCallback(
    async (file: File) => {
      setMediaError(null);
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
        setMediaError(err?.message || 'Gagal mengompresi/mengunggah gambar (maksimal 1MB).');
      } finally {
        setUploadingMedia(false);
      }
    },
    [me?.uid]
  );

  const handleMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (type === 'image') {
      await uploadImageFile(file);
      return;
    }

    setMediaError(null);
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
      vnCancelledRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (vnCancelledRef.current) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setMediaPreview({ url: String(reader.result), type: 'audio' });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecordingVn(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      showToast('error', 'Gagal mengakses mikrofon. Pastikan izin mikrofon diaktifkan.');
    }
  };

  const stopVnRecording = () => {
    if (mediaRecorderRef.current && isRecordingVn) {
      vnCancelledRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecordingVn(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelVnRecording = () => {
    if (mediaRecorderRef.current && isRecordingVn) {
      vnCancelledRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecordingVn(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      showToast('info', 'Rekaman VN dibatalkan.');
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
        showToast('success', `Grup "${json.group.name}" berhasil dibuat!`);
        navigate(`/chat?group=${json.group.groupId}`);
      } else {
        showToast('error', json.error || 'Gagal membuat grup.');
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleInviteByUid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUid.trim() || !activeGroupId || inviting) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/social/groups/${encodeURIComponent(activeGroupId)}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ targetUid: inviteUid.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('success', json.message || 'Berhasil mengundang user ke grup!');
        setInviteUid('');
        setShowInviteModal(false);
        void loadGroupThread(true);
      } else {
        showToast('error', json.error || 'Gagal mengundang anggota.');
      }
    } catch {
      showToast('error', 'Gagal mengundang anggota grup.');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeGroupId) return;
    try {
      const compressed = await compressImageForChat(file, {
        maxSizeBytes: MAX_CHAT_IMAGE_BYTES,
        maxDimension: 800,
      });
      const dataUrl = compressed.previewDataUrl;
      const res = await fetch(`/api/social/groups/${encodeURIComponent(activeGroupId)}/avatar`, {
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
        showToast('success', 'Foto profil grup diperbarui.');
      }
    } catch {
      showToast('error', 'Gagal mengubah foto profil grup.');
    }
  };

  const cycleWallpaper = () => {
    const next: WallpaperMode =
      wallpaperMode === 'pattern' ? 'clean' : wallpaperMode === 'clean' ? 'aurora' : 'pattern';
    setWallpaperMode(next);
    localStorage.setItem('zonestream_chat_wallpaper', next);
    const label =
      next === 'pattern' ? 'Pola Klasik' : next === 'clean' ? 'Minimalis Bersih' : 'Gradasi Malam';
    showToast('info', `Tema chat: ${label}`);
  };

  const roomWallpaperClass =
    wallpaperMode === 'pattern'
      ? 'wa-wallpaper'
      : wallpaperMode === 'aurora'
      ? 'bg-gradient-to-br from-slate-100 via-indigo-50/60 to-emerald-50/50 dark:from-[#0A1017] dark:via-[#111927] dark:to-[#0C191A]'
      : 'bg-slate-100/80 dark:bg-[#0B141A]';

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
            Masuk akun terlebih dahulu untuk mulai chatting real-time, buat grup anime &amp; donghua, kirim foto, video, VN, reaksi emoji, dan stiker VIP.
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

  const totalDmUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

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

  const typingList = Object.values(typingPeers);
  const typingSummaryText =
    typingList.length === 1
      ? `${typingList[0].name} sedang mengetik...`
      : typingList.length > 1
      ? `${typingList.length} orang sedang mengetik...`
      : '';

  const renderFeedWithGrouping = (list: ChatMessageItem[], mode: 'dm' | 'group' | 'global') => {
    const cleanSearch = roomSearchOpen ? roomSearchQuery.trim().toLowerCase() : '';
    const visibleList = cleanSearch
      ? list.filter(
          (m) =>
            m.text?.toLowerCase().includes(cleanSearch) ||
            m.senderName?.toLowerCase().includes(cleanSearch)
        )
      : list;

    if (cleanSearch && visibleList.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-slate-400">
          Tidak ditemukan pesan yang cocok dengan "{roomSearchQuery}".
        </div>
      );
    }

    const GROUP_GAP_MS = 3 * 60 * 1000;

    return visibleList.map((m, idx) => {
      const prev = idx > 0 ? visibleList[idx - 1] : null;
      const next = idx < visibleList.length - 1 ? visibleList[idx + 1] : null;
      const showDateDivider = !prev || !isSameCalendarDay(prev.createdAt, m.createdAt);

      const prevTime = prev?.createdAt ? new Date(prev.createdAt).getTime() : 0;
      const curTime = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const nextTime = next?.createdAt ? new Date(next.createdAt).getTime() : 0;

      const isFirstInGroup =
        !prev ||
        showDateDivider ||
        prev.senderUid !== m.senderUid ||
        curTime - prevTime > GROUP_GAP_MS;

      const nextSameDay = next ? isSameCalendarDay(m.createdAt, next.createdAt) : false;
      const isLastInGroup =
        !next ||
        !nextSameDay ||
        next.senderUid !== m.senderUid ||
        nextTime - curTime > GROUP_GAP_MS;

      return (
        <React.Fragment key={m._id}>
          {showDateDivider && (
            <ChatDateDivider
              label={formatChatDateLabel(m.createdAt)}
              darkSurface={mode === 'global'}
            />
          )}
          <ChatMessageBubble
            message={m}
            mode={mode}
            meUid={me.uid}
            isFounder={isFounder}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            isHighlighted={highlightedMsgId === m._id}
            msgIndex={idx}
            onReply={(msg) => {
              setEditTarget(null);
              setReplyTarget(msg);
            }}
            onReact={handleToggleReaction}
            onEdit={handleStartEdit}
            onDelete={handleDeleteMessage}
            onCopy={handleCopyText}
            onZoomMedia={setZoomMedia}
            onJumpToMessage={jumpToMessage}
          />
        </React.Fragment>
      );
    });
  };

  const renderLastMsgPreview = (c: ChatConversationSummary) => {
    const lm = c.lastMessage;
    if (!lm) return <span className="italic">Mulai obrolan baru</span>;
    if (lm.text) return <span className="truncate">{lm.text}</span>;
    if (lm.sticker) return <span className="truncate text-amber-500">Stiker VIP</span>;
    if (lm.mediaType === 'image') return <span className="truncate">Mengirim Foto</span>;
    if (lm.mediaType === 'video') return <span className="truncate">Mengirim Video</span>;
    if (lm.mediaType === 'audio') return <span className="truncate">Voice Note</span>;
    return <span className="truncate">Pesan</span>;
  };

  return (
    <Layout hideBottomNav={Boolean(peerUid || isGroupRoom || isGlobalRequested)}>
      <input
        ref={groupAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleChangeGroupAvatar}
        className="hidden"
      />

      {/* In-App Floating Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-xs animate-zs-page-enter">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs font-bold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-600/95 border-emerald-400/50 text-white'
                : toast.type === 'error'
                ? 'bg-rose-600/95 border-rose-400/50 text-white'
                : 'bg-slate-900/95 border-white/15 text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 sm:pt-4 pb-0 sm:pb-6">
        <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] min-h-[560px] sm:rounded-3xl overflow-hidden border-t sm:border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shadow-2xl flex">
          {/* LEFT PANE: Inbox, Global Card, Groups, Friends */}
          <aside
            className={`${
              peerUid || isGroupRoom || isGlobalRequested ? 'hidden md:flex' : 'flex'
            } w-full md:w-[350px] lg:w-[390px] flex-col border-r border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111B21] shrink-0`}
          >
            {/* Sidebar Top Header */}
            <div className="h-16 px-4 bg-slate-50 dark:bg-[#202C33] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Link to="/profile" className="shrink-0">
                  <AvatarDecoration
                    src={me.photoUrl}
                    alt={me.name}
                    decorationId={me.activeBorder}
                    level={me.level}
                    isFounder={me.role === 'founder'}
                    size="sm"
                  />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      ZoneChat
                    </p>
                    {totalDmUnread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#E84A18] text-white text-[10px] font-extrabold font-mono-tabular">
                        {totalDmUnread}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        wsConnected ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                    />
                    <span>{wsConnected ? 'Live Real-Time' : 'Sinkronisasi'} · {groups.length} Grup</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className="px-3 py-1.5 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center gap-1 shadow transition-colors"
                title="Buat Grup Baru"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Grup</span>
              </button>
            </div>

            {/* Pinned Global Chat Card */}
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
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold shrink-0">
                    {globalOnlineCount} Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                  {globalMessages.length > 0
                    ? `${globalMessages[globalMessages.length - 1].senderName}: ${
                        globalMessages[globalMessages.length - 1].text || '[Media / Stiker]'
                      }`
                    : 'Ruang obrolan terbuka untuk semua member!'}
                </p>
              </div>
            </Link>

            {/* 3 Segmented Tabs: Chat, Grup, Teman */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-[#0D151A] border-b border-slate-200 dark:border-white/[0.06] gap-1">
              <button
                type="button"
                onClick={() => setChatTab('dm')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all truncate px-1 ${
                  chatTab === 'dm'
                    ? 'bg-white dark:bg-[#202C33] text-[#E84A18] shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Obrolan ({conversations.length})
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
                    chatTab === 'group'
                      ? 'Cari nama grup...'
                      : 'Cari obrolan atau user (nama/UID)...'
                  }
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-[#202C33] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                />
              </div>
            </div>

            {/* Sidebar List Content */}
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
                            level={c.peer.level}
                            isFounder={c.peer.role === 'founder'}
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
                              {c.lastMessage?.senderUid === me.uid && (
                                <CheckCheck
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    c.lastMessage.readAt ? 'text-sky-400' : 'text-slate-400'
                                  }`}
                                />
                              )}
                              {renderLastMsgPreview(c)}
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
                        Belum ada obrolan pribadi. Cari user di atas atau chat VerzonFounder (UID: 00000)!
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
                    const active = activeGroupId === g.groupId;
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
                              {g.members?.length || 1} Member
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">
                            {g.description || 'Grup komunitas ZoneStream'}
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
                <div className="p-3 space-y-4">
                  {friendsData.incomingRequests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                        Permintaan Pertemanan Masuk ({friendsData.incomingRequests.length})
                      </p>
                      {friendsData.incomingRequests.map((req) => (
                        <div
                          key={req.uid}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#202C33] border border-slate-200 dark:border-white/5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={req.photoUrl || defaultAvatarImg}
                              alt={req.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {req.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                @{req.username || req.uid}
                              </p>
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
                              onClick={() => handleRemoveFriend(req.uid, req.name)}
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
                        Belum ada teman. Cari user di tab Obrolan untuk menambah teman!
                      </p>
                    ) : (
                      friendsData.friends.map((f) => (
                        <div
                          key={f.uid}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white dark:bg-[#202C33] border border-slate-200 dark:border-white/5"
                        >
                          <Link
                            to={`/chat/${f.uid}`}
                            className="flex items-center gap-2.5 min-w-0 flex-1"
                          >
                            <div className="relative shrink-0">
                              <img
                                src={f.photoUrl || defaultAvatarImg}
                                alt={f.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              {f.isOnline && (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#202C33]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-emerald-500 font-semibold">
                                {f.isOnline ? 'Online · Klik untuk Chat' : formatLastSeen(f.lastActiveAt)}
                              </p>
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
                              onClick={() => handleRemoveFriend(f.uid, f.name)}
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

          {/* RIGHT PANE: Active Chat Room */}
          <section
            className={`${
              peerUid || isGroupRoom || isGlobalRequested ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 relative`}
          >
            {isGlobalRoom ? (
              /* GLOBAL CHAT ROOM */
              <div className="flex-1 flex flex-col bg-[#0D0E12] text-white min-h-0 relative">
                {/* Header */}
                <div className="h-14 px-3 sm:px-4 bg-[#12141A] border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => (isGlobalRequested ? navigate('/chat') : navigate('/'))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-300 hover:bg-white/10 transition-colors"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white truncate">
                        Chat Global
                      </h2>
                      {typingSummaryText && (
                        <p className="text-[11px] text-sky-400 font-semibold animate-pulse truncate">
                          {typingSummaryText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen((v) => !v);
                        setRoomSearchQuery('');
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        roomSearchOpen ? 'bg-sky-500/20 text-sky-300' : 'text-gray-300 hover:bg-white/10'
                      }`}
                      title="Cari Pesan"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <Link
                      to="/profile"
                      className="text-[11px] font-bold text-sky-400 hover:underline truncate max-w-[90px] px-2"
                    >
                      #{me.uid}
                    </Link>
                  </div>
                </div>

                {/* In-Room Search Bar */}
                {roomSearchOpen && (
                  <div className="px-4 py-2 bg-[#161922] border-b border-white/10 flex items-center gap-2 shrink-0">
                    <Search className="w-4 h-4 text-sky-400 shrink-0" />
                    <input
                      type="search"
                      autoFocus
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      placeholder="Cari pesan atau nama pengirim di channel ini..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen(false);
                        setRoomSearchQuery('');
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Scam Warning + Channel Pills */}
                <div className="px-3 sm:px-4 pt-2.5 pb-2 space-y-2 bg-[#0D0E12] border-b border-white/[0.05] shrink-0">
                  <div className="rounded-xl bg-[#271F10] border border-amber-500/30 px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-200/90 leading-snug">
                      Hati-hati penipuan. Jangan bagikan kata sandi/OTP dan dilarang berjualan.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
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
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
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

                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{globalOnlineCount} online</span>
                    </div>
                  </div>
                </div>

                {/* Global Messages Feed */}
                <div
                  ref={feedRef}
                  onScroll={handleFeedScroll}
                  className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 bg-[#0D0E12]"
                >
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
                    renderFeedWithGrouping(globalMessages, 'global')
                  )}

                  {typingSummaryText && (
                    <div className="mt-2 ml-11 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171A22] border border-white/10 text-[11px] text-sky-300">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                      <span>{typingSummaryText}</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll-to-bottom FAB */}
                {(showScrollFab || unreadBelow > 0) && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-28 right-4 z-20 px-3 py-2 rounded-full bg-[#1D7AFC] hover:bg-[#388BFF] text-white text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform hover:scale-105"
                  >
                    <ArrowDown className="w-4 h-4" />
                    {unreadBelow > 0 && <span>{unreadBelow} baru</span>}
                  </button>
                )}

                <ChatComposer
                  mode="global"
                  placeholder="Silakan masukkan pesan..."
                  maxLength={255}
                  draft={draft}
                  onDraftChange={handleDraftChange}
                  onSubmit={handleSend}
                  sending={sending}
                  canUseVip={canUseVip}
                  selectedSticker={selectedSticker}
                  onSelectSticker={setSelectedSticker}
                  showEmojiDrawer={showEmojiDrawer}
                  onToggleEmojiDrawer={() => setShowEmojiDrawer((s) => !s)}
                  emojiTab={emojiTab}
                  onChangeEmojiTab={setEmojiTab}
                  replyTarget={replyTarget}
                  onClearReply={() => setReplyTarget(null)}
                  editTarget={editTarget}
                  onCancelEdit={() => {
                    setEditTarget(null);
                    setDraft('');
                  }}
                  mediaPreview={mediaPreview}
                  onClearMediaPreview={() => setMediaPreview(null)}
                  uploadingMedia={uploadingMedia}
                  uploadProgress={uploadProgress}
                  mediaError={mediaError}
                  onClearMediaError={() => setMediaError(null)}
                  onFileSelect={handleMediaUpload}
                  onPasteImageFile={uploadImageFile}
                  isRecordingVn={isRecordingVn}
                  recordingSeconds={recordingSeconds}
                  onStartVn={startVnRecording}
                  onStopVn={stopVnRecording}
                  onCancelVn={cancelVnRecording}
                />

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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate('/chat')}
                      className="md:hidden min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    {activeGroup && (
                      <div
                        onClick={() => setShowGroupInfoModal(true)}
                        className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                      >
                        <img
                          src={activeGroup.avatarUrl || defaultAvatarImg}
                          alt={activeGroup.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-sm shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-[#00A884] truncate">
                              {activeGroup.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#00A884]/20 text-[#00A884] text-[10px] font-bold shrink-0">
                              {activeGroup.members?.length || 1} Member
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {typingSummaryText ? (
                              <span className="text-[#00A884] font-semibold animate-pulse">
                                {typingSummaryText}
                              </span>
                            ) : (
                              activeGroup.description || 'Ketuk untuk info & pengaturan grup'
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen((v) => !v);
                        setRoomSearchQuery('');
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        roomSearchOpen
                          ? 'bg-[#00A884]/15 text-[#00A884]'
                          : 'text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      title="Cari Pesan"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cycleWallpaper}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Ganti Tema Wallpaper"
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow transition-colors"
                      title="Tambah Anggota ke Grup"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Undang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGroupInfoModal(true)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Info Grup"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {roomSearchOpen && (
                  <div className="px-4 py-2 bg-white dark:bg-[#1A242B] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-2 shrink-0">
                    <Search className="w-4 h-4 text-[#00A884] shrink-0" />
                    <input
                      type="search"
                      autoFocus
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      placeholder="Cari pesan atau nama anggota di grup..."
                      className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen(false);
                        setRoomSearchQuery('');
                      }}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Group Messages Feed */}
                <div
                  ref={feedRef}
                  onScroll={handleFeedScroll}
                  className={`flex-1 overflow-y-auto ${roomWallpaperClass} px-3 sm:px-6 py-4`}
                >
                  {loadingThread && messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">Memuat pesan grup...</div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Grup {activeGroup?.name} siap digunakan!
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">
                        Kirim pesan, foto, video, VN, atau reaksi emoji bersama anggota grup.
                      </p>
                    </div>
                  ) : (
                    renderFeedWithGrouping(messages, 'group')
                  )}

                  {typingSummaryText && (
                    <div className="mt-2 ml-9 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#202C33]/90 border border-slate-200 dark:border-white/10 text-[11px] text-[#00A884] font-semibold shadow-sm">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce [animation-delay:300ms]" />
                      </span>
                      <span>{typingSummaryText}</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {(showScrollFab || unreadBelow > 0) && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-20 right-5 z-20 px-3 py-2 rounded-full bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform hover:scale-105"
                  >
                    <ArrowDown className="w-4 h-4" />
                    {unreadBelow > 0 && <span>{unreadBelow} baru</span>}
                  </button>
                )}

                <ChatComposer
                  mode="group"
                  placeholder="Ketik pesan grup..."
                  maxLength={1500}
                  draft={draft}
                  onDraftChange={handleDraftChange}
                  onSubmit={handleSend}
                  sending={sending}
                  canUseVip={canUseVip}
                  selectedSticker={selectedSticker}
                  onSelectSticker={setSelectedSticker}
                  showEmojiDrawer={showEmojiDrawer}
                  onToggleEmojiDrawer={() => setShowEmojiDrawer((s) => !s)}
                  emojiTab={emojiTab}
                  onChangeEmojiTab={setEmojiTab}
                  replyTarget={replyTarget}
                  onClearReply={() => setReplyTarget(null)}
                  editTarget={editTarget}
                  onCancelEdit={() => {
                    setEditTarget(null);
                    setDraft('');
                  }}
                  mediaPreview={mediaPreview}
                  onClearMediaPreview={() => setMediaPreview(null)}
                  uploadingMedia={uploadingMedia}
                  uploadProgress={uploadProgress}
                  mediaError={mediaError}
                  onClearMediaError={() => setMediaError(null)}
                  onFileSelect={handleMediaUpload}
                  onPasteImageFile={uploadImageFile}
                  isRecordingVn={isRecordingVn}
                  recordingSeconds={recordingSeconds}
                  onStartVn={startVnRecording}
                  onStopVn={stopVnRecording}
                  onCancelVn={cancelVnRecording}
                />
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
                        <AvatarDecoration
                          src={peer.photoUrl}
                          alt={peer.name}
                          decorationId={peer.activeBorder}
                          level={peer.level}
                          isFounder={peer.role === 'founder'}
                          size="sm"
                        >
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
                            {typingSummaryText ? (
                              <span className="text-[#00A884] font-semibold animate-pulse">
                                sedang mengetik...
                              </span>
                            ) : peer.isOnline ? (
                              <span className="text-emerald-500 font-semibold">Online</span>
                            ) : (
                              formatLastSeen(peer.lastActiveAt)
                            )}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {relationship === 'none' && peer && (
                      <button
                        type="button"
                        onClick={() => handleSendFriendRequest(peer.uid)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E84A18]/15 text-[#E84A18] hover:bg-[#E84A18] hover:text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tambah Teman</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen((v) => !v);
                        setRoomSearchQuery('');
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        roomSearchOpen
                          ? 'bg-[#00A884]/15 text-[#00A884]'
                          : 'text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      title="Cari Pesan"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cycleWallpaper}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Ganti Tema Wallpaper"
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {roomSearchOpen && (
                  <div className="px-4 py-2 bg-white dark:bg-[#1A242B] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-2 shrink-0">
                    <Search className="w-4 h-4 text-[#00A884] shrink-0" />
                    <input
                      type="search"
                      autoFocus
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      placeholder="Cari isi pesan dalam obrolan ini..."
                      className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRoomSearchOpen(false);
                        setRoomSearchQuery('');
                      }}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* DM Messages Feed */}
                <div
                  ref={feedRef}
                  onScroll={handleFeedScroll}
                  className={`flex-1 overflow-y-auto ${roomWallpaperClass} px-3 sm:px-6 py-4`}
                >
                  {loadingThread && messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">Memuat pesan...</div>
                  ) : messages.length === 0 ? (
                    <div className="max-w-xs mx-auto my-8 rounded-2xl bg-white/90 dark:bg-[#182229]/90 border border-slate-200 dark:border-white/10 p-4 text-center shadow-sm">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        Mulai obrolan dengan {peer?.name || 'teman'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">
                        Pesan, foto, video, voice note, dan reaksi emoji tersinkron real-time!
                      </p>
                    </div>
                  ) : (
                    renderFeedWithGrouping(messages, 'dm')
                  )}

                  {typingSummaryText && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#202C33]/90 border border-slate-200 dark:border-white/10 text-[11px] text-[#00A884] font-semibold shadow-sm">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A884] animate-bounce [animation-delay:300ms]" />
                      </span>
                      <span>sedang mengetik...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {(showScrollFab || unreadBelow > 0) && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-20 right-5 z-20 px-3 py-2 rounded-full bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform hover:scale-105"
                  >
                    <ArrowDown className="w-4 h-4" />
                    {unreadBelow > 0 && <span>{unreadBelow} baru</span>}
                  </button>
                )}

                <ChatComposer
                  mode="dm"
                  placeholder={`Ketik pesan untuk ${peer?.name || 'teman'}...`}
                  maxLength={1200}
                  draft={draft}
                  onDraftChange={handleDraftChange}
                  onSubmit={handleSend}
                  sending={sending}
                  canUseVip={canUseVip}
                  selectedSticker={selectedSticker}
                  onSelectSticker={setSelectedSticker}
                  showEmojiDrawer={showEmojiDrawer}
                  onToggleEmojiDrawer={() => setShowEmojiDrawer((s) => !s)}
                  emojiTab={emojiTab}
                  onChangeEmojiTab={setEmojiTab}
                  replyTarget={replyTarget}
                  onClearReply={() => setReplyTarget(null)}
                  editTarget={editTarget}
                  onCancelEdit={() => {
                    setEditTarget(null);
                    setDraft('');
                  }}
                  mediaPreview={mediaPreview}
                  onClearMediaPreview={() => setMediaPreview(null)}
                  uploadingMedia={uploadingMedia}
                  uploadProgress={uploadProgress}
                  mediaError={mediaError}
                  onClearMediaError={() => setMediaError(null)}
                  onFileSelect={handleMediaUpload}
                  onPasteImageFile={uploadImageFile}
                  isRecordingVn={isRecordingVn}
                  recordingSeconds={recordingSeconds}
                  onStartVn={startVnRecording}
                  onStopVn={stopVnRecording}
                  onCancelVn={cancelVnRecording}
                />
              </>
            )}
          </section>
        </div>
      </div>

      {/* Confirmation Dialog Modal (replaces native window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#111B21] border border-slate-200 dark:border-white/15 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-200 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await fn();
                }}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold shadow ${
                  confirmDialog.danger
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-[#00A884] hover:bg-[#06CF9C]'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info & Settings Modal */}
      {showGroupInfoModal && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111B21] border border-slate-200 dark:border-white/15 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Info Grup</h3>
              <button
                type="button"
                onClick={() => setShowGroupInfoModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <img
                  src={activeGroup.avatarUrl || defaultAvatarImg}
                  alt={activeGroup.name}
                  className="w-16 h-16 rounded-full object-cover border border-white/20 shadow"
                />
                <button
                  type="button"
                  onClick={() => groupAvatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Ubah Foto Grup"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {activeGroup.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  {activeGroup.description || 'Grup komunitas ZoneStream'}
                </p>
                <p className="text-[11px] font-bold text-[#00A884] mt-1">
                  {activeGroup.members?.length || 1} Anggota · ID: {activeGroup.groupId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => groupAvatarInputRef.current?.click()}
                className="h-10 rounded-xl bg-slate-100 dark:bg-[#202C33] text-slate-800 dark:text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-[#2A3942]"
              >
                <Camera className="w-4 h-4" />
                <span>Ganti Foto</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGroupInfoModal(false);
                  setShowInviteModal(true);
                }}
                className="h-10 rounded-xl bg-[#00A884] hover:bg-[#06CF9C] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow"
              >
                <UserPlus className="w-4 h-4" />
                <span>Undang UID</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Media Modal */}
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
              <img
                src={zoomMedia.url}
                alt="Zoomed"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <video
                src={zoomMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
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
                  placeholder="contoh: 00000 atau 5280074"
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
