import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Copy,
  Edit3,
  Heart,
  Maximize2,
  MoreVertical,
  Play,
  Plus,
  Reply,
  Shield,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AvatarDecoration } from '../AvatarDecoration';
import { AvatarWithBadges } from '../AvatarBadges';
import { VerifiedBadge } from '../VerifiedBadge';
import { StatusEmojiBadge, VipStickerCard, renderCommentRichText } from '../VipEmojis';
import type { ChatMessageItem } from '../../types';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import defaultAvatarImg from '../../assets/images/default_avatar_ink_1794755346613.jpg';

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👍'];
const EXTRA_REACTIONS = ['💯', '🎉', '👏', '🤯', '🥳', '😎', '🙏', '💀', '✨', '👀', '🫡', '🫶'];

const LONG_PRESS_DURATION_MS = 380;
const MOVE_CANCEL_THRESHOLD_PX = 12;

function formatMsgTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

interface ChatMessageBubbleProps {
  message: ChatMessageItem;
  mode: 'dm' | 'group' | 'global';
  meUid: string;
  isFounder: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isHighlighted?: boolean;
  msgIndex?: number;
  onReply: (m: ChatMessageItem) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (m: ChatMessageItem) => void;
  onDelete: (messageId: string) => void;
  onCopy: (text: string) => void;
  onZoomMedia: (media: { url: string; type: 'image' | 'video' }) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message: m,
  mode,
  meUid,
  isFounder,
  isFirstInGroup,
  isLastInGroup,
  isHighlighted = false,
  msgIndex = 0,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
  onZoomMedia,
  onJumpToMessage,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const isMine = m.senderUid === meUid;
  const canModify = isMine || isFounder;
  const isSenderFounder = m.senderRole === 'founder';
  const isSenderVip = Boolean(m.senderIsPremium || isSenderFounder);
  const senderLevel = isSenderFounder ? 9999 : m.senderLevel || 1;
  const senderCharisma = m.senderCharisma ?? 0;
  const darkSurface = mode === 'global';

  const reactionEntries = Object.entries(m.reactions || {}).filter(
    ([, uids]) => Array.isArray(uids) && uids.length > 0
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setShowMoreEmojis(false);
  }, []);

  const clearLongPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    startPointRef.current = null;
    setIsPressing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const triggerReactionMenu = useCallback(() => {
    clearLongPress();
    suppressClickUntilRef.current = Date.now() + 450;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(18);
      } catch {
        // Ignore vibrate permission issues
      }
    }
    setMenuOpen(true);
  }, [clearLongPress]);

  const startLongPress = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      // Skip interactive controls inside the bubble (buttons/audio/links) if short tapped,
      // except we still allow long press anywhere on the bubble surface
      if (target instanceof HTMLElement && target.closest('audio')) return;

      clearLongPress();
      startPointRef.current = { x: clientX, y: clientY };
      setIsPressing(true);

      pressTimerRef.current = setTimeout(() => {
        triggerReactionMenu();
      }, LONG_PRESS_DURATION_MS);
    },
    [clearLongPress, triggerReactionMenu]
  );

  const checkMoveCancel = useCallback(
    (clientX: number, clientY: number) => {
      const start = startPointRef.current;
      if (!start) return;
      const dx = Math.abs(clientX - start.x);
      const dy = Math.abs(clientY - start.y);
      if (dx > MOVE_CANCEL_THRESHOLD_PX || dy > MOVE_CANCEL_THRESHOLD_PX) {
        clearLongPress();
      }
    },
    [clearLongPress]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startLongPress(t.clientX, t.clientY, e.target);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    checkMoveCancel(t.clientX, t.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startLongPress(e.clientX, e.clientY, e.target);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    checkMoveCancel(e.clientX, e.clientY);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Allow long-press / right-click on message bubble to open custom reaction & options tray
    e.preventDefault();
    triggerReactionMenu();
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const bubbleInteractiveProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: clearLongPress,
    onTouchCancel: clearLongPress,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: clearLongPress,
    onMouseLeave: clearLongPress,
    onContextMenu: handleContextMenu,
    onClickCapture: handleClickCapture,
    style: { WebkitTouchCallout: 'none' } as React.CSSProperties,
  };

  // Tail radius rules based on message grouping
  const bubbleRounding =
    mode === 'global'
      ? 'rounded-2xl'
      : isMine
      ? `${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${
          isLastInGroup ? 'rounded-br-sm' : 'rounded-br-md'
        } rounded-tl-2xl rounded-bl-2xl`
      : `${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${
          isLastInGroup ? 'rounded-bl-sm' : 'rounded-bl-md'
        } rounded-tr-2xl rounded-br-2xl`;

  // Floating Reaction Tray & Action Menu
  const ReactionPopover = menuOpen ? (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px]"
        onClick={closeMenu}
      />
      <div
        className={`absolute z-40 ${
          msgIndex < 2 ? 'top-full mt-2' : 'bottom-full mb-2'
        } ${
          isMine && mode !== 'global' ? 'right-0' : 'left-0'
        } w-[260px] sm:w-[280px] rounded-2xl border shadow-2xl p-2 backdrop-blur-xl animate-reaction-tray ${
          darkSurface
            ? 'bg-[#171B26]/95 border-white/15 text-white'
            : 'bg-white/95 dark:bg-[#1E2A31]/95 border-slate-200 dark:border-white/15 text-slate-800 dark:text-white'
        }`}
      >
        {/* Expressive Quick Emoji Reaction Bar */}
        <div className="flex items-center justify-between gap-1 px-1 py-1 mb-1.5 border-b border-slate-200/70 dark:border-white/10">
          {QUICK_REACTIONS.map((em) => {
            const reacted = Boolean(m.reactions?.[em]?.includes(meUid));
            return (
              <button
                key={em}
                type="button"
                onClick={() => {
                  onReact(m._id, em);
                  closeMenu();
                }}
                className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition-transform hover:scale-125 active:scale-95 ${
                  reacted
                    ? 'bg-sky-500/20 ring-1 ring-sky-400/60'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                aria-label={`Reaksi ${em}`}
              >
                {em}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMoreEmojis((v) => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              showMoreEmojis
                ? 'bg-[#E84A18] text-white'
                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/20'
            }`}
            title="Emoji lainnya"
            aria-label="Pilih emoji reaksi lainnya"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expanded Expressive Emoji Grid */}
        {showMoreEmojis && (
          <div className="grid grid-cols-6 gap-1 px-1 pb-2 mb-1.5 border-b border-slate-200/70 dark:border-white/10">
            {EXTRA_REACTIONS.map((em) => {
              const reacted = Boolean(m.reactions?.[em]?.includes(meUid));
              return (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    onReact(m._id, em);
                    closeMenu();
                  }}
                  className={`h-8 rounded-xl text-base flex items-center justify-center transition-transform hover:scale-125 active:scale-95 ${
                    reacted
                      ? 'bg-sky-500/20 ring-1 ring-sky-400/60'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {em}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onReply(m);
            closeMenu();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 text-left"
        >
          <Reply className="w-3.5 h-3.5 text-sky-500" />
          <span>Balas Pesan</span>
        </button>

        {m.text && (
          <button
            type="button"
            onClick={() => {
              onCopy(m.text);
              closeMenu();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 text-left"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-500" />
            <span>Salin Teks</span>
          </button>
        )}

        {isMine && m.text && (
          <button
            type="button"
            onClick={() => {
              onEdit(m);
              closeMenu();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Edit Pesan</span>
          </button>
        )}

        {canModify && (
          <button
            type="button"
            onClick={() => {
              onDelete(m._id);
              closeMenu();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-rose-500 hover:bg-rose-500/10 text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Pesan</span>
          </button>
        )}
      </div>
    </>
  ) : null;

  // Quick hover/tap trigger button next to bubble
  const ActionButton = (
    <div
      className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
        menuOpen ? 'opacity-100' : 'opacity-65 sm:opacity-0 sm:group-hover:opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          darkSurface
            ? 'text-gray-400 hover:text-white hover:bg-white/10'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
        }`}
        title="Tahan pesan atau klik untuk beri reaksi"
        aria-label="Reaksi dan opsi pesan"
      >
        <SmilePlus className="w-3.5 h-3.5 sm:hidden" />
        <MoreVertical className="w-3.5 h-3.5 hidden sm:block" />
      </button>
    </div>
  );

  // GLOBAL CHAT RENDERING
  if (mode === 'global') {
    return (
      <div
        id={`msg-${m._id}`}
        className={`flex items-end gap-2.5 group transition-colors duration-500 ${
          isFirstInGroup ? 'mt-3' : 'mt-1'
        } ${isHighlighted ? 'bg-sky-500/15 -mx-2 px-2 py-1 rounded-2xl' : ''}`}
      >
        <div className="w-9 shrink-0 flex justify-center">
          {isFirstInGroup ? (
            <Link to={`/u/${m.senderUid}`} className="shrink-0">
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
                popoverPlacement={msgIndex < 2 ? 'bottom' : 'top'}
              >
                <AvatarDecoration
                  src={m.senderPhoto || defaultAvatarImg}
                  alt={m.senderName || 'User'}
                  decorationId={m.senderBorder}
                  level={m.senderLevel}
                  isFounder={isSenderFounder}
                  size="sm"
                />
              </AvatarWithBadges>
            </Link>
          ) : (
            <span className="w-9" />
          )}
        </div>

        <div className="flex items-end gap-1.5 min-w-0 flex-1">
          <div className="relative min-w-0 max-w-[85%] sm:max-w-[78%]">
            {ReactionPopover}

            <div
              {...bubbleInteractiveProps}
              className={`rounded-2xl px-3.5 py-2.5 border shadow-md select-none sm:select-text transition-transform duration-150 ${
                isPressing || menuOpen ? 'scale-[0.98] ring-2 ring-sky-400/50' : ''
              } ${
                isMine
                  ? 'bg-[#1D2433] border-sky-500/35'
                  : 'bg-[#171A22] border-white/[0.07]'
              }`}
            >
              {m.replyText && (
                <button
                  type="button"
                  onClick={() => m.replyToId && onJumpToMessage?.(m.replyToId)}
                  className="w-full text-left mb-2 pl-2.5 border-l-2 border-sky-400/80 bg-black/30 hover:bg-black/40 rounded-r-lg px-2.5 py-1.5 transition-colors"
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 truncate">
                    <span>{m.replySenderName || 'User'}</span>
                    {m.replySenderUid && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        #{m.replySenderUid}
                      </span>
                    )}
                    {m.replySenderIsVerified && <VerifiedBadge size="sm" isFounder={false} />}
                  </div>
                  <p className="text-[11px] text-gray-300 truncate mt-0.5">{m.replyText}</p>
                </button>
              )}

              {isFirstInGroup && (
                <>
                  <Link to={`/u/${m.senderUid}`} className="flex items-center gap-1.5 flex-wrap">
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
                    {isSenderVip && m.senderStatusEmoji && (
                      <StatusEmojiBadge statusEmoji={m.senderStatusEmoji} size="xs" />
                    )}
                    <span className="text-[11px] text-gray-400 font-mono">#{m.senderUid}</span>
                  </Link>

                  <div className="mt-1 mb-1.5 flex items-center gap-1.5 flex-wrap">
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
                      <span>{isSenderFounder ? 'God Lvl 9999' : `Lvl ${senderLevel}`}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded-full bg-rose-500/85 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 fill-current" />
                      <span>{senderCharisma}</span>
                    </span>
                  </div>
                </>
              )}

              {m.mediaType === 'image' && m.mediaUrl && (
                <div
                  onClick={() => onZoomMedia({ url: m.mediaUrl!, type: 'image' })}
                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer relative group/img"
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

              {m.mediaType === 'video' && m.mediaUrl && (
                <div
                  onClick={() => onZoomMedia({ url: m.mediaUrl!, type: 'video' })}
                  className="mb-2 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer relative"
                >
                  <video src={m.mediaUrl} className="w-full max-h-64 object-contain" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                    <Play className="w-8 h-8 fill-white text-white drop-shadow" />
                  </div>
                </div>
              )}

              {m.mediaType === 'audio' && m.mediaUrl && (
                <ChatAudioPlayer src={m.mediaUrl} isMine={isMine} darkSurface />
              )}

              {m.sticker && (
                <div className="mb-1">
                  <VipStickerCard stickerId={m.sticker} />
                </div>
              )}

              {m.text && (
                <p className="text-xs sm:text-sm text-gray-100 leading-relaxed break-words whitespace-pre-wrap">
                  {renderCommentRichText(m.text)}
                </p>
              )}

              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  {m.editedAt && <span className="italic text-gray-400/80">(diedit)</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono-tabular">
                  <span>{formatMsgTime(m.createdAt)}</span>
                </div>
              </div>
            </div>

            {reactionEntries.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {reactionEntries.map(([emoji, uids]) => {
                  const active = uids.includes(meUid);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReact(m._id, emoji)}
                      className={`animate-reaction-pop px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border transition-colors ${
                        active
                          ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                          : 'bg-[#171A22] border-white/10 text-gray-300 hover:border-white/25'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="font-mono-tabular text-[10px]">{uids.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pb-1 shrink-0">{ActionButton}</div>
        </div>
      </div>
    );
  }

  // DM & GROUP CHAT RENDERING
  return (
    <div
      id={`msg-${m._id}`}
      className={`flex items-end gap-1.5 group transition-colors duration-500 ${
        isFirstInGroup ? 'mt-2.5' : 'mt-0.5'
      } ${isMine ? 'justify-end' : 'justify-start'} ${
        isHighlighted ? 'bg-emerald-500/15 -mx-2 px-2 py-1 rounded-2xl' : ''
      }`}
    >
      {mode === 'group' && !isMine && (
        <div className="w-8 shrink-0 flex justify-center">
          {isLastInGroup ? (
            <Link to={`/u/${m.senderUid}`} className="shrink-0">
              <img
                src={m.senderPhoto || defaultAvatarImg}
                alt={m.senderName || 'User'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-white/15 shadow-sm"
              />
            </Link>
          ) : (
            <span className="w-7" />
          )}
        </div>
      )}

      {isMine && ActionButton}

      <div
        className={`relative max-w-[82%] sm:max-w-[68%] flex flex-col ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {ReactionPopover}

        <div
          {...bubbleInteractiveProps}
          className={`w-full ${bubbleRounding} px-3.5 py-2 shadow-sm border select-none sm:select-text transition-transform duration-150 ${
            isPressing || menuOpen ? 'scale-[0.97] ring-2 ring-[#00A884]/50' : ''
          } ${
            isMine
              ? 'bg-[#D9FDD3] dark:bg-[#005C4B] border-emerald-200/70 dark:border-emerald-400/10 text-slate-900 dark:text-white'
              : 'bg-white dark:bg-[#202C33] border-slate-200/70 dark:border-white/[0.06] text-slate-900 dark:text-white'
          }`}
        >
          {mode === 'group' && !isMine && isFirstInGroup && (
            <Link
              to={`/u/${m.senderUid}`}
              className="flex items-center gap-1 mb-0.5 hover:underline"
            >
              <span
                className={`text-[11px] font-extrabold ${
                  isSenderFounder
                    ? 'text-amber-500'
                    : isSenderVip
                    ? 'text-violet-500 dark:text-violet-300'
                    : 'text-[#E84A18]'
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
            </Link>
          )}

          {m.replyText && (
            <button
              type="button"
              onClick={() => m.replyToId && onJumpToMessage?.(m.replyToId)}
              className={`w-full text-left mb-1.5 pl-2.5 pr-2 py-1 rounded-lg border-l-2 transition-colors ${
                isMine
                  ? 'border-[#00A884] bg-black/5 dark:bg-black/25 hover:bg-black/10'
                  : 'border-[#E84A18] bg-slate-100 dark:bg-black/25 hover:bg-slate-200/80'
              }`}
            >
              <p className="text-[11px] font-bold text-[#00A884] dark:text-emerald-300 truncate">
                {m.replySenderName || 'User'}
              </p>
              <p className="text-[11px] opacity-80 truncate">{m.replyText}</p>
            </button>
          )}

          {m.mediaType === 'image' && m.mediaUrl && (
            <div
              onClick={() => onZoomMedia({ url: m.mediaUrl!, type: 'image' })}
              className="mb-1.5 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer group/img relative"
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

          {m.mediaType === 'video' && m.mediaUrl && (
            <div
              onClick={() => onZoomMedia({ url: m.mediaUrl!, type: 'video' })}
              className="mb-1.5 rounded-xl overflow-hidden max-w-xs bg-black cursor-pointer group/vid relative"
            >
              <video src={m.mediaUrl} className="w-full max-h-64 object-contain" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                <Play className="w-8 h-8 fill-white text-white drop-shadow" />
              </div>
            </div>
          )}

          {m.mediaType === 'audio' && m.mediaUrl && (
            <ChatAudioPlayer src={m.mediaUrl} isMine={isMine} />
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

          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500 dark:text-gray-300/80 font-mono-tabular">
            {m.editedAt && <span className="italic opacity-80">diedit</span>}
            <span>{formatMsgTime(m.createdAt)}</span>
            {isMine && mode === 'dm' && (
              m.readAt ? (
                <CheckCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              ) : (
                <Check className="w-3.5 h-3.5 text-slate-400 dark:text-gray-300/70" />
              )
            )}
          </div>
        </div>

        {reactionEntries.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, uids]) => {
              const active = uids.includes(meUid);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(m._id, emoji)}
                  className={`animate-reaction-pop px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border shadow-sm transition-colors ${
                    active
                      ? 'bg-[#00A884]/20 border-[#00A884]/60 text-emerald-700 dark:text-emerald-200'
                      : 'bg-white dark:bg-[#1E2A31] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-200'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-mono-tabular text-[10px]">{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isMine && ActionButton}
    </div>
  );
};
