import { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  Clock,
  Coins,
  Flame,
  History,
  Loader2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { playSoundEffect } from '../utils/soundEffects';
import type { UserProfile } from '../types';

export interface DailyCheckInRewardTier {
  day: number;
  coins: number;
  bonusExp: number;
  label: string;
  isJackpot?: boolean;
}

const DEFAULT_CHECKIN_REWARDS: DailyCheckInRewardTier[] = [
  { day: 1, coins: 50, bonusExp: 15, label: 'Hari 1' },
  { day: 2, coins: 75, bonusExp: 20, label: 'Hari 2' },
  { day: 3, coins: 100, bonusExp: 25, label: 'Hari 3' },
  { day: 4, coins: 125, bonusExp: 30, label: 'Hari 4' },
  { day: 5, coins: 150, bonusExp: 40, label: 'Hari 5' },
  { day: 6, coins: 200, bonusExp: 50, label: 'Hari 6' },
  { day: 7, coins: 400, bonusExp: 100, label: 'Hari 7 · Jackpot', isJackpot: true },
];

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GRACE_WINDOW_MS = 48 * 60 * 60 * 1000;

interface DailyCheckInCardProps {
  user: UserProfile;
  cardClass?: string;
  onOpenHistoryModal?: () => void;
}

function getStoredAuthToken(): string {
  try {
    return (
      localStorage.getItem('zonestream_session_token_v1') ||
      localStorage.getItem('donghive_session_token_v1') ||
      ''
    );
  } catch {
    return '';
  }
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function DailyCheckInCard({
  user,
  cardClass = 'bg-white dark:bg-[#13151C] border-slate-200 dark:border-white/[0.07]',
  onOpenHistoryModal,
}: DailyCheckInCardProps) {
  const { applyUserSnapshot } = useAuth();
  const [schedule, setSchedule] = useState<DailyCheckInRewardTier[]>(DEFAULT_CHECKIN_REWARDS);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Tick every second while inside the 24-hour cooldown so countdown stays exact
  const lastCheckInMs = user.lastCheckInAt ? new Date(user.lastCheckInAt).getTime() : 0;
  const validLastMs = lastCheckInMs > 0 && !Number.isNaN(lastCheckInMs) ? lastCheckInMs : 0;
  const elapsedMs = validLastMs ? Math.max(0, nowMs - validLastMs) : Infinity;
  const canClaim = !validLastMs || elapsedMs >= COOLDOWN_MS;
  const remainingMs = canClaim ? 0 : Math.max(0, COOLDOWN_MS - elapsedMs);

  const rawStreak = Math.max(0, Math.floor(Number(user.checkInStreak ?? 0)));
  const activeStreak = validLastMs && elapsedMs <= GRACE_WINDOW_MS ? Math.max(1, rawStreak) : 0;
  const longestStreak = Math.max(
    activeStreak,
    Math.floor(Number(user.longestCheckInStreak ?? 0))
  );
  const totalCheckIns = Math.max(0, Math.floor(Number(user.totalCheckIns ?? 0)));

  // Current 7-day cycle position:
  // If user already claimed within the last 24h (`!canClaim`), activeStreak > 0 and completedInCycle = ((activeStreak - 1) % 7) + 1 (1..7)
  // If user is ready to claim (`canClaim`), completedInCycle = activeStreak % 7 (0..6, resets to 0 after Day 7 cycle completes)
  const completedDaysInCycle = canClaim
    ? activeStreak % 7
    : activeStreak > 0
    ? ((activeStreak - 1) % 7) + 1
    : 0;
  const targetCycleDay = canClaim
    ? completedDaysInCycle + 1
    : (activeStreak % 7) + 1;

  const targetReward = schedule[targetCycleDay - 1] || schedule[0];

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) return;
    let cancelled = false;
    fetch('/api/coins/check-in-status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok && Array.isArray(json.rewardsSchedule) && json.rewardsSchedule.length > 0) {
          setSchedule(json.rewardsSchedule);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    if (canClaim) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [canClaim]);

  const handleCheckIn = async () => {
    if (!canClaim || claiming) return;
    const token = getStoredAuthToken();
    if (!token) {
      setFeedback({ type: 'err', text: 'Silakan login ulang untuk mengklaim Daily Check-in.' });
      return;
    }

    setClaiming(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/coins/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      setNowMs(Date.now());

      if (!res.ok || !json.ok) {
        setFeedback({
          type: 'err',
          text: json.error || 'Daily Check-in belum tersedia saat ini.',
        });
        return;
      }

      if (json.user) {
        applyUserSnapshot(json.user);
      }

      playSoundEffect('levelUp');
      const bonusNote = json.levelUp
        ? ` · Naik ke Level ${json.newLevel}!`
        : '';
      setFeedback({
        type: 'ok',
        text: `Check-in Hari ke-${json.streak} berhasil! +${Number(json.rewardCoins || 0).toLocaleString('id-ID')} Koin & +${json.expGained || 0} EXP ditambahkan${bonusNote}`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'Gagal terhubung ke server untuk memproses Daily Check-in.',
      });
    } finally {
      setClaiming(false);
    }
  };

  const cycleProgressPct = Math.round((completedDaysInCycle / 7) * 100);

  return (
    <section
      aria-labelledby="daily-checkin-heading"
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${cardClass}`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <h3
                id="daily-checkin-heading"
                className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white"
              >
                Daily Check-in Harian
              </h3>
              <span className="text-xs font-extrabold text-[#E84A18] font-mono tabular-nums inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{activeStreak} Hari Streak</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              <span>Klaim bonus koin setiap 24 jam</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Rekor: {longestStreak} Hari
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Total Check-in: {totalCheckIns}×
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Claim / 24h Cooldown Button */}
        <div className="flex items-center gap-2 shrink-0">
          {canClaim ? (
            <button
              type="button"
              disabled={claiming}
              onClick={handleCheckIn}
              className="min-h-[42px] px-4 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {claiming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Coins className="w-4 h-4" />
              )}
              <span className="font-mono tabular-nums">
                {claiming
                  ? 'Mengklaim...'
                  : `Check-in Hari ${targetCycleDay} · +${targetReward.coins} Koin`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-label={`Check-in berikutnya tersedia dalam ${formatCountdown(remainingMs)}`}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-default"
            >
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-mono tabular-nums">
                Check-in Selesai · {formatCountdown(remainingMs)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Notice */}
      {feedback && (
        <div
          className={`mt-3.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pemberitahuan check-in"
            className="opacity-70 hover:opacity-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 7-Day Streak Progress Visualization */}
      <div className="pt-4">
        <div className="flex items-center justify-between gap-2 text-xs mb-2">
          <span className="font-semibold text-slate-600 dark:text-gray-300">
            Progress Streak 7 Hari (Siklus Mingguan)
          </span>
          <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-gray-200">
            {completedDaysInCycle}/7 Hari · {cycleProgressPct}%
          </span>
        </div>

        {/* Continuous Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={completedDaysInCycle}
          aria-valuemin={0}
          aria-valuemax={7}
          className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mb-3.5"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#E84A18] via-amber-500 to-emerald-500 transition-[width] duration-300"
            style={{ width: `${Math.max(completedDaysInCycle > 0 ? 8 : 0, cycleProgressPct)}%` }}
          />
        </div>

        {/* 7-Step Reward Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {schedule.map((tier) => {
            const isClaimed = tier.day <= completedDaysInCycle;
            const isReadyNow = canClaim && tier.day === targetCycleDay;
            const isNextLocked = !canClaim && tier.day === targetCycleDay;

            return (
              <div
                key={tier.day}
                className={`rounded-xl border px-2 py-2.5 flex flex-col items-center justify-between text-center transition-colors ${
                  isClaimed
                    ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                    : isReadyNow
                    ? 'bg-[#E84A18]/10 border-[#E84A18] text-slate-900 dark:text-white shadow-sm'
                    : isNextLocked
                    ? 'bg-amber-500/[0.07] border-dashed border-amber-500/45 text-slate-700 dark:text-gray-200'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-gray-400'
                }`}
              >
                <span className="text-[10px] font-bold leading-none">
                  {tier.isJackpot ? 'Hari 7' : `Hari ${tier.day}`}
                </span>

                <div
                  className={`my-1.5 w-7 h-7 rounded-full flex items-center justify-center ${
                    isClaimed
                      ? 'bg-emerald-500 text-white'
                      : isReadyNow
                      ? 'bg-[#E84A18] text-white'
                      : tier.isJackpot
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-slate-200/70 dark:bg-white/[0.06] text-amber-500'
                  }`}
                >
                  {isClaimed ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : tier.isJackpot ? (
                    <Trophy className="w-3.5 h-3.5" />
                  ) : (
                    <Coins className="w-3.5 h-3.5" />
                  )}
                </div>

                <div>
                  <p
                    className={`text-xs font-extrabold font-mono tabular-nums leading-none ${
                      isClaimed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isReadyNow
                        ? 'text-[#E84A18]'
                        : 'text-slate-800 dark:text-gray-200'
                    }`}
                  >
                    +{tier.coins}
                  </p>
                  <p className="text-[9px] mt-1 font-mono tabular-nums opacity-80 leading-none">
                    {isClaimed
                      ? 'Selesai'
                      : isReadyNow
                      ? 'Siap Klaim'
                      : isNextLocked
                      ? 'Berikutnya'
                      : `+${tier.bonusExp} EXP`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info & History Action */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
          <span>
            {canClaim
              ? `Klik Check-in sekarang untuk menerima +${targetReward.coins} Koin & +${targetReward.bonusExp} EXP.`
              : `Hadiah berikutnya (Hari ${targetCycleDay}): +${targetReward.coins} Koin · Masa tenggang streak 48 jam.`}
          </span>

          {onOpenHistoryModal && (
            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="text-xs font-bold text-[#E84A18] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Lihat Riwayat Koin</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
