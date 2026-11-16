import React from 'react';
import {
  Bell,
  Check,
  MessageCircle,
  Play,
  Rocket,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SOUND_PRESETS,
  playSoundEffect,
  useSoundSettings,
  type SoundCategory,
  type SoundPresetOption,
} from '../utils/soundEffects';
import { useAppLanguage } from '../utils/language';

export function SoundSettingsPanel({
  cardClass = 'bg-white dark:bg-[#13151C] border-slate-200 dark:border-white/[0.07]',
  embedded = false,
}: {
  cardClass?: string;
  embedded?: boolean;
}) {
  const { settings, updateSettings } = useSoundSettings();
  const { lang } = useAppLanguage();
  const isEn = lang === 'en';

  const volumePct = Math.round(settings.volume * 100);
  const allMuted =
    volumePct === 0 ||
    (settings.chat === 'none' &&
      settings.notification === 'none' &&
      settings.levelUp === 'none');

  const categories: Array<{
    key: SoundCategory;
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    options: SoundPresetOption[];
  }> = [
    {
      key: 'chat',
      title: isEn ? 'New Chat Message' : 'Pesan Chat Baru',
      subtitle: isEn
        ? 'Played when a new DM, group, or global chat arrives'
        : 'Diputar saat ada pesan DM, grup, atau global chat baru',
      Icon: MessageCircle,
      accentClass: 'bg-emerald-500/15 text-emerald-500',
      options: SOUND_PRESETS.chat,
    },
    {
      key: 'notification',
      title: isEn ? 'Notification Alert' : 'Peringatan Notifikasi',
      subtitle: isEn
        ? 'Played for new favorite episodes, comment replies & alerts'
        : 'Diputar saat ada rilis anime favorit, balasan komentar & info',
      Icon: Bell,
      accentClass: 'bg-[#E84A18]/15 text-[#E84A18]',
      options: SOUND_PRESETS.notification,
    },
    {
      key: 'levelUp',
      title: isEn ? 'Level-Up Milestone' : 'Pencapaian Naik Level',
      subtitle: isEn
        ? 'Played when your account reaches a new level'
        : 'Diputar saat EXP penuh dan level akunmu naik',
      Icon: Rocket,
      accentClass: 'bg-amber-500/15 text-amber-500',
      options: SOUND_PRESETS.levelUp,
    },
  ];

  const handleSelectPreset = (category: SoundCategory, presetId: string) => {
    updateSettings({ [category]: presetId } as Partial<typeof settings>);
    if (presetId !== 'none') {
      const effectiveVol = settings.volume <= 0.01 ? 0.75 : settings.volume;
      if (settings.volume <= 0.01) {
        updateSettings({ [category]: presetId, volume: 0.75 } as Partial<typeof settings>);
      }
      playSoundEffect(category, presetId, effectiveVol);
    }
  };

  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : `rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${cardClass}`
      }
    >
      {/* Header + Master Volume */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center shrink-0">
            {allMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {isEn ? 'Sound Effects & Alerts' : 'Pengaturan Efek Suara'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
              {isEn
                ? 'Choose custom sounds for chat, notifications, and level-up'
                : 'Pilih nada suara untuk chat baru, notifikasi & naik level'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => updateSettings({ volume: volumePct === 0 ? 0.75 : 0 })}
            className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors ${
              volumePct === 0
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1B1E28] dark:hover:bg-[#242836] border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-200'
            }`}
          >
            {volumePct === 0 ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>{isEn ? 'Muted' : 'Bisukan'}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#E84A18]" />
                <span className="font-mono-tabular">{volumePct}%</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Master Volume Slider */}
      <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-[#171A23] border border-slate-200/80 dark:border-white/[0.06] flex items-center gap-3">
        <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 shrink-0">
          {isEn ? 'Volume' : 'Volume'}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volumePct}
          aria-label={isEn ? 'Sound Effects Volume' : 'Volume Efek Suara'}
          onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
          className="flex-1 accent-[#E84A18] cursor-pointer h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg"
        />
        <span className="w-10 text-right text-xs font-extrabold font-mono-tabular text-[#E84A18]">
          {volumePct}%
        </span>
      </div>

      {/* Sound Categories */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const CategoryIcon = cat.Icon;
          const activeId = settings[cat.key];
          return (
            <div
              key={cat.key}
              className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#151821] p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.accentClass}`}
                  >
                    <CategoryIcon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {cat.title}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
                {activeId !== 'none' && (
                  <button
                    type="button"
                    onClick={() => playSoundEffect(cat.key)}
                    className="h-7 px-2.5 rounded-lg bg-[#E84A18]/15 hover:bg-[#E84A18]/25 text-[#E84A18] text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isEn ? 'Test' : 'Tes'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {cat.options.map((opt) => {
                  const selected = activeId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPreset(cat.key, opt.id)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        selected
                          ? 'border-[#E84A18] bg-[#E84A18]/12 text-slate-900 dark:text-white shadow-sm'
                          : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1C1F2B] hover:border-[#E84A18]/40 text-slate-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold truncate">
                          {isEn ? opt.labelEn : opt.labelId}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                          {isEn ? opt.descEn : opt.descId}
                        </p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          selected
                            ? 'bg-[#E84A18] text-white'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                        }`}
                      >
                        {selected ? (
                          <Check className="w-3 h-3" />
                        ) : opt.id === 'none' ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Play className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
