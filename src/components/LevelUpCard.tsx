import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, MessageSquare, Sparkles, Tv, X, Zap } from 'lucide-react';

interface LevelUpCardProps {
  level: number;
  exp: number;
  isFounder?: boolean;
  isPremium?: boolean;
  totalWatchMinutes?: number;
  totalCommentsCount?: number;
  totalEpisodesWatched?: number;
  onOpenXpGuide?: () => void;
  className?: string;
}

function getCultivationTitle(level: number, isFounder: boolean): string {
  if (isFounder || level >= 9999) return 'Supreme Dao Sovereign';
  if (level >= 50) return 'Immortal Emperor';
  if (level >= 30) return 'Soul Formation';
  if (level >= 20) return 'Nascent Soul';
  if (level >= 10) return 'Core Formation';
  if (level >= 5) return 'Foundation Realm';
  return 'Qi Condensation';
}

function formatWatchDuration(totalMinutes: number): string {
  const safeMin = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (safeMin < 60) return `${safeMin} Menit`;
  const hours = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return mins > 0 ? `${hours}j ${mins}m` : `${hours} Jam`;
}

export function LevelUpCard({
  level,
  exp,
  isFounder = false,
  isPremium = false,
  totalWatchMinutes = 0,
  totalCommentsCount = 0,
  totalEpisodesWatched = 0,
  onOpenXpGuide,
  className = '',
}: LevelUpCardProps) {
  const [showInternalGuide, setShowInternalGuide] = useState(false);
  const [recentExpDelta, setRecentExpDelta] = useState<number | null>(null);
  const prevStateRef = useRef<{ level: number; exp: number } | null>(null);

  const safeLevel = Math.max(1, Number(level) || 1);
  const safeExp = Math.max(0, Number(exp) || 0);
  const expNeeded = Math.max(100, safeLevel * 200);
  const expRemaining = Math.max(0, expNeeded - safeExp);
  const progressPct = isFounder
    ? 100
    : Math.min(100, Math.max(0, Math.round((safeExp / expNeeded) * 100)));

  const hasVipMultiplier = Boolean(isFounder || isPremium);
  const safeMinutes = Math.max(
    Number(totalWatchMinutes) || 0,
    (Number(totalEpisodesWatched) || 0) * 18
  );
  const safeComments = Math.max(0, Number(totalCommentsCount) || 0);
  const realmTitle = getCultivationTitle(safeLevel, isFounder);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev && !isFounder) {
      if (safeLevel > prev.level) {
        const gained = safeExp + Math.max(100, prev.level * 200) - prev.exp;
        if (gained > 0) {
          setRecentExpDelta(gained);
        }
      } else if (safeExp > prev.exp) {
        setRecentExpDelta(safeExp - prev.exp);
      }
    }
    prevStateRef.current = { level: safeLevel, exp: safeExp };
  }, [safeLevel, safeExp, isFounder]);

  useEffect(() => {
    if (!recentExpDelta) return;
    const t = window.setTimeout(() => setRecentExpDelta(null), 4000);
    return () => window.clearTimeout(t);
  }, [recentExpDelta]);

  const handleOpenGuide = () => {
    if (onOpenXpGuide) {
      onOpenXpGuide();
    } else {
      setShowInternalGuide(true);
    }
  };

  return (
    <>
      <div
        className={`w-full rounded-2xl bg-emerald-50/90 dark:bg-[#111713] border border-emerald-500/25 dark:border-emerald-500/25 p-4 text-left shadow-sm transition-all ${className}`}
      >
        {/* Top Row: Level Badge + Realm Title | Lightning XP Pill */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-base leading-none shrink-0"
              aria-hidden="true"
            >
              🚀
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {isFounder ? 'Lv. ∞ Sovereign' : `Lv. ${safeLevel} → Lv. ${safeLevel + 1}`}
                </span>
                {hasVipMultiplier && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                    2× EXP
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400/90 truncate">
                {realmTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {recentExpDelta && recentExpDelta > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#E84A18] text-white text-[10px] font-extrabold animate-bounce shadow-sm">
                +{recentExpDelta} EXP
              </span>
            )}
            <span
              className="px-3 py-1 rounded-full bg-emerald-500/15 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold inline-flex items-center gap-1 font-mono-tabular"
              title={isFounder ? 'EXP Tak Terbatas (Founder)' : `${safeExp} / ${expNeeded} EXP`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{isFounder ? '∞ EXP' : `${safeExp} EXP`}</span>
            </span>
          </div>
        </div>

        {/* Middle Row: Progress | Percentage + Remaining EXP */}
        <div className="mt-3.5 flex items-center justify-between text-xs gap-2">
          <span className="font-semibold text-slate-600 dark:text-gray-300">
            {isFounder
              ? 'Level Maksimum Kultivator'
              : `Kurang ${expRemaining} EXP ke Lv. ${safeLevel + 1}`}
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-tabular">
            {isFounder ? '100%' : `${progressPct}%`}
          </span>
        </div>

        {/* Dynamic Animated Progress Bar */}
        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-300 transition-all duration-700 ease-out relative"
            style={{ width: `${Math.max(isFounder ? 100 : 4, progressPct)}%` }}
          />
        </div>

        {/* Dynamic Activity Drivers: Watch Duration & Comments Given */}
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/80 dark:bg-black/25 border border-emerald-500/15 px-3 py-2 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono-tabular truncate">
                {formatWatchDuration(safeMinutes)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                Durasi Nonton · +{hasVipMultiplier ? 30 : 15} XP/mnt
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white/80 dark:bg-black/25 border border-emerald-500/15 px-3 py-2 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono-tabular truncate">
                {safeComments} Komentar
              </p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                Diskusi Aktif · +{hasVipMultiplier ? 50 : 25} XP/komen
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Row: Cara dapatkan XP -> */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleOpenGuide}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cara dapatkan XP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {!isFounder && (
            <span className="text-[11px] font-mono-tabular font-semibold text-slate-500 dark:text-gray-400">
              {safeExp} / {expNeeded} XP
            </span>
          )}
        </div>
      </div>

      {/* Built-in XP Guide Modal when used on PublicProfilePage */}
      {showInternalGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cara Naik Level &amp; Dapatkan XP
              </h3>
              <button
                type="button"
                onClick={() => setShowInternalGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
              Progress bar level meningkat otomatis dari <strong>durasi menonton anime</strong> dan{' '}
              <strong>jumlah komentar</strong> yang kamu berikan. Member{' '}
              <strong>VIP / Founder</strong> otomatis mendapat{' '}
              <strong className="text-amber-500">2× EXP Lipat Ganda</strong>!
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-gray-300">
              <li className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Durasi Menonton (Per Menit)</span>
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-tabular">
                  +15 <span className="text-amber-500">(VIP +30)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  <span>Beri Komentar / Balasan</span>
                </span>
                <span className="font-bold text-sky-600 dark:text-sky-400 font-mono-tabular">
                  +25 <span className="text-amber-500">(VIP +50)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span className="inline-flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-[#E84A18]" />
                  <span>Mulai Nonton Episode Baru</span>
                </span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +30 <span className="text-amber-500">(VIP +60)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Bonus Nonton Harian &amp; Streak</span>
                <span className="font-bold text-[#E84A18] font-mono-tabular">
                  +50~75 <span className="text-amber-500">(VIP +150)</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
