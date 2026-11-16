import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  CornerDownRight,
  Crown,
  Heart,
  Lock,
  MoreVertical,
  Pin,
  Send,
  Smile,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VerifiedBadge } from './VerifiedBadge';
import { AvatarDecoration } from './AvatarDecoration';
import { CountryFlagBadge, detectClientCountryCode } from './CountryFlag';
import {
  FREE_EMOJIS,
  VIP_EMOJIS,
  VipStickerCard,
  renderCommentRichText,
} from './VipEmojis';
import type { CommentItem } from '../types';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';
import defaultBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';
import donghuaHeroBanner from '../assets/images/donghua_hero_fallback_1794755348232.jpg';

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}

function getDonorRank(uid: string): number {
  if (uid === '00000') return 1;
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) % 99;
  }
  return Math.max(2, hash);
}

function getVipNameColorClass(c: CommentItem): string {
  if (
    c.authorRole === 'founder' ||
    c.authorBadge?.toUpperCase().includes('YANG MULIA') ||
    c.authorBadge === 'Donghua Master' ||
    c.authorTheme === 'crimson-emperor'
  ) {
    return 'text-[#FF3B30] hover:text-[#FF6961]';
  }
  if (c.authorBadge === 'Anime Legend' || c.authorTheme === 'sakura-bloom') {
    return 'text-[#F472B6] hover:text-[#F9A8D4]';
  }
  if (c.authorBadge === 'Immortal Sovereign' || c.authorTheme === 'sovereign-gold') {
    return 'text-[#FBBF24] hover:text-[#FDE68A]';
  }
  return 'text-[#38BDF8] hover:text-[#7DD3FC]';
}

function getVipBadgeVariant(
  c: CommentItem
): 'red' | 'pink' | 'gold' | 'blue' | 'purple' {
  if (
    c.authorRole === 'founder' ||
    c.authorBadge?.toUpperCase().includes('YANG MULIA') ||
    c.authorBadge === 'Donghua Master' ||
    c.authorTheme === 'crimson-emperor'
  ) {
    return 'red';
  }
  if (c.authorBadge === 'Anime Legend' || c.authorTheme === 'sakura-bloom') {
    return 'pink';
  }
  if (c.authorBadge === 'Immortal Sovereign' || c.authorTheme === 'sovereign-gold') {
    return 'gold';
  }
  return 'blue';
}

function getVipBannerUrl(c: CommentItem): string {
  if (c.authorBanner && c.authorBanner.trim().length > 5) {
    return c.authorBanner;
  }
  if (c.authorRole === 'founder' || c.authorTheme === 'crimson-emperor') {
    return donghuaHeroBanner;
  }
  return defaultBannerImg;
}

export function CommentSection({
  mediaKey,
  mediaTitle,
  episodeTitle = '',
}: {
  mediaKey: string;
  mediaTitle: string;
  episodeTitle?: string;
}) {
  const { user, isPremium, applyUserSnapshot, refreshUser } = useAuth();
  const canUseVipEmoji = Boolean(isPremium || user?.role === 'founder');
  const isFounder = user?.role === 'founder';

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'popular' | 'latest'>('popular');

  // Top-level main comment composer state
  const [text, setText] = useState('');
  const [selectedSticker, setSelectedSticker] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commentExpNotice, setCommentExpNotice] = useState<{
    expGained: number;
    levelUp: boolean;
    newLevel: number;
    totalCommentsCount: number;
  } | null>(null);

  // Inline Reply Composer state (renders directly inside the target root comment)
  const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(null);
  const [replyMentionName, setReplyMentionName] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [replySticker, setReplySticker] = useState<string>('');
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyErrorMsg, setReplyErrorMsg] = useState<string | null>(null);

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      const res = await fetch(
        `/api/comments?mediaKey=${encodeURIComponent(mediaKey)}&sort=${sort}`
      );
      const json = await res.json();
      if (json.ok && Array.isArray(json.comments)) {
        setComments(json.comments);
        // Auto-expand threads that have replies so nested replies are visible inside
        const autoExpand: Record<string, boolean> = {};
        for (const item of json.comments as CommentItem[]) {
          if (item.parentId) {
            autoExpand[item.parentId] = true;
          }
        }
        setExpandedReplies((prev) => ({ ...autoExpand, ...prev }));
      }
    } catch {
      // Keep existing comments on transient network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadComments();
  }, [mediaKey, sort]);

  const getAuthToken = () =>
    localStorage.getItem('zonestream_session_token_v1') ||
    localStorage.getItem('donghive_session_token_v1') ||
    '';

  // Submit root comment
  const handleSubmitRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!text.trim() && !selectedSticker) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = getAuthToken();
      const countryCode = user.countryCode || detectClientCountryCode();
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-client-country': countryCode,
        },
        body: JSON.stringify({
          mediaKey,
          mediaTitle,
          episodeTitle,
          parentId: '',
          text: text.trim(),
          sticker: selectedSticker,
          countryCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Gagal mengirim komentar');
      } else {
        setText('');
        setSelectedSticker('');
        setShowEmojiPicker(false);
        if (json.user) {
          applyUserSnapshot(json.user);
        } else {
          void refreshUser();
        }
        if (json.expReward?.expGained) {
          setCommentExpNotice(json.expReward);
          window.setTimeout(() => setCommentExpNotice(null), 5000);
        }
        await loadComments();
      }
    } catch {
      setErrorMsg('Gagal menghubungi server komentar');
    } finally {
      setSubmitting(false);
    }
  };

  // Open inline reply input directly inside a comment card
  const handleStartInlineReply = (rootComment: CommentItem, mentionTarget?: CommentItem) => {
    if (!user) return;
    const targetName = mentionTarget?.authorName || rootComment.authorName;
    setActiveReplyParentId(rootComment._id);
    setReplyMentionName(targetName);
    setExpandedReplies((prev) => ({ ...prev, [rootComment._id]: true }));
    setReplyErrorMsg(null);
    if (mentionTarget && mentionTarget._id !== rootComment._id) {
      setReplyText(`@${targetName} `);
    } else {
      setReplyText('');
    }
    setOpenMenuId(null);
  };

  // Submit inline reply inside the comment card
  const handleSubmitInlineReply = async (e: React.FormEvent, parentCommentId: string) => {
    e.preventDefault();
    if (!user) return;
    if (!replyText.trim() && !replySticker) return;

    setReplySubmitting(true);
    setReplyErrorMsg(null);
    try {
      const token = getAuthToken();
      const countryCode = user.countryCode || detectClientCountryCode();
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-client-country': countryCode,
        },
        body: JSON.stringify({
          mediaKey,
          mediaTitle,
          episodeTitle,
          parentId: parentCommentId,
          text: replyText.trim(),
          sticker: replySticker,
          countryCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReplyErrorMsg(json.error || 'Gagal mengirim balasan');
      } else {
        setExpandedReplies((prev) => ({ ...prev, [parentCommentId]: true }));
        setReplyText('');
        setReplySticker('');
        setShowReplyEmojiPicker(false);
        setActiveReplyParentId(null);
        if (json.user) {
          applyUserSnapshot(json.user);
        } else {
          void refreshUser();
        }
        if (json.expReward?.expGained) {
          setCommentExpNotice(json.expReward);
          window.setTimeout(() => setCommentExpNotice(null), 5000);
        }
        await loadComments();
      }
    } catch {
      setReplyErrorMsg('Gagal menghubungi server komentar');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;
    const token = getAuthToken();
    const res = await fetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok && Array.isArray(json.likes)) {
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, likes: json.likes } : c))
      );
    }
  };

  const handlePin = async (commentId: string) => {
    const token = getAuthToken();
    const res = await fetch(`/api/comments/${commentId}/pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpenMenuId(null);
    if (res.ok) await loadComments();
  };

  const handleDelete = async (commentId: string) => {
    const token = getAuthToken();
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpenMenuId(null);
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c._id !== commentId && c.parentId !== commentId));
    }
  };

  const rootComments = comments.filter((c) => !c.parentId);
  const repliesMap = new Map<string, CommentItem[]>();
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesMap.get(c.parentId) || [];
      list.push(c);
      repliesMap.set(c.parentId, list);
    }
  }
  // Sort replies chronologically inside each thread (oldest to newest)
  for (const [k, list] of repliesMap.entries()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    repliesMap.set(k, list);
  }

  const renderInlineReplyBox = (parentComment: CommentItem, isDarkVipCard: boolean) => {
    if (activeReplyParentId !== parentComment._id || !user) return null;

    return (
      <form
        onSubmit={(e) => handleSubmitInlineReply(e, parentComment._id)}
        className={`mt-3 rounded-2xl p-3 border transition-all ${
          isDarkVipCard
            ? 'bg-black/65 backdrop-blur-md border-white/20 text-white'
            : 'bg-white dark:bg-[#191C26] border-slate-200 dark:border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-extrabold text-[#3B82F6] flex items-center gap-1.5">
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>Membalas di dalam komentar @{replyMentionName || parentComment.authorName}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveReplyParentId(null);
              setReplyText('');
              setReplySticker('');
              setShowReplyEmojiPicker(false);
            }}
            className="text-xs text-gray-400 hover:text-rose-400 inline-flex items-center gap-1 font-semibold"
          >
            <X className="w-3.5 h-3.5" />
            <span>Tutup</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <img
            src={user.photoUrl || defaultAvatarImg}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/15"
          />
          <input
            type="text"
            autoFocus
            maxLength={800}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Tulis balasan untuk @${replyMentionName || parentComment.authorName}...`}
            className={`flex-1 bg-transparent text-xs sm:text-sm focus:outline-none ${
              isDarkVipCard
                ? 'text-white placeholder-gray-400'
                : 'text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowReplyEmojiPicker((s) => !s)}
            className="p-1.5 rounded-xl text-gray-400 hover:text-[#E84A18] transition-colors shrink-0"
            title="Tambah Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={replySubmitting || (!replyText.trim() && !replySticker)}
            className="px-3 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow-md"
          >
            <Send className="w-3 h-3" />
            <span>{replySubmitting ? '...' : 'Balas'}</span>
          </button>
        </div>

        {replySticker && (
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
            <VipStickerCard stickerId={replySticker} />
            <button
              type="button"
              onClick={() => setReplySticker('')}
              className="text-xs text-rose-400 font-bold"
            >
              Hapus Stiker
            </button>
          </div>
        )}

        {showReplyEmojiPicker && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5">
            {FREE_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setReplyText((p) => `${p}${em}`)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-base flex items-center justify-center"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {replyErrorMsg && (
          <p className="mt-1.5 text-xs font-semibold text-rose-400">{replyErrorMsg}</p>
        )}
      </form>
    );
  };

  return (
    <section className="mt-6 pt-2">
      {/* Header: Komentar (Count) + Terpopuler / Terbaru Dropdown Button */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Komentar ({comments.length})
        </h2>

        <button
          type="button"
          onClick={() => setSort((s) => (s === 'popular' ? 'latest' : 'popular'))}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E2028] dark:hover:bg-[#262934] text-slate-900 dark:text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 border border-slate-200 dark:border-white/[0.08] transition-colors"
        >
          <span>{sort === 'popular' ? 'Terpopuler' : 'Terbaru'}</span>
          <ChevronDown className="w-4 h-4 opacity-80" />
        </button>
      </div>

      {/* Clean Rounded Composer Row (Avatar on Left + Input Pill on Right) */}
      {user ? (
        <form onSubmit={handleSubmitRoot} className="mb-6">
          <div className="flex items-start gap-3">
            <img
              src={user.photoUrl || defaultAvatarImg}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover shrink-0 border border-white/10 mt-0.5"
            />

            <div className="flex-1 min-w-0">
              <div className="rounded-2xl bg-slate-100 dark:bg-[#1C1E26] border border-slate-200 dark:border-white/[0.07] px-4 py-3 transition-colors focus-within:border-[#E84A18]/60">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={800}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Tambah Komentar..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8A8F9E] focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((s) => !s)}
                    title="Emoji & Stiker VIP"
                    className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                      showEmojiPicker
                        ? 'bg-[#E84A18]/20 text-[#E84A18]'
                        : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  {(text.trim() || selectedSticker) && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-3.5 py-1.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow-md shadow-[#E84A18]/25"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submitting ? '...' : 'Kirim'}</span>
                    </button>
                  )}
                </div>

                {selectedSticker && (
                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-white/10">
                    <VipStickerCard stickerId={selectedSticker} />
                    <button
                      type="button"
                      onClick={() => setSelectedSticker('')}
                      className="text-xs text-rose-500 font-semibold hover:underline"
                    >
                      Hapus Stiker
                    </button>
                  </div>
                )}

                {errorMsg && (
                  <p className="mt-2 text-xs font-semibold text-rose-500">{errorMsg}</p>
                )}

                {commentExpNotice && (
                  <div className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                    <span>
                      +{commentExpNotice.expGained} EXP dari Komentar!{' '}
                      {commentExpNotice.levelUp
                        ? `Selamat, naik ke Lv. ${commentExpNotice.newLevel}!`
                        : `Total ${commentExpNotice.totalCommentsCount} komentar meningkatkan progress level profilmu.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Emoji & VIP Picker Drawer */}
              {showEmojiPicker && (
                <div className="mt-2.5 p-3 rounded-2xl bg-white dark:bg-[#161820] border border-slate-200 dark:border-white/10 shadow-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setEmojiTab('free')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        emojiTab === 'free'
                          ? 'bg-[#E84A18] text-white'
                          : 'bg-slate-100 dark:bg-[#1E222E] text-slate-600 dark:text-gray-300'
                      }`}
                    >
                      Emoji Umum
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmojiTab('vip')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                        emojiTab === 'vip'
                          ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white'
                          : 'bg-slate-100 dark:bg-[#1E222E] text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      <Crown className="w-3 h-3" />
                      <span>Emoji Eksklusif VIP</span>
                    </button>
                  </div>

                  {emojiTab === 'free' ? (
                    <div className="flex flex-wrap gap-2">
                      {FREE_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setText((prev) => `${prev}${em}`)}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1D212C] hover:scale-110 transition-transform text-lg flex items-center justify-center"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : !canUseVipEmoji ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-xs text-slate-700 dark:text-gray-200">
                          <strong>Emoji &amp; Kartu Komentar Banner Hidup</strong> hanya untuk member{' '}
                          <strong>Premium VIP</strong> &amp; <strong>Founder</strong>.
                        </p>
                      </div>
                      <Link
                        to="/profile"
                        className="px-3.5 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold whitespace-nowrap text-center"
                      >
                        Upgrade VIP
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {VIP_EMOJIS.map((vip) => {
                        const Icon = vip.icon;
                        return (
                          <div
                            key={vip.id}
                            className={`rounded-xl border p-2 flex flex-col gap-1.5 ${vip.bgClass} ${vip.borderClass}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-4 h-4" />
                              <span className={`text-[11px] font-bold truncate ${vip.textClass}`}>
                                {vip.label}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setText((p) => `${p} ${vip.token} `)}
                                className="flex-1 py-1 rounded-md bg-white/80 dark:bg-black/40 text-[10px] font-bold text-slate-800 dark:text-white hover:bg-[#E84A18] hover:text-white transition-colors"
                              >
                                + Teks
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSticker(vip.id)}
                                className="flex-1 py-1 rounded-md bg-white/80 dark:bg-black/40 text-[10px] font-bold text-slate-800 dark:text-white hover:bg-[#E84A18] hover:text-white transition-colors"
                              >
                                Stiker
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-2xl bg-slate-100 dark:bg-[#1C1E26] border border-slate-200 dark:border-white/[0.07] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#E84A18] shrink-0" />
            <p className="text-xs sm:text-sm text-slate-700 dark:text-gray-300">
              Masuk akun untuk ikut berkomentar dan tampilkan Banner Profil VIP di kolom komentar.
            </p>
          </div>
          <Link
            to="/profile"
            className="px-4 py-2 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-bold whitespace-nowrap"
          >
            Masuk Akun
          </Link>
        </div>
      )}

      {/* Comments Feed */}
      {loading ? (
        <div className="space-y-3.5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-slate-100 dark:bg-[#191C26] animate-pulse"
            />
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
          Belum ada komentar. Jadilah yang pertama berkomentar di sini!
        </div>
      ) : (
        <div className="space-y-3.5">
          {rootComments.map((c) => {
            const isVip = Boolean(c.authorIsPremium || c.authorRole === 'founder');
            const isCommentFounder = c.authorRole === 'founder';
            const liked = Boolean(user && c.likes.includes(user.uid));
            const replies = repliesMap.get(c._id) || [];
            const showReplies = Boolean(expandedReplies[c._id]);
            const canManage = Boolean(user && (user.uid === c.uid || isFounder));

            /* =====================================================================
             * 1. PREMIUM VIP & FOUNDER COMMENT CARD (LIVE BANNER-BACKED CARD)
             * ===================================================================== */
            if (isVip) {
              const bannerBg = getVipBannerUrl(c);
              const nameColorCls = getVipNameColorClass(c);
              const badgeVariant = getVipBadgeVariant(c);
              const royalTitle = isCommentFounder
                ? 'YANG MULIA FOUNDER'
                : (c.authorBadge && c.authorBadge !== 'Member'
                    ? c.authorBadge
                    : 'YANG MULIA VIP'
                  ).toUpperCase();
              const donorRank = getDonorRank(c.uid);

              return (
                <div
                  key={c._id}
                  className="relative rounded-2xl overflow-hidden border border-white/15 shadow-xl group transition-all"
                >
                  {/* Full-bleed Banner Background Image */}
                  <img
                    src={bannerBg}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover object-center scale-105 transition-transform duration-700 group-hover:scale-110 select-none pointer-events-none"
                  />
                  {/* Dark Atmospheric Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#160608]/85 via-[#180A10]/65 to-[#0D0F16]/85 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35 pointer-events-none" />

                  <div className="relative z-10 p-3.5 sm:p-4">
                    {c.pinned && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/40 text-[10px] font-extrabold text-amber-300 mb-2.5">
                        <Pin className="w-3 h-3" />
                        <span>Disematkan oleh Founder</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3 sm:gap-3.5">
                      {/* Left Avatar with Discord/VIP Decoration */}
                      <Link to={`/u/${c.uid}`} className="shrink-0 mt-0.5">
                        <AvatarDecoration
                          src={c.authorPhoto}
                          alt={c.authorName}
                          decorationId={c.authorBorder}
                          size="sm"
                        />
                      </Link>

                      {/* Main Content Column */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Colored Username + Verified Badge + Country Flag + • Time + Right Menu */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                            <Link
                              to={`/u/${c.uid}`}
                              className={`text-sm sm:text-[15px] font-extrabold tracking-wide transition-colors truncate ${nameColorCls}`}
                            >
                              {c.authorName}
                            </Link>
                            <VerifiedBadge
                              size="sm"
                              isFounder={isCommentFounder}
                              badgeLabel={c.authorBadge}
                              variant={badgeVariant}
                            />
                            <CountryFlagBadge countryCode={c.authorCountry} size="xs" />
                            <span className="text-xs text-gray-200/90 font-medium whitespace-nowrap">
                              • {timeAgo(c.createdAt)}
                            </span>
                          </div>

                          {/* 3-Dots Action Menu */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuId((prev) => (prev === c._id ? null : c._id))
                              }
                              className="p-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="Menu komentar"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === c._id && (
                              <div className="absolute right-0 mt-1 w-36 rounded-xl bg-[#161820] border border-white/15 shadow-2xl py-1 z-30 text-xs font-bold text-white">
                                {user && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartInlineReply(c)}
                                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2"
                                  >
                                    <span>Balas Komentar</span>
                                  </button>
                                )}
                                {isFounder && (
                                  <button
                                    type="button"
                                    onClick={() => handlePin(c._id)}
                                    className="w-full px-3 py-2 text-left text-amber-400 hover:bg-white/10 flex items-center gap-2"
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                    <span>{c.pinned ? 'Lepas Sematan' : 'Sematkan'}</span>
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(c._id)}
                                    className="w-full px-3 py-2 text-left text-rose-400 hover:bg-white/10 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Royal Status Pills Row (YANG MULIA + Donatur All # + Lv. + #UID) */}
                        <div className="mt-1.5 flex items-center flex-wrap gap-2">
                          <span className="px-3 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                            {royalTitle}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#DC2626] to-[#991B1B] text-[10px] sm:text-[11px] font-extrabold text-white shadow-md">
                            {isCommentFounder ? 'Donatur All #1' : `Donatur All #${donorRank}`}
                          </span>
                          <span className="text-xs font-extrabold text-white drop-shadow-sm">
                            {isCommentFounder || c.authorLevel >= 999999
                              ? 'Lv. ∞'
                              : `Lv. ${c.authorLevel}`}
                          </span>
                          <span className="text-xs font-bold text-gray-200/90 font-mono-tabular">
                            #{c.uid}
                          </span>
                        </div>

                        {/* Row 3: Comment Text on Left + Vertical Heart & Count on Right */}
                        <div className="mt-2.5 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {c.text && (
                              <p className="text-sm sm:text-[15px] font-medium text-white leading-relaxed break-words drop-shadow-sm">
                                {renderCommentRichText(c.text)}
                              </p>
                            )}
                            {c.sticker && <VipStickerCard stickerId={c.sticker} />}
                          </div>

                          {/* Right Vertical Like Button */}
                          <button
                            type="button"
                            onClick={() => handleLike(c._id)}
                            disabled={!user}
                            className={`flex flex-col items-center gap-1 shrink-0 pt-0.5 transition-transform active:scale-90 ${
                              liked ? 'text-rose-500' : 'text-gray-200 hover:text-rose-400'
                            }`}
                          >
                            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                            <span className="text-xs font-bold font-mono-tabular">
                              {c.likes.length}
                            </span>
                          </button>
                        </div>

                        {/* Row 4: Blue Balasan / Balas Link */}
                        <div className="mt-2.5 flex items-center gap-4">
                          {user && (
                            <button
                              type="button"
                              onClick={() => {
                                if (activeReplyParentId === c._id) {
                                  setActiveReplyParentId(null);
                                } else {
                                  handleStartInlineReply(c);
                                }
                              }}
                              className="text-xs sm:text-[13px] font-extrabold text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                            >
                              {activeReplyParentId === c._id ? 'Tutup Balas' : 'Balas'}
                            </button>
                          )}

                          {replies.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReplies((prev) => ({
                                  ...prev,
                                  [c._id]: !prev[c._id],
                                }))
                              }
                              className="text-xs sm:text-[13px] font-extrabold text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                            >
                              {showReplies
                                ? `Sembunyikan Balasan (${replies.length})`
                                : `Lihat ${replies.length} Balasan`}
                            </button>
                          )}
                        </div>

                        {/* Inline Reply Input Box directly inside this VIP Comment Card */}
                        {renderInlineReplyBox(c, true)}
                      </div>
                    </div>

                    {/* Replies Thread inside VIP Card */}
                    {replies.length > 0 && showReplies && (
                      <div className="mt-3.5 pt-3 border-t border-white/15 pl-4 sm:pl-12 space-y-2.5">
                        {replies.map((r) => {
                          const rVip = Boolean(r.authorIsPremium || r.authorRole === 'founder');
                          const rFounder = r.authorRole === 'founder';
                          const rLiked = Boolean(user && r.likes.includes(user.uid));
                          const canDeleteReply = Boolean(
                            user && (user.uid === r.uid || isFounder)
                          );
                          return (
                            <div
                              key={r._id}
                              className="flex items-start justify-between gap-3 rounded-xl bg-black/55 backdrop-blur-md p-3 border border-white/15"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <Link to={`/u/${r.uid}`} className="shrink-0 mt-0.5">
                                  <img
                                    src={r.authorPhoto || defaultAvatarImg}
                                    alt={r.authorName}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-full object-cover border border-white/15"
                                  />
                                </Link>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center flex-wrap gap-1.5">
                                    <Link
                                      to={`/u/${r.uid}`}
                                      className={`text-xs font-extrabold ${
                                        rVip ? getVipNameColorClass(r) : 'text-white'
                                      }`}
                                    >
                                      {r.authorName}
                                    </Link>
                                    {rVip && (
                                      <VerifiedBadge
                                        size="sm"
                                        isFounder={rFounder}
                                        badgeLabel={r.authorBadge}
                                        variant={getVipBadgeVariant(r)}
                                      />
                                    )}
                                    <CountryFlagBadge countryCode={r.authorCountry} size="xs" />
                                    <span className="text-[11px] text-gray-300">
                                      • {timeAgo(r.createdAt)}
                                    </span>
                                  </div>
                                  {r.text && (
                                    <p className="mt-1 text-xs text-gray-100 leading-relaxed break-words">
                                      {renderCommentRichText(r.text)}
                                    </p>
                                  )}
                                  {r.sticker && <VipStickerCard stickerId={r.sticker} />}

                                  <div className="mt-1.5 flex items-center gap-3">
                                    {user && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartInlineReply(c, r)}
                                        className="text-[11px] font-bold text-[#3B82F6] hover:text-[#60A5FA]"
                                      >
                                        Balas
                                      </button>
                                    )}
                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(r._id)}
                                        className="text-[11px] font-semibold text-rose-400 hover:underline"
                                      >
                                        Hapus
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleLike(r._id)}
                                disabled={!user}
                                className={`flex flex-col items-center gap-0.5 shrink-0 ${
                                  rLiked ? 'text-rose-500' : 'text-gray-300 hover:text-rose-400'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${rLiked ? 'fill-current' : ''}`} />
                                <span className="text-[10px] font-bold">{r.likes.length}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            /* =====================================================================
             * 2. REGULAR / NON-PREMIUM USER COMMENT ("kosongan kek nama aja")
             * ===================================================================== */
            return (
              <div
                key={c._id}
                className="rounded-2xl px-3.5 py-3 bg-slate-50/70 dark:bg-[#12141B] border border-slate-200/70 dark:border-white/[0.05] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Link to={`/u/${c.uid}`} className="shrink-0 mt-0.5">
                    <img
                      src={c.authorPhoto || defaultAvatarImg}
                      alt={c.authorName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <Link
                          to={`/u/${c.uid}`}
                          className="text-sm font-bold text-slate-900 dark:text-gray-200 hover:text-[#E84A18] transition-colors truncate"
                        >
                          {c.authorName}
                        </Link>
                        <CountryFlagBadge countryCode={c.authorCountry} size="xs" />
                        <span className="text-xs text-slate-400 dark:text-gray-500 whitespace-nowrap">
                          • {timeAgo(c.createdAt)}
                        </span>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c._id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                          title="Hapus komentar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed break-words">
                        {c.text}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleLike(c._id)}
                        disabled={!user}
                        className={`flex flex-col items-center gap-0.5 shrink-0 ${
                          liked
                            ? 'text-rose-500'
                            : 'text-slate-400 dark:text-gray-500 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                        <span className="text-[11px] font-semibold font-mono-tabular">
                          {c.likes.length}
                        </span>
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-4">
                      {user && (
                        <button
                          type="button"
                          onClick={() => {
                            if (activeReplyParentId === c._id) {
                              setActiveReplyParentId(null);
                            } else {
                              handleStartInlineReply(c);
                            }
                          }}
                          className="text-xs font-extrabold text-[#3B82F6] hover:text-[#60A5FA]"
                        >
                          {activeReplyParentId === c._id ? 'Tutup Balas' : 'Balas'}
                        </button>
                      )}
                      {replies.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReplies((prev) => ({
                              ...prev,
                              [c._id]: !prev[c._id],
                            }))
                          }
                          className="text-xs font-bold text-[#3B82F6] hover:text-[#60A5FA]"
                        >
                          {showReplies
                            ? `Sembunyikan Balasan (${replies.length})`
                            : `Lihat ${replies.length} Balasan`}
                        </button>
                      )}
                    </div>

                    {/* Inline Reply Input Box directly inside this regular comment card */}
                    {renderInlineReplyBox(c, false)}

                    {replies.length > 0 && showReplies && (
                      <div className="mt-3 pl-3.5 border-l-2 border-slate-200 dark:border-white/10 space-y-2.5">
                        {replies.map((r) => {
                          const rVip = Boolean(r.authorIsPremium || r.authorRole === 'founder');
                          const rFounder = r.authorRole === 'founder';
                          const rLiked = Boolean(user && r.likes.includes(user.uid));
                          const canDeleteReply = Boolean(
                            user && (user.uid === r.uid || isFounder)
                          );
                          return (
                            <div
                              key={r._id}
                              className="rounded-xl bg-slate-100/80 dark:bg-[#181B24] p-2.5 flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <img
                                    src={r.authorPhoto || defaultAvatarImg}
                                    alt={r.authorName}
                                    referrerPolicy="no-referrer"
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                  <Link
                                    to={`/u/${r.uid}`}
                                    className={`text-xs font-bold ${
                                      rVip
                                        ? getVipNameColorClass(r)
                                        : 'text-slate-900 dark:text-gray-200'
                                    }`}
                                  >
                                    {r.authorName}
                                  </Link>
                                  {rVip && (
                                    <VerifiedBadge
                                      size="sm"
                                      isFounder={rFounder}
                                      badgeLabel={r.authorBadge}
                                      variant={getVipBadgeVariant(r)}
                                    />
                                  )}
                                  <CountryFlagBadge countryCode={r.authorCountry} size="xs" />
                                  <span className="text-[11px] text-slate-400 dark:text-gray-500">
                                    • {timeAgo(r.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-700 dark:text-gray-300 break-words">
                                  {renderCommentRichText(r.text)}
                                </p>
                                {r.sticker && <VipStickerCard stickerId={r.sticker} />}
                                <div className="mt-1.5 flex items-center gap-3">
                                  {user && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartInlineReply(c, r)}
                                      className="text-[11px] font-bold text-[#3B82F6] hover:text-[#60A5FA]"
                                    >
                                      Balas
                                    </button>
                                  )}
                                  {canDeleteReply && (
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(r._id)}
                                      className="text-[11px] font-semibold text-rose-500 hover:underline"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleLike(r._id)}
                                disabled={!user}
                                className={`flex flex-col items-center gap-0.5 shrink-0 ${
                                  rLiked
                                    ? 'text-rose-500'
                                    : 'text-slate-400 dark:text-gray-500 hover:text-rose-500'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${rLiked ? 'fill-current' : ''}`} />
                                <span className="text-[10px] font-bold">{r.likes.length}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
