import React, { useRef, useState } from 'react';
import {
  Check,
  EyeOff,
  Film,
  Image as ImageIcon,
  Link2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  MOTION_BACKDROP_PRESETS,
  PHOTO_BACKDROP_PRESETS,
  useBackground,
} from '../context/BackgroundContext';
import { isVideoMediaUrl, sanitizeMediaUrl } from '../utils/backdropStorage';

export function BackgroundCustomizerModal() {
  const {
    config,
    isCustomizerOpen,
    closeCustomizer,
    selectPreset,
    setCustomUrlBackdrop,
    uploadCustomBackdrop,
    clearCustomUpload,
    disableBackdrop,
    resetDefaultBackdrop,
    setOpacity,
    setBlurPx,
    customObjectUrl,
  } = useBackground();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'motion' | 'photo' | 'custom'>(() => {
    if (config.mode === 'custom-upload' || config.mode === 'custom-url') return 'custom';
    if (config.mode === 'preset-photo') return 'photo';
    return 'motion';
  });
  const [urlInput, setUrlInput] = useState(config.customUrl || '');
  const [urlKind, setUrlKind] = useState<'auto' | 'image' | 'video'>('auto');
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!isCustomizerOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    const res = await uploadCustomBackdrop(file);
    setUploading(false);
    if (res.ok) {
      setActiveTab('custom');
      setFeedback({
        type: 'ok',
        text: 'Latar foto/video berhasil dipasang dan tersimpan mulus di perangkatmu!',
      });
    } else {
      setFeedback({
        type: 'err',
        text: res.error || 'Gagal memasang file latar.',
      });
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const clean = sanitizeMediaUrl(urlInput);
    if (!clean) {
      setFeedback({
        type: 'err',
        text: 'Masukkan URL foto atau video yang valid (diawali https://).',
      });
      return;
    }
    const resolvedKind =
      urlKind === 'auto' ? (isVideoMediaUrl(clean) ? 'video' : 'image') : urlKind;
    const ok = setCustomUrlBackdrop(clean, resolvedKind);
    if (ok) {
      setFeedback({
        type: 'ok',
        text: `Latar ${resolvedKind === 'video' ? 'video' : 'foto'} dari link berhasil diterapkan!`,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bg-customizer-title"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] rounded-3xl bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
              <Film className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="bg-customizer-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
              >
                Latar Belakang Aplikasi (Foto &amp; Video)
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] truncate">
                Pilih foto sinematik, animasi halus, atau upload foto/video galeri sendiri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCustomizer}
            aria-label="Tutup pengaturan latar"
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-600 dark:text-gray-300 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 pt-3.5 pb-2 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab('motion')}
              className={`flex-1 min-h-[38px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'motion'
                  ? 'bg-white dark:bg-[#1B1E2A] text-[#E84A18] shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Bergerak (Live)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('photo')}
              className={`flex-1 min-h-[38px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'photo'
                  ? 'bg-white dark:bg-[#1B1E2A] text-[#E84A18] shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Foto HD</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 min-h-[38px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'custom'
                  ? 'bg-white dark:bg-[#1B1E2A] text-[#E84A18] shadow-sm'
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>Upload / Link</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {feedback && (
            <div
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {activeTab === 'motion' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-gray-300">
                Latar animasi ringan 60fps dengan partikel halus (otomatis hemat baterai saat layar tidak aktif).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MOTION_BACKDROP_PRESETS.map((preset) => {
                  const selected =
                    config.mode === 'preset-motion' && config.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      className={`group relative rounded-2xl overflow-hidden border text-left transition-all ${
                        selected
                          ? 'border-[#E84A18] ring-2 ring-[#E84A18]/40 shadow-lg'
                          : 'border-slate-200 dark:border-white/10 hover:border-[#E84A18]/60'
                      }`}
                    >
                      <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                        <img
                          src={preset.imageSrc}
                          alt={preset.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Live</span>
                        </span>
                        {selected && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-[#171A24]">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {preset.label}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate mt-0.5">
                          {preset.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'photo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-gray-300">
                Pilih koleksi foto latar sinematik resolusi tinggi yang dioptimalkan untuk tampilan terang maupun gelap.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PHOTO_BACKDROP_PRESETS.map((preset) => {
                  const selected =
                    config.mode === 'preset-photo' && config.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      className={`group relative rounded-2xl overflow-hidden border text-left transition-all ${
                        selected
                          ? 'border-[#E84A18] ring-2 ring-[#E84A18]/40 shadow-lg'
                          : 'border-slate-200 dark:border-white/10 hover:border-[#E84A18]/60'
                      }`}
                    >
                      <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                        <img
                          src={preset.imageSrc}
                          alt={preset.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                        {selected && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#E84A18] text-white flex items-center justify-center shadow">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <p className="text-xs font-extrabold text-white truncate">
                            {preset.label}
                          </p>
                          <p className="text-[10px] text-gray-300 truncate">{preset.subtitle}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              {/* Local Device Upload (Photo or Video MP4/WebM) */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#171A24] p-4 space-y-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    Upload Foto atau Video dari Galeri Perangkat
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                    Mendukung foto (JPG, PNG, WebP, GIF) dan video (MP4, WebM, MOV hingga 80 MB). Disimpan langsung di browser sehingga langsung mulus tanpa loading jaringan!
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[42px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Menyimpan...' : 'Pilih Foto / Video Sendiri'}</span>
                  </button>

                  {customObjectUrl && (
                    <button
                      type="button"
                      onClick={() => void clearCustomUpload()}
                      className="min-h-[42px] px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Upload</span>
                    </button>
                  )}
                </div>

                {config.mode === 'custom-upload' && customObjectUrl && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      Aktif: {config.customUploadName || 'Media Kustom'}{' '}
                      ({config.customUploadKind === 'video' ? 'Video' : 'Foto'})
                    </span>
                  </div>
                )}
              </div>

              {/* Direct Photo/Video URL */}
              <form
                onSubmit={handleApplyUrl}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#171A24] p-4 space-y-3"
              >
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    Atau Tempel Link URL Foto / Video (.mp4 / .jpg)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                    Masukkan link langsung ke gambar atau file video MP4/WebM favoritmu
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://contoh.com/latar-anime.mp4"
                      className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-white dark:bg-[#11131B] border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#E84A18]"
                    />
                  </div>
                  <select
                    aria-label="Jenis media URL"
                    value={urlKind}
                    onChange={(e) => setUrlKind(e.target.value as 'auto' | 'image' | 'video')}
                    className="h-11 px-3 rounded-xl bg-white dark:bg-[#11131B] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 focus:outline-none focus:border-[#E84A18]"
                  >
                    <option value="auto">Otomatis</option>
                    <option value="image">Foto</option>
                    <option value="video">Video</option>
                  </select>
                  <button
                    type="submit"
                    className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-[#E84A18] dark:bg-white dark:text-slate-950 dark:hover:bg-[#E84A18] dark:hover:text-white text-white text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    Pasang Link
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Smoothness & Legibility Controls */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#171A24] p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
              <SlidersHorizontal className="w-4 h-4 text-[#E84A18]" />
              <span>Kehalusan &amp; Kecerahan Latar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-gray-300">
                    Visibilitas Latar
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#E84A18]">
                    {config.opacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  step={1}
                  value={config.opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-[#E84A18] cursor-pointer"
                />
              </label>

              <label className="block space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-gray-300">
                    Blur Lembut (Fokus Teks)
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[#E84A18]">
                    {config.blurPx}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={14}
                  step={1}
                  value={config.blurPx}
                  onChange={(e) => setBlurPx(Number(e.target.value))}
                  className="w-full accent-[#E84A18] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0D0F16] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={disableBackdrop}
              className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                config.mode === 'none'
                  ? 'border-[#E84A18] bg-[#E84A18]/15 text-[#E84A18]'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#171A24] text-slate-700 dark:text-gray-300 hover:border-slate-300'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Polos (Nonaktif)</span>
            </button>

            <button
              type="button"
              onClick={resetDefaultBackdrop}
              className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#171A24] text-slate-600 dark:text-gray-300 hover:text-[#E84A18] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          <button
            type="button"
            onClick={closeCustomizer}
            className="min-h-[40px] px-5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold shadow-sm transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
