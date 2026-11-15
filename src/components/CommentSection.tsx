import React, { useEffect, useState } from 'react';
import {
  Crown,
  Heart,
  Lock,
  MessageCircle,
  Pin,
  Send,
  Smile,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth, AVATAR_BORDER_STYLES } from '../context/AuthContext';
import { TELEGRAM_BADGE_MAP, VerifiedBadge } from './VerifiedBadge';
import {
  FREE_EMOJIS,
  StatusEmojiBadge,
  VIP_EMOJIS,
  VipStickerCard,
  renderCommentRichText,
} from './VipEmojis';
import type { CommentItem } from '../types';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  return `${Math.floor(diffSec / 86400)}h lalu`;
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
  const { user, isPremium } = useAuth();
  const canUseVipEmoji = Boolean(isPremium || user?.role === 'founder');
  const isFounder = user?.role === 'founder';

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [text, setText] = useState('');
  const [selectedSticker, setSelectedSticker] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'free' | 'vip'>('free');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      const res = await fetch(
        `/api/comments?mediaKey=${encodeURIComponent(mediaKey)}&sort=${sort}`
      );
      const json = await res.json();
      if (json.ok && Array.isArray(json.comments)) {
        setComments(json.comments);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!text.trim() && !selectedSticker) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mediaKey,
          mediaTitle,
          episodeTitle,
          parentId: replyTo?._id || '',
          text: text.trim(),
          sticker: selectedSticker,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Gagal mengirim komentar');
      } else {
        setText('');
        setSelectedSticker('');
        setReplyTo(null);
        setShowEmojiPicker(false);
        await loadComments();
      }
    } catch {
      setErrorMsg('Gagal menghubungi server komentar');
    } finally {
      setSubmitting(false);
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
    if (res.ok) await loadComments();
  };

  const handleDelete = async (commentId: string) => {
    const token = getAuthToken();
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
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

  return (
    <section className="mt-8 rounded-3xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.07] p-4 sm:p-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Komentar Komunitas ({comments.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              Diskusi episode &amp; emoji eksklusif member VIP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/5">
          {(['latest', 'popular'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSort(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                sort === mode
                  ? 'bg-[#E84A18] text-white'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {mode === 'latest' ? 'Terbaru' : 'Populer'}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-white/[0.08] p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={user.photoUrl || defaultAvatarImg}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className={`w-8 h-8 rounded-full object-cover shrink-0 ${
                    AVATAR_BORDER_STYLES[user.activeBorder || 'classic']?.ringClass ||
                    AVATAR_BORDER_STYLES.classic.ringClass
                  }`}
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user.name}
                </span>
                {canUseVipEmoji && (
                  <VerifiedBadge
                    size="sm"
                    isFounder={isFounder}
                    badgeLabel={user.activeBadge}
                  />
                )}
                {canUseVipEmoji && user.statusEmoji && (
                  <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
                )}
                {canUseVipEmoji && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      TELEGRAM_BADGE_MAP.get(user.activeBadge)?.pillClass ||
                      (isFounder
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                        : 'bg-sky-500/20 text-sky-600 dark:text-sky-300')
                    }`}
                  >
                    {user.activeBadge || (isFounder ? 'Founder' : 'VIP')}
                  </span>
                )}
              </div>

              {replyTo && (
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-[11px] font-semibold text-[#E84A18] hover:underline"
                >
                  Balas ke {replyTo.authorName} (Batal)
                </button>
              )}
            </div>

            <textarea
              rows={2}
              maxLength={800}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                replyTo
                  ? `Tulis balasan untuk ${replyTo.authorName}...`
                  : 'Tulis komentar atau gunakan Emoji Eksklusif VIP...'
              }
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none resize-none"
            />

            {selectedSticker && (
              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-white/5">
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

            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((s) => !s)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                    showEmojiPicker
                      ? 'bg-[#E84A18]/15 border-[#E84A18]/40 text-[#E84A18]'
                      : 'bg-white dark:bg-[#161922] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-200'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                  <span>Emoji &amp; VIP</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting || (!text.trim() && !selectedSticker)}
                className="min-h-[38px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#E84A18]/20 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Mengirim...' : 'Kirim'}</span>
              </button>
            </div>

            {/* Emoji & Exclusive VIP Sticker Picker */}
            {showEmojiPicker && (
              <div className="mt-3 p-3 rounded-2xl bg-white dark:bg-[#151821] border border-slate-200 dark:border-white/10">
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
                        <strong>Emoji &amp; Stiker Eksklusif</strong> hanya untuk member{' '}
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
                            <Icon className={`w-4 h-4 ${vip.textClass}`} />
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
        </form>
      ) : (
        <div className="mb-6 rounded-2xl bg-slate-50 dark:bg-[#0D0F14] border border-slate-200 dark:border-white/[0.08] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#E84A18] shrink-0" />
            <p className="text-xs sm:text-sm text-slate-700 dark:text-gray-300">
              Masuk akun untuk ikut berkomentar, kirim reaksi, dan pakai emoji VIP.
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
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-slate-100 dark:bg-[#191C26] animate-pulse"
            />
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
          Belum ada komentar. Jadilah yang pertama berkomentar di sini!
        </div>
      ) : (
        <div className="space-y-4">
          {rootComments.map((c) => {
            const isVip = Boolean(c.authorIsPremium || c.authorRole === 'founder');
            const isCommentFounder = c.authorRole === 'founder';
            const liked = Boolean(user && c.likes.includes(user.uid));
            const replies = repliesMap.get(c._id) || [];
            const borderCls =
              AVATAR_BORDER_STYLES[c.authorBorder || 'classic']?.ringClass ||
              AVATAR_BORDER_STYLES.classic.ringClass;

            return (
              <div
                key={c._id}
                className={`rounded-2xl p-3.5 sm:p-4 border transition-colors ${
                  c.pinned
                    ? 'bg-amber-50/70 dark:bg-amber-500/[0.06] border-amber-300/60 dark:border-amber-500/30'
                    : 'bg-slate-50/80 dark:bg-[#0D0F14]/80 border-slate-200/80 dark:border-white/[0.06]'
                }`}
              >
                {c.pinned && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-2">
                    <Pin className="w-3 h-3" />
                    <span>Disematkan oleh Founder</span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Link to={`/u/${c.uid}`} className="shrink-0 group">
                    <img
                      src={c.authorPhoto || defaultAvatarImg}
                      alt={c.authorName}
                      referrerPolicy="no-referrer"
                      className={`w-10 h-10 rounded-full object-cover group-hover:scale-105 transition-transform ${borderCls}`}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    {/* Name + Badge next to name + Level + Time */}
                    <div className="flex items-center flex-wrap gap-1.5">
                      <Link
                        to={`/u/${c.uid}`}
                        className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white hover:text-[#E84A18] transition-colors"
                      >
                        {c.authorName}
                      </Link>
                      {isVip && (
                        <VerifiedBadge
                          size="sm"
                          isFounder={isCommentFounder}
                          badgeLabel={c.authorBadge}
                        />
                      )}
                      {isVip && c.authorStatusEmoji && (
                        <StatusEmojiBadge statusEmoji={c.authorStatusEmoji} size="xs" />
                      )}
                      {isVip && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                            TELEGRAM_BADGE_MAP.get(c.authorBadge)?.pillClass ||
                            (isCommentFounder
                              ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white'
                              : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30')
                          }`}
                        >
                          {c.authorBadge || (isCommentFounder ? 'Founder' : 'VIP')}
                        </span>
                      )}
                      <span className="text-[10px] font-mono-tabular font-semibold text-slate-500 dark:text-gray-400">
                        {isCommentFounder ? 'Lv.∞' : `Lv.${c.authorLevel}`} · {timeAgo(c.createdAt)}
                      </span>
                    </div>

                    {c.episodeTitle && (
                      <p className="text-[10px] text-[#E84A18] font-semibold mt-0.5">
                        {c.episodeTitle}
                      </p>
                    )}

                    {c.text && (
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-800 dark:text-gray-200 leading-relaxed break-words">
                        {renderCommentRichText(c.text)}
                      </p>
                    )}

                    {c.sticker && <VipStickerCard stickerId={c.sticker} />}

                    {/* Actions */}
                    <div className="mt-2.5 flex items-center flex-wrap gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => handleLike(c._id)}
                        disabled={!user}
                        className={`inline-flex items-center gap-1 font-semibold transition-colors ${
                          liked
                            ? 'text-rose-500'
                            : 'text-slate-500 dark:text-gray-400 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                        <span className="font-mono-tabular">{c.likes.length}</span>
                      </button>

                      {user && (
                        <button
                          type="button"
                          onClick={() => setReplyTo(c)}
                          className="text-slate-500 dark:text-gray-400 hover:text-[#E84A18] font-semibold"
                        >
                          Balas
                        </button>
                      )}

                      {isFounder && (
                        <button
                          type="button"
                          onClick={() => handlePin(c._id)}
                          className="text-amber-600 dark:text-amber-400 hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <Pin className="w-3 h-3" />
                          <span>{c.pinned ? 'Lepas' : 'Sematkan'}</span>
                        </button>
                      )}

                      {user && (user.uid === c.uid || isFounder) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c._id)}
                          className="text-slate-400 hover:text-rose-500 font-semibold inline-flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>

                    {/* Replies Thread */}
                    {replies.length > 0 && (
                      <div className="mt-3 pl-3.5 border-l-2 border-slate-200 dark:border-white/10 space-y-2.5">
                        {replies.map((r) => {
                          const rVip = Boolean(r.authorIsPremium || r.authorRole === 'founder');
                          const rFounder = r.authorRole === 'founder';
                          const rLiked = Boolean(user && r.likes.includes(user.uid));
                          return (
                            <div key={r._id} className="pt-1">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <Link to={`/u/${r.uid}`} className="shrink-0">
                                  <img
                                    src={r.authorPhoto || defaultAvatarImg}
                                    alt={r.authorName}
                                    referrerPolicy="no-referrer"
                                    className="w-6 h-6 rounded-full object-cover hover:scale-105 transition-transform"
                                  />
                                </Link>
                                <Link
                                  to={`/u/${r.uid}`}
                                  className="text-xs font-bold text-slate-900 dark:text-white hover:text-[#E84A18] transition-colors"
                                >
                                  {r.authorName}
                                </Link>
                                {rVip && (
                                  <VerifiedBadge
                                    size="sm"
                                    isFounder={rFounder}
                                    badgeLabel={r.authorBadge}
                                  />
                                )}
                                {rVip && r.authorStatusEmoji && (
                                  <StatusEmojiBadge statusEmoji={r.authorStatusEmoji} size="xs" />
                                )}
                                {rVip && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      TELEGRAM_BADGE_MAP.get(r.authorBadge)?.pillClass ||
                                      (rFounder
                                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-300')
                                    }`}
                                  >
                                    {r.authorBadge || (rFounder ? 'Founder' : 'VIP')}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 dark:text-gray-400">
                                  {rFounder ? 'Lv.∞ · ' : ''}{timeAgo(r.createdAt)}
                                </span>
                              </div>
                              {r.text && (
                                <p className="mt-1 text-xs text-slate-700 dark:text-gray-300 leading-relaxed">
                                  {renderCommentRichText(r.text)}
                                </p>
                              )}
                              {r.sticker && <VipStickerCard stickerId={r.sticker} />}
                              <div className="mt-1 flex items-center gap-3 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleLike(r._id)}
                                  disabled={!user}
                                  className={`inline-flex items-center gap-1 ${
                                    rLiked ? 'text-rose-500' : 'text-slate-500 dark:text-gray-400'
                                  }`}
                                >
                                  <Heart className={`w-3 h-3 ${rLiked ? 'fill-current' : ''}`} />
                                  <span>{r.likes.length}</span>
                                </button>
                                {user && (user.uid === r.uid || isFounder) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(r._id)}
                                    className="text-slate-400 hover:text-rose-500"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </div>
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
