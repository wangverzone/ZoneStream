import { useEffect, useState } from 'react';
import { Crown, Play, Timer, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AdsterraBanner300x250 } from './AdsterraAds';
import { useAuth } from '../context/AuthContext';

interface WatchAdsModalProps {
  open: boolean;
  episodeTitle: string;
  onUnlock: () => void;
  onClose: () => void;
  onUpgrade?: () => void;
}

export function WatchAdsModal({
  open,
  episodeTitle,
  onUnlock,
  onClose,
  onUpgrade,
}: WatchAdsModalProps) {
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    if (!open) return;
    if (isPremium) {
      onUnlock();
      return;
    }
    setSecondsLeft(10);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, isPremium, onUnlock]);

  if (!open || isPremium) return null;

  const progressPercent = ((10 - secondsLeft) / 10) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-ads-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/10 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-[#E84A18] text-xs font-semibold mb-1">
              <Timer className="w-4 h-4" />
              <span>Tonton Iklan 10 Detik untuk Melanjutkan</span>
            </div>
            <h2
              id="watch-ads-title"
              className="text-base font-bold text-slate-900 dark:text-white line-clamp-1"
            >
              {episodeTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Countdown Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-gray-400">
              {secondsLeft > 0
                ? 'Menyiapkan video player HD...'
                : 'Episode siap ditonton!'}
            </span>
            <span className="font-mono-tabular font-bold text-[#E84A18]">
              {secondsLeft}s
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#E84A18] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Clean Sponsored / Adsterra 300x250 Banner */}
        <AdsterraBanner300x250 className="my-4" />

        <div className="space-y-2.5 mt-4">
          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={onUnlock}
            className={`w-full min-h-[48px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              secondsLeft > 0
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-gray-400 cursor-not-allowed'
                : 'bg-[#E84A18] hover:bg-[#F35B2B] text-white shadow-lg shadow-[#E84A18]/25 active:scale-[0.98]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {secondsLeft > 0
                ? `Tunggu ${secondsLeft} detik...`
                : 'Lanjutkan Nonton Sekarang'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onUpgrade) {
                onUpgrade();
              } else {
                navigate('/profile', { replace: true });
              }
            }}
            className="w-full min-h-[44px] rounded-xl bg-amber-50 dark:bg-[#1D202A] hover:bg-amber-100 dark:hover:bg-[#252936] border border-amber-300/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>Upgrade ke Premium (Tanpa Iklan &amp; Tanpa Timer)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
