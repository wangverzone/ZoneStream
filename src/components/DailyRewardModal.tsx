import React, { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Gift,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { playSoundEffect } from '../utils/soundEffects';

export interface DailyRewardTier {
  day: number;
  coins: number;
  bonusExp: number;
  label: string;
  isJackpot?: boolean;
}

const DEFAULT_REWARD_LADDER: DailyRewardTier[] = [
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
export const OPEN_DAILY_REWARD_EVENT = 'zonestream:open-daily-reward';

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

export function formatDailyCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeClientDailyRewardState(user: any, nowMs: number) {
  if (!user) {
    return {
      canClaim: false,
      remainingMs: 0,
      activeStreak: 0,
      longestStreak: 0,
      completedDaysInCycle: 0,
      targetCycleDay: 1,
    };
  }
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

  const completedDaysInCycle = canClaim
    ? activeStreak % 7
    : activeStreak > 0
    ? ((activeStreak - 1) % 7) + 1
    : 0;
  const targetCycleDay = canClaim ? completedDaysInCycle + 1 : (activeStreak % 7) + 1;

  return {
    canClaim,
    remainingMs,
    activeStreak,
    longestStreak,
    completedDaysInCycle,
    targetCycleDay,
  };
}

export const DailyRewardModal: React.FC = () => {
  const { user, applyUserSnapshot, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [ladder, setLadder] = useState<DailyRewardTier[]>(DEFAULT_REWARD_LADDER);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    rewardCoins: number;
    expGained: number;
    streak: number;
    levelUp: boolean;
    newLevel: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    canClaim,
    remainingMs,
    activeStreak,
    longestStreak,
    completedDaysInCycle,
    targetCycleDay,
  } = computeClientDailyRewardState(user, nowMs);

  const targetReward = ladder[targetCycleDay - 1] || ladder[0];

  // Listen for manual open event from HomePage or anywhere in the app
  useEffect(() => {
    const handleOpen = () => {
      setErrorMsg(null);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_DAILY_REWARD_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_DAILY_REWARD_EVENT, handleOpen);
  }, []);

  // Automatically pop up the Daily Reward modal when user opens the app and 24h reward is ready
  useEffect(() => {
    if (!user?.uid) return;
    const token = getStoredAuthToken();
    if (!token) return;

    let cancelled = false;
    fetch('/api/coins/check-in-status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.ok) return;
        if (Array.isArray(json.rewardsSchedule) && json.rewardsSchedule.length > 0) {
          setLadder(json.rewardsSchedule);
        }
        if (json.canCheckIn) {
          const autoShownKey = `zs_daily_reward_autoshown_${user.uid}_${new Date()
            .toISOString()
            .slice(0, 13)}`;
          if (!sessionStorage.getItem(autoShownKey)) {
            sessionStorage.setItem(autoShownKey, '1');
            setIsOpen(true);
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Live 1-second countdown ticker when modal is open and in 24h cooldown
  useEffect(() => {
    if (!isOpen || canClaim) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, canClaim]);

  const handleClaimDailyReward = async () => {
    if (!canClaim || claiming || !user) return;
    const token = getStoredAuthToken();
    if (!token) return;

    setClaiming(true);
    setErrorMsg(null);
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
        setErrorMsg(json.error || 'Hadiah harian belum tersedia saat ini.');
        return;
      }

      if (json.user) {
        applyUserSnapshot(json.user);
      }
      playSoundEffect('levelUp');
      setClaimResult({
        rewardCoins: Number(json.rewardCoins || targetReward.coins),
        expGained: Number(json.expGained || targetReward.bonusExp),
        streak: Number(json.streak || activeStreak + 1),
        levelUp: Boolean(json.levelUp),
        newLevel: Number(json.newLevel || user.level || 1),
      });
      await refreshUser();
    } catch {
      setErrorMsg('Gagal menghubungi server. Coba lagi sebentar.');
    } finally {
      setClaiming(false);
    }
  };

  if (!isOpen || !user) return null;

  const isFounder = user.role === 'founder';
  const userLevel = isFounder ? 999999 : Math.max(1, Number(user.level) || 1);
  const currentExp = Math.max(0, Number(user.exp) || 0);
  const nextLevelExp = Math.max(100, userLevel * 200);
  const expPct = isFounder ? 100 : Math.min(100, Math.round((currentExp / nextLevelExp) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1A1D2B] to-[#11131C] border border-amber-400/30 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setClaimResult(null);
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/30 hover:bg-black/50 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <CalendarCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Daily Reward 24 Jam
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold">
                  <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                  Streak {activeStreak} Hari
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1">
                Absen &amp; Klaim Koin + EXP Harian
              </h3>
            </div>
          </div>

          {/* Current Level & EXP Progress Bar */}
          <div className="mt-3.5 p-2.5 rounded-2xl bg-black/35 border border-white/10">
            <div className="flex items-center justify-between text-[11px] font-extrabold mb-1.5">
              <span className="text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Level {isFounder ? '∞ (MAX)' : userLevel}
              </span>
              <span className="text-slate-300 font-mono">
                {isFounder ? 'MAX EXP' : `${currentExp} / ${nextLevelExp} EXP (${expPct}%)`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-all duration-500"
                style={{ width: `${expPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Coins className="w-3 h-3" />
                Saldo: {(user.coins ?? 0).toLocaleString('id-ID')} Koin
              </span>
              <span>Rekor Terbaik: {longestStreak} Hari</span>
            </div>
          </div>
        </div>

        {/* 7-Day Streak Ladder */}
        <div className="p-4 space-y-3.5">
          <div className="grid grid-cols-4 gap-2">
            {ladder.slice(0, 4).map((tier) => {
              const isCompleted = tier.day <= completedDaysInCycle;
              const isCurrentTarget = tier.day === targetCycleDay;
              return (
                <div
                  key={tier.day}
                  className={`p-2.5 rounded-2xl border text-center flex flex-col items-center justify-between transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : isCurrentTarget && canClaim
                      ? 'bg-gradient-to-b from-amber-500/25 to-orange-500/20 border-amber-400 ring-2 ring-amber-400/30 text-white scale-[1.03]'
                      : 'bg-[#181C28] border-white/10 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase">{tier.label}</span>
                  <div className="my-1.5">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                    ) : (
                      <Coins className="w-5 h-5 text-amber-400 mx-auto" />
                    )}
                  </div>
                  <span className="text-[11px] font-black text-white">+{tier.coins}</span>
                  <span className="text-[9px] font-bold text-sky-300">+{tier.bonusExp} EXP</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ladder.slice(4, 7).map((tier) => {
              const isCompleted = tier.day <= completedDaysInCycle;
              const isCurrentTarget = tier.day === targetCycleDay;
              return (
                <div
                  key={tier.day}
                  className={`p-2.5 rounded-2xl border text-center flex flex-col items-center justify-between transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : isCurrentTarget && canClaim
                      ? 'bg-gradient-to-b from-amber-500/25 to-orange-500/20 border-amber-400 ring-2 ring-amber-400/30 text-white scale-[1.03]'
                      : tier.isJackpot
                      ? 'bg-gradient-to-b from-purple-500/20 to-[#181C28] border-purple-400/35 text-purple-200'
                      : 'bg-[#181C28] border-white/10 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase truncate max-w-full">
                    {tier.isJackpot ? 'HARI 7 JACKPOT' : tier.label}
                  </span>
                  <div className="my-1.5">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                    ) : tier.isJackpot ? (
                      <Trophy className="w-5 h-5 text-amber-300 mx-auto animate-bounce" />
                    ) : (
                      <Coins className="w-5 h-5 text-amber-400 mx-auto" />
                    )}
                  </div>
                  <span className="text-xs font-black text-amber-300">+{tier.coins} Koin</span>
                  <span className="text-[9px] font-bold text-sky-300">+{tier.bonusExp} EXP</span>
                </div>
              );
            })}
          </div>

          {/* Claim Celebration Result Banner */}
          {claimResult && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                <Sparkles className="w-4 h-4" />
                <span>
                  Streak Hari ke-{claimResult.streak} Berhasil Diklaim!
                </span>
              </div>
              <p className="text-xs">
                Kamu mendapatkan <strong>+{claimResult.rewardCoins} Koin</strong> dan{' '}
                <strong>+{claimResult.expGained} EXP</strong>!
                {claimResult.levelUp && (
                  <span className="block mt-1 text-amber-300 font-extrabold">
                    🎉 LEVEL UP! Selamat, kamu naik ke Level {claimResult.newLevel}!
                  </span>
                )}
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Action Button or 24-Hour Cooldown Timer */}
          {canClaim ? (
            <button
              type="button"
              disabled={claiming}
              onClick={handleClaimDailyReward}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:opacity-95 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-transform active:scale-98 disabled:opacity-50"
            >
              <Gift className="w-4 h-4" />
              <span>
                {claiming
                  ? 'Mengklaim Hadiah...'
                  : `Klaim Hari ${targetCycleDay} (+${targetReward.coins} Koin & +${targetReward.bonusExp} EXP)`}
              </span>
            </button>
          ) : (
            <div className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-extrabold text-slate-300">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Hadiah Hari Ini Sudah Diklaim</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDailyCountdown(remainingMs)}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
