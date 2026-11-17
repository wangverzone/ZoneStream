import React, { useEffect, useRef } from 'react';
import {
  Check,
  Crown,
  Edit3,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mic,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FREE_EMOJIS, VIP_EMOJIS } from '../VipEmojis';
import type { ChatMessageItem } from '../../types';
import { formatFileSize } from '../../utils/imageCompression';

interface ChatComposerProps {
  mode: 'dm' | 'group' | 'global';
  placeholder: string;
  maxLength?: number;
  draft: string;
  onDraftChange: (next: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  sending: boolean;
  canUseVip: boolean;
  selectedSticker: string;
  onSelectSticker: (id: string) => void;
  showEmojiDrawer: boolean;
  onToggleEmojiDrawer: () => void;
  emojiTab: 'free' | 'vip';
  onChangeEmojiTab: (tab: 'free' | 'vip') => void;
  replyTarget: ChatMessageItem | null;
  onClearReply: () => void;
  editTarget: ChatMessageItem | null;
  onCancelEdit: () => void;
  mediaPreview: {
    url: string;
    type: 'image' | 'video' | 'audio';
    originalSize?: number;
    compressedSize?: number;
    uploadedToFirebase?: boolean;
  } | null;
  onClearMediaPreview: () => void;
  uploadingMedia: boolean;
  uploadProgress: number;
  mediaError: string | null;
  onClearMediaError: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => void;
  onPasteImageFile: (file: File) => void;
  isRecordingVn: boolean;
  recordingSeconds: number;
  onStartVn: () => void;
  onStopVn: () => void;
  onCancelVn: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  mode,
  placeholder,
  maxLength = 1500,
  draft,
  onDraftChange,
  onSubmit,
  sending,
  canUseVip,
  selectedSticker,
  onSelectSticker,
  showEmojiDrawer,
  onToggleEmojiDrawer,
  emojiTab,
  onChangeEmojiTab,
  replyTarget,
  onClearReply,
  editTarget,
  onCancelEdit,
  mediaPreview,
  onClearMediaPreview,
  uploadingMedia,
  uploadProgress,
  mediaError,
  onClearMediaError,
  onFileSelect,
  onPasteImageFile,
  isRecordingVn,
  recordingSeconds,
  onStartVn,
  onStopVn,
  onCancelVn,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const darkSurface = mode === 'global';

  // Auto-grow textarea cleanly up to ~5 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  // Focus composer when entering reply/edit mode
  useEffect(() => {
    if (replyTarget || editTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget?._id, editTarget?._id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && !uploadingMedia && (draft.trim() || mediaPreview || selectedSticker)) {
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      if (editTarget) onCancelEdit();
      else if (replyTarget) onClearReply();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onPasteImageFile(file);
          return;
        }
      }
    }
  };

  const activeStickerMeta = selectedSticker
    ? VIP_EMOJIS.find((v) => v.id === selectedSticker)
    : null;

  const canSend =
    !sending &&
    !uploadingMedia &&
    Boolean(draft.trim() || (!editTarget && (mediaPreview || selectedSticker)));

  return (
    <div className="shrink-0">
      {/* Edit Banner */}
      {editTarget && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08]'
              : 'bg-amber-50 dark:bg-[#1A242B] border-slate-200 dark:border-white/[0.06]'
          }`}
        >
          <div className="min-w-0 border-l-2 border-amber-500 pl-2.5 flex items-center gap-2">
            <Edit3 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-amber-600 dark:text-amber-400">Mengedit pesan</p>
              <p
                className={`truncate text-[11px] ${
                  darkSurface ? 'text-gray-400' : 'text-slate-500 dark:text-gray-400'
                }`}
              >
                {editTarget.text}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 text-slate-400 hover:text-rose-500"
            aria-label="Batal Edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reply Banner */}
      {!editTarget && replyTarget && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08]'
              : 'bg-slate-50 dark:bg-[#1A242B] border-slate-200 dark:border-white/[0.06]'
          }`}
        >
          <div
            className={`min-w-0 border-l-2 pl-2.5 ${
              darkSurface ? 'border-sky-400' : 'border-[#00A884]'
            }`}
          >
            <p
              className={`font-bold truncate ${
                darkSurface ? 'text-sky-400' : 'text-[#00A884]'
              }`}
            >
              Membalas {replyTarget.senderName || 'User'}
              {replyTarget.senderUid ? ` #${replyTarget.senderUid}` : ''}
            </p>
            <p
              className={`truncate text-[11px] ${
                darkSurface ? 'text-gray-400' : 'text-slate-500 dark:text-gray-400'
              }`}
            >
              {replyTarget.text || (replyTarget.sticker ? '[Stiker VIP]' : `[${replyTarget.mediaType || 'Media'}]`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="p-1 text-slate-400 hover:text-rose-500"
            aria-label="Batal Balas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected VIP Sticker Pill */}
      {!editTarget && activeStickerMeta && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08]'
              : 'bg-slate-50 dark:bg-[#1A242B] border-slate-200 dark:border-white/[0.06]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
            <span className={`font-bold truncate ${darkSurface ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
              Stiker VIP dipilih: {activeStickerMeta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectSticker('')}
            className="p-1 text-slate-400 hover:text-rose-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Media Error */}
      {mediaError && (
        <div className="px-4 py-2 bg-rose-500/15 border-t border-rose-500/30 flex items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
          <span>{mediaError}</span>
          <button type="button" onClick={onClearMediaError} className="text-rose-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadingMedia && (
        <div
          className={`px-4 py-2 border-t flex items-center gap-2.5 text-xs font-semibold ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08] text-sky-300'
              : 'bg-slate-100 dark:bg-[#1A242B] border-slate-200 dark:border-white/[0.06] text-[#00A884]'
          }`}
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Mengompresi (&le; 1MB) &amp; mengunggah media... {uploadProgress}%</span>
        </div>
      )}

      {/* Media Attachment Preview */}
      {!editTarget && mediaPreview && !uploadingMedia && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08]'
              : 'bg-slate-100 dark:bg-[#1A242B] border-slate-200 dark:border-white/[0.06]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {mediaPreview.type === 'image' && (
              <img
                src={mediaPreview.url}
                alt="Preview"
                className="w-10 h-10 rounded-lg object-cover border border-white/10"
              />
            )}
            {mediaPreview.type === 'video' && (
              <Video className={`w-5 h-5 ${darkSurface ? 'text-sky-400' : 'text-[#00A884]'}`} />
            )}
            {mediaPreview.type === 'audio' && (
              <Mic className={`w-5 h-5 ${darkSurface ? 'text-sky-400' : 'text-[#00A884]'}`} />
            )}
            <div className="min-w-0">
              <p
                className={`font-bold truncate ${
                  darkSurface ? 'text-white' : 'text-slate-800 dark:text-white'
                }`}
              >
                Lampiran {mediaPreview.type.toUpperCase()} siap dikirim
              </p>
              {mediaPreview.type === 'image' && mediaPreview.compressedSize && (
                <p className="text-[10px] text-emerald-500 font-mono-tabular truncate">
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
            onClick={onClearMediaPreview}
            className="text-slate-400 hover:text-rose-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji & VIP Sticker Drawer */}
      {showEmojiDrawer && (
        <div
          className={`p-3 border-t max-h-56 overflow-y-auto ${
            darkSurface
              ? 'bg-[#161820] border-white/[0.08]'
              : 'bg-white dark:bg-[#1B252C] border-slate-200 dark:border-white/[0.06]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <button
              type="button"
              onClick={() => onChangeEmojiTab('free')}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                emojiTab === 'free'
                  ? darkSurface
                    ? 'bg-sky-500 text-white'
                    : 'bg-[#E84A18] text-white'
                  : darkSurface
                  ? 'bg-[#222633] text-gray-300'
                  : 'bg-slate-100 dark:bg-[#2A3942] text-slate-600 dark:text-gray-300'
              }`}
            >
              Emoji Umum
            </button>
            <button
              type="button"
              onClick={() => onChangeEmojiTab('vip')}
              className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                emojiTab === 'vip'
                  ? 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white'
                  : darkSurface
                  ? 'bg-[#222633] text-amber-500'
                  : 'bg-slate-100 dark:bg-[#2A3942] text-amber-600'
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
                  onClick={() => onDraftChange(`${draft}${em}`.slice(0, maxLength))}
                  className={`w-9 h-9 rounded-lg hover:scale-110 text-lg flex items-center justify-center transition-transform ${
                    darkSurface ? 'bg-[#222633]' : 'bg-slate-100 dark:bg-[#2A3942]'
                  }`}
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
                      onSelectSticker(v.id);
                      onToggleEmojiDrawer();
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
              <span
                className={`flex items-center gap-1.5 ${
                  darkSurface ? 'text-gray-200' : 'text-slate-700 dark:text-gray-200'
                }`}
              >
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

      {/* Main Composer Form */}
      <form
        onSubmit={onSubmit}
        className={`px-3 py-2.5 border-t ${
          darkSurface
            ? 'bg-[#0D0E12] border-white/[0.06]'
            : 'bg-slate-50 dark:bg-[#202C33] border-slate-200 dark:border-white/[0.06]'
        }`}
      >
        {darkSurface && (
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] text-gray-500">
              Shift+Enter untuk baris baru · Tempel gambar langsung
            </span>
            <span className="text-[10px] text-gray-500 font-mono-tabular">
              {draft.length}/{maxLength}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div
            className={`flex-1 flex items-end gap-1.5 px-2.5 py-1.5 rounded-2xl border ${
              darkSurface
                ? 'bg-[#1C1E26] border-white/[0.08]'
                : 'bg-white dark:bg-[#2A3942] border-slate-200 dark:border-white/[0.06]'
            }`}
          >
            <button
              type="button"
              onClick={onToggleEmojiDrawer}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                showEmojiDrawer
                  ? darkSurface
                    ? 'text-sky-400 bg-sky-500/15'
                    : 'text-[#E84A18] bg-[#E84A18]/15'
                  : darkSurface
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-500 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white'
              }`}
              aria-label="Emoji dan Stiker"
              title="Emoji & Stiker VIP"
            >
              <Smile className="w-4 h-4" />
            </button>

            {!editTarget && (
              <label
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-colors ${
                  darkSurface
                    ? 'text-gray-400 hover:text-white'
                    : 'text-[#00A884] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Kirim Foto (Kompresi ≤ 1MB)"
              >
                <ImageIcon className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileSelect(e, 'image')}
                  className="hidden"
                />
              </label>
            )}

            {!editTarget && mode !== 'global' && (
              <label
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 text-[#00A884] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Kirim Video"
              >
                <Video className="w-4 h-4" />
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => onFileSelect(e, 'video')}
                  className="hidden"
                />
              </label>
            )}

            {isRecordingVn ? (
              <div className="flex-1 flex items-center justify-between gap-2 h-8 px-2 text-rose-500 dark:text-rose-400 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-mono-tabular">Merekam VN ({recordingSeconds}s)...</span>
                </div>
                <button
                  type="button"
                  onClick={onCancelVn}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 inline-flex items-center gap-1"
                  title="Batalkan VN"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                rows={1}
                maxLength={maxLength}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={placeholder}
                className={`flex-1 bg-transparent py-1.5 px-1 text-xs sm:text-sm leading-5 resize-none max-h-[120px] focus:outline-none min-w-0 ${
                  darkSurface
                    ? 'text-white placeholder-gray-500'
                    : 'text-slate-900 dark:text-white placeholder-slate-400'
                }`}
              />
            )}

            {!editTarget && (
              isRecordingVn ? (
                <button
                  type="button"
                  onClick={onStopVn}
                  className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shrink-0 shadow"
                  title="Selesai Rekam VN"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartVn}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    darkSurface
                      ? 'text-gray-400 hover:text-white'
                      : 'text-[#00A884] hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  title="Rekam Voice Note (VN)"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          <button
            type="submit"
            disabled={!canSend}
            className={`w-11 h-11 rounded-2xl disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow-lg ${
              editTarget
                ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25'
                : darkSurface
                ? 'bg-[#1D7AFC] hover:bg-[#388BFF] shadow-sky-500/25'
                : 'bg-[#00A884] hover:bg-[#06CF9C] shadow-emerald-500/25'
            }`}
            aria-label={editTarget ? 'Simpan Edit' : 'Kirim'}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editTarget ? (
              <Check className="w-5 h-5" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
