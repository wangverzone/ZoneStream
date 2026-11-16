import { useState } from 'react';
import { ArrowRight, X, Zap } from 'lucide-react';

interface LevelUpCardProps {
  level: number;
  exp: number;
  isFounder?: boolean;
  onOpenXpGuide?: () => void;
  className?: string;
}

export function LevelUpCard({
  level,
  exp,
  isFounder = false,
  onOpenXpGuide,
  className = '',
}: LevelUpCardProps) {
  const [showInternalGuide, setShowInternalGuide] = useState(false);

  const safeLevel = Math.max(1, Number(level) || 1);
  const safeExp = Math.max(0, Number(exp) || 0);
  const expNeeded = Math.max(100, safeLevel * 200);
  const progressPct = isFounder
    ? 100
    : Math.min(100, Math.max(0, Math.round((safeExp / expNeeded) * 100)));

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
        className={`w-full rounded-2xl bg-emerald-50/90 dark:bg-[#111713] border border-emerald-500/25 dark:border-emerald-500/25 p-4 text-left shadow-sm ${className}`}
      >
        {/* Top Row: Rocket + Level up | Lightning XP Pill */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-full bg-emerald-500/15 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-base leading-none shrink-0"
              aria-hidden="true"
            >
              🚀
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              Level up
            </span>
          </div>

          <span
            className="px-3 py-1 rounded-full bg-emerald-500/15 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold inline-flex items-center gap-1 font-mono-tabular shrink-0"
            title={isFounder ? 'EXP Tak Terbatas (Founder)' : `${safeExp} / ${expNeeded} EXP`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isFounder ? '∞' : safeExp}</span>
          </span>
        </div>

        {/* Middle Row: Progress | Percentage */}
        <div className="mt-3.5 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-gray-400">
            Progress
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono-tabular">
            {isFounder ? '100%' : `${progressPct}%`}
          </span>
        </div>

        {/* Green Progress Bar */}
        <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Bottom Row: Cara dapatkan XP -> */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleOpenGuide}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>Cara dapatkan XP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {!isFounder && (
            <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-gray-500">
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
              Tonton episode Anime atau Donghua setiap hari! Member{' '}
              <strong>VIP / Founder</strong> otomatis mendapat{' '}
              <strong className="text-amber-500">2x EXP Lipat Ganda</strong>.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700 dark:text-gray-300">
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Bonus Nonton Harian Pertama</span>
                <span className="font-bold text-[#E84A18] font-mono-tabular">
                  +50 <span className="text-amber-500">(VIP +100)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Bonus Streak Nonton Beruntun</span>
                <span className="font-bold text-amber-500 font-mono-tabular">
                  +75 <span className="text-amber-400">(VIP +150)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Nonton Episode Baru</span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +30 <span className="text-amber-500">(VIP +60)</span>
                </span>
              </li>
              <li className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-[#1B1E26]">
                <span>Tonton Ulang Episode</span>
                <span className="font-bold text-[#3B82F6] font-mono-tabular">
                  +10 <span className="text-amber-500">(VIP +20)</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
