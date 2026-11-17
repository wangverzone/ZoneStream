import React, { useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Flame,
  Heart,
  Lock,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DISCORD_AVATAR_DECORATIONS,
  LEVEL_RANK_BORDERS,
  STREAK_FRAME_REWARDS,
  getLevelRankTier,
  normalizeDecorationId,
} from './AvatarDecoration';
import { TELEGRAM_BADGE_MAP, VerifiedBadge } from './VerifiedBadge';
import { StatusEmojiBadge } from './VipEmojis';
import { PROFILE_THEMES } from '../context/AuthContext';
import type { UserProfile } from '../types';

interface VipBenefitsLogProps {
  user: UserProfile | null;
  isPremium: boolean;
  cardClass: string;
  onOpenUpgrade: () => void;
}

type MilestoneCategory = 'vip' | 'badge' | 'charisma' | 'level' | 'streak';

interface BenefitMilestone {
  id: string;
  title: string;
  subtitle: string;
  rewardLabel: string;
  category: MilestoneCategory;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressUnit: string;
  unlockedNote: string;
  accentClass: string;
  iconBgClass: string;
  icon: React.ReactNode;
}

interface CharismaTierInfo {
  tierName: string;
  bonusTitle: string;
  auraBoostLabel: string;
  nextThreshold: number | null;
  accentText: string;
}

function getCharismaTierInfo(charisma: number, isVipOrFounder: boolean): CharismaTierInfo {
  if (charisma >= 100) {
    return {
      tierName: 'Immortal Sovereign Aura',
      bonusTitle: '+25% Prioritas Sorotan Profil & Gelar Bangsawan',
      auraBoostLabel: isVipOrFounder ? '2.5x Prestige Boost Aktif' : '1.5x Prestige Boost Aktif',
      nextThreshold: null,
      accentText: 'text-rose-500 dark:text-rose-400',
    };
  }
  if (charisma >= 50) {
    return {
      tierName: 'Celestial Idol',
      bonusTitle: '+15% Eksposur Peringkat & Lencana Populer',
      auraBoostLabel: isVipOrFounder ? '2.2x Prestige Boost Aktif' : '1.3x Prestige Boost Aktif',
      nextThreshold: 100,
      accentText: 'text-amber-500 dark:text-amber-400',
    };
  }
  if (charisma >= 10) {
    return {
      tierName: 'Rising Cultivators',
      bonusTitle: '+10% Aura Komunitas & Highlight Profil',
      auraBoostLabel: isVipOrFounder ? '2.0x VIP Charisma Boost' : '1.15x Charisma Boost',
      nextThreshold: 50,
      accentText: 'text-emerald-500 dark:text-emerald-400',
    };
  }
  return {
    tierName: 'Novice Aura',
    bonusTitle: 'Kumpulkan Like profil dari komunitas & ruang obrolan',
    auraBoostLabel: isVipOrFounder ? '2.0x VIP EXP & Aura Aktif' : '1.0x Base Aura',
    nextThreshold: 10,
    accentText: 'text-sky-500 dark:text-sky-400',
  };
}

export const VipBenefitsLog: React.FC<VipBenefitsLogProps> = ({
  user,
  isPremium,
  cardClass,
  onOpenUpgrade,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unlocked' | 'next'>('all');

  const isFounder = user?.role === 'founder';
  const hasVipAccess = Boolean(isPremium || user?.isVerified || isFounder);
  const charisma = Math.max(0, Number(user?.charisma || 0));
  const level = Math.max(1, Number(user?.level || 1));
  const longestStreak = Math.max(
    Number(user?.longestStreak || 0),
    Number(user?.watchStreak || 0)
  );
  const totalEpisodesWatched = Math.max(
    Number(user?.totalEpisodesWatched || 0),
    Array.isArray(user?.watchHistory) ? user.watchHistory.length : 0
  );
  const unlockedFrames = Array.isArray(user?.unlockedStreakFrames)
    ? user.unlockedStreakFrames
    : [];

  const charismaTier = useMemo(
    () => getCharismaTierInfo(charisma, hasVipAccess),
    [charisma, hasVipAccess]
  );

  const activeThemeInfo = useMemo(() => {
    const key = user?.profileTheme || 'default';
    return PROFILE_THEMES[key] || PROFILE_THEMES.default;
  }, [user?.profileTheme]);

  const activeDecorationInfo = useMemo(() => {
    const normId = normalizeDecorationId(user?.activeBorder || 'classic', level, isFounder);
    const rankFound = LEVEL_RANK_BORDERS.find((r) => r.id === normId);
    if (rankFound) {
      return {
        name: `${rankFound.name} (${rankFound.tierName})`,
        type: 'Bingkai Level',
        unlocked: true,
      };
    }
    const streakFound = STREAK_FRAME_REWARDS.find((f) => f.id === normId);
    if (streakFound) {
      return { name: streakFound.name, type: 'Frame Streak 3D', unlocked: true };
    }
    const discordFound = DISCORD_AVATAR_DECORATIONS.find((d) => d.id === normId);
    if (discordFound && normId !== 'none') {
      return { name: discordFound.name, type: 'Dekorasi VIP 3D', unlocked: true };
    }
    const currentTier = getLevelRankTier(level, isFounder);
    return {
      name: normId === 'none' ? 'Polos (Tanpa Bingkai)' : `${currentTier.name} (${currentTier.tierName})`,
      type: normId === 'none' ? 'Frame Polos' : 'Bingkai Level',
      unlocked: true,
    };
  }, [user?.activeBorder, level, isFounder]);

  const acquiredBadges = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      categoryLabel: string;
      unlocked: boolean;
      active: boolean;
      accentClass: string;
      renderBadge: () => React.ReactNode;
    }> = [
      {
        id: 'badge-member',
        name: 'Kultivator Terdaftar',
        categoryLabel: 'Lencana Komunitas',
        unlocked: true,
        active: !hasVipAccess,
        accentClass: 'border-emerald-500/30 bg-emerald-500/5',
        renderBadge: () => (
          <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        ),
      },
      {
        id: 'badge-vip',
        name: isFounder
          ? 'Founder Sovereign'
          : TELEGRAM_BADGE_MAP.get(user?.activeBadge || 'verified')?.label || 'Verified VIP',
        categoryLabel: isFounder ? 'Otoritas Tertinggi' : 'Lencana Eksklusif VIP',
        unlocked: hasVipAccess,
        active: hasVipAccess,
        accentClass: hasVipAccess
          ? 'border-sky-500/35 bg-sky-500/10'
          : 'border-slate-200 dark:border-white/5 opacity-60',
        renderBadge: () => (
          <span className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <VerifiedBadge
              size="sm"
              isFounder={isFounder}
              badgeLabel={user?.activeBadge || 'verified'}
            />
          </span>
        ),
      },
      {
        id: 'badge-emoji',
        name: user?.statusEmoji ? `Status Emoji (${user.statusEmoji})` : 'Status Emoji Bergerak',
        categoryLabel: 'Identitas Nama',
        unlocked: hasVipAccess,
        active: Boolean(hasVipAccess && user?.statusEmoji),
        accentClass:
          hasVipAccess && user?.statusEmoji
            ? 'border-amber-500/35 bg-amber-500/10'
            : 'border-slate-200 dark:border-white/5 opacity-65',
        renderBadge: () => (
          <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
            {user?.statusEmoji ? (
              <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </span>
        ),
      },
    ];

    STREAK_FRAME_REWARDS.forEach((frame) => {
      const isFrameUnlocked =
        hasVipAccess ||
        unlockedFrames.includes(frame.id) ||
        longestStreak >= frame.minStreak;
      const isEquipped = normalizeDecorationId(user?.activeBorder || 'none') === frame.id;
      list.push({
        id: `frame-${frame.id}`,
        name: frame.name,
        categoryLabel: `Streak ${frame.minStreak} Hari`,
        unlocked: isFrameUnlocked,
        active: isEquipped,
        accentClass: isFrameUnlocked
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-slate-200 dark:border-white/5 opacity-60',
        renderBadge: () => (
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${frame.accentColor}20`, color: frame.accentColor }}
          >
            <Flame className="w-4 h-4" />
          </span>
        ),
      });
    });

    return list;
  }, [
    hasVipAccess,
    isFounder,
    longestStreak,
    unlockedFrames,
    user?.activeBadge,
    user?.activeBorder,
    user?.statusEmoji,
  ]);

  const milestones = useMemo<BenefitMilestone[]>(() => {
    const activeExpiryFormatted = user?.premiumExpiryDate
      ? new Date(user.premiumExpiryDate).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

    return [
      {
        id: 'ms-vip-pass',
        title: isFounder
          ? 'Otoritas Founder Immortal Aktif'
          : 'Aktivasi Lencana VIP & 2x EXP Multiplier',
        subtitle:
          'Membuka 2x EXP Nonton Harian, bebas iklan 10 detik, 30+ Dekorasi Discord 3D, dan Lencana Terverifikasi.',
        rewardLabel: isFounder ? 'Founder ∞ + Semua Benefit' : '2x EXP + Lencana VIP',
        category: 'vip',
        unlocked: hasVipAccess,
        progressCurrent: hasVipAccess ? 1 : 0,
        progressTarget: 1,
        progressUnit: 'Status',
        unlockedNote: isFounder
          ? 'Aktif Seumur Hidup (Founder)'
          : activeExpiryFormatted
          ? `Aktif hingga ${activeExpiryFormatted}`
          : 'Status VIP Terverifikasi Aktif',
        accentClass: 'text-amber-500 dark:text-amber-400',
        iconBgClass: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
        icon: <Crown className="w-4 h-4" />,
      },
      {
        id: 'ms-first-watch',
        title: 'Langkah Pertama Kultivasi (Nonton Episode)',
        subtitle:
          'Menonton donghua di DonghuaKu untuk membuka riwayat sinkronisasi real-time & perolehan EXP harian.',
        rewardLabel: '+50 EXP / Episode',
        category: 'level',
        unlocked: totalEpisodesWatched >= 1,
        progressCurrent: Math.min(totalEpisodesWatched, 1),
        progressTarget: 1,
        progressUnit: 'Episode',
        unlockedNote: `${totalEpisodesWatched} total episode telah ditonton`,
        accentClass: 'text-emerald-500 dark:text-emerald-400',
        iconBgClass: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400',
        icon: <Zap className="w-4 h-4" />,
      },
      {
        id: 'ms-streak-3',
        title: 'Akuisisi Frame: Ember Pulse 3D (Streak 3 Hari)',
        subtitle:
          'Pertahankan rekor nonton 3 hari berturut-turut untuk membuka cincin bara berputar & aura api.',
        rewardLabel: 'Frame Ember Pulse 3D',
        category: 'streak',
        unlocked:
          hasVipAccess ||
          unlockedFrames.includes('streak-ember') ||
          longestStreak >= 3,
        progressCurrent: Math.min(longestStreak, 3),
        progressTarget: 3,
        progressUnit: 'Hari',
        unlockedNote: 'Dekorasi Ember Pulse 3D Tersedia di Profil',
        accentClass: 'text-orange-500 dark:text-orange-400',
        iconBgClass: 'bg-orange-500/15 text-orange-500 dark:text-orange-400',
        icon: <Flame className="w-4 h-4" />,
      },
      {
        id: 'ms-level-5',
        title: 'Terobosan Ranah Kultivasi Lv. 5',
        subtitle:
          'Naik ke Level 5 melalui misi tontonan harian dan partisipasi komunitas.',
        rewardLabel: 'Gelar Kultivator Inti',
        category: 'level',
        unlocked: level >= 5,
        progressCurrent: Math.min(level, 5),
        progressTarget: 5,
        progressUnit: 'Level',
        unlockedNote: `Telah dicapai (Saat ini Lv.${level})`,
        accentClass: 'text-sky-500 dark:text-sky-400',
        iconBgClass: 'bg-sky-500/15 text-sky-500 dark:text-sky-400',
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        id: 'ms-charisma-10',
        title: 'Bonus Karisma: Rising Cultivators (10 Like)',
        subtitle:
          'Dapatkan 10 Like karisma dari anggota lain di ruang obrolan atau leaderboard.',
        rewardLabel: '+10% Aura Komunitas',
        category: 'charisma',
        unlocked: charisma >= 10,
        progressCurrent: Math.min(charisma, 10),
        progressTarget: 10,
        progressUnit: 'Karisma',
        unlockedNote: `Bonus Aura Aktif (${charisma} ♥ terkumpul)`,
        accentClass: 'text-rose-500 dark:text-rose-400',
        iconBgClass: 'bg-rose-500/15 text-rose-500 dark:text-rose-400',
        icon: <Heart className="w-4 h-4" />,
      },
      {
        id: 'ms-streak-7',
        title: 'Akuisisi Frame: Aurora Prism 3D (Streak 7 Hari)',
        subtitle:
          'Rekor nonton 7 hari beruntun membuka frame spektrum aurora berotasi.',
        rewardLabel: 'Frame Aurora Prism 3D',
        category: 'streak',
        unlocked:
          hasVipAccess ||
          unlockedFrames.includes('streak-aurora') ||
          longestStreak >= 7,
        progressCurrent: Math.min(longestStreak, 7),
        progressTarget: 7,
        progressUnit: 'Hari',
        unlockedNote: 'Dekorasi Aurora Prism 3D Terbuka Permanen',
        accentClass: 'text-cyan-500 dark:text-cyan-400',
        iconBgClass: 'bg-cyan-500/15 text-cyan-500 dark:text-cyan-400',
        icon: <Sparkles className="w-4 h-4" />,
      },
      {
        id: 'ms-level-15',
        title: 'Master Sekte & Kepemimpinan Klan (Lv. 15)',
        subtitle:
          'Capai Level 15 untuk prestise tinggi di papan peringkat klan dan komunitas global.',
        rewardLabel: 'Hak Prestise Sekte',
        category: 'level',
        unlocked: level >= 15,
        progressCurrent: Math.min(level, 15),
        progressTarget: 15,
        progressUnit: 'Level',
        unlockedNote: `Terbuka pada Lv.${level}`,
        accentClass: 'text-indigo-500 dark:text-indigo-400',
        iconBgClass: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
        icon: <Trophy className="w-4 h-4" />,
      },
      {
        id: 'ms-charisma-50',
        title: 'Bonus Karisma: Celestial Idol (50 Like)',
        subtitle:
          'Raih 50 poin karisma untuk membuka bonus eksposur peringkat & sorotan profil.',
        rewardLabel: '+15% Sorotan Peringkat',
        category: 'charisma',
        unlocked: charisma >= 50,
        progressCurrent: Math.min(charisma, 50),
        progressTarget: 50,
        progressUnit: 'Karisma',
        unlockedNote: 'Gelar Celestial Idol Aktif',
        accentClass: 'text-pink-500 dark:text-pink-400',
        iconBgClass: 'bg-pink-500/15 text-pink-500 dark:text-pink-400',
        icon: <Award className="w-4 h-4" />,
      },
      {
        id: 'ms-streak-14',
        title: 'Akuisisi Frame: Celestial Orbit 3D (Streak 14 Hari)',
        subtitle:
          'Rekor 14 hari berturut-turut membuka astrolab emas ganda & komet mengorbit.',
        rewardLabel: 'Frame Celestial Orbit 3D',
        category: 'streak',
        unlocked:
          hasVipAccess ||
          unlockedFrames.includes('streak-celestial') ||
          longestStreak >= 14,
        progressCurrent: Math.min(longestStreak, 14),
        progressTarget: 14,
        progressUnit: 'Hari',
        unlockedNote: 'Dekorasi Celestial Orbit 3D Terbuka Permanen',
        accentClass: 'text-yellow-500 dark:text-yellow-400',
        iconBgClass: 'bg-yellow-500/15 text-yellow-500 dark:text-yellow-400',
        icon: <Star className="w-4 h-4" />,
      },
      {
        id: 'ms-streak-30',
        title: 'Akuisisi Frame: Eternal Phoenix 3D (Streak 30 Hari)',
        subtitle:
          'Puncak dedikasi 30 hari berturut-turut membuka sayap api abadi & korona surya.',
        rewardLabel: 'Frame Eternal Phoenix 3D',
        category: 'streak',
        unlocked:
          hasVipAccess ||
          unlockedFrames.includes('streak-eternal') ||
          longestStreak >= 30,
        progressCurrent: Math.min(longestStreak, 30),
        progressTarget: 30,
        progressUnit: 'Hari',
        unlockedNote: 'Dekorasi Legendaris Eternal Phoenix 3D Terbuka',
        accentClass: 'text-rose-500 dark:text-rose-400',
        iconBgClass: 'bg-rose-500/15 text-rose-500 dark:text-rose-400',
        icon: <Flame className="w-4 h-4" />,
      },
    ];
  }, [
    charisma,
    hasVipAccess,
    isFounder,
    level,
    longestStreak,
    totalEpisodesWatched,
    unlockedFrames,
    user?.premiumExpiryDate,
  ]);

  const unlockedMilestonesCount = useMemo(
    () => milestones.filter((m) => m.unlocked).length,
    [milestones]
  );

  const filteredMilestones = useMemo(() => {
    if (filterMode === 'unlocked') {
      return milestones.filter((m) => m.unlocked);
    }
    if (filterMode === 'next') {
      return milestones.filter((m) => !m.unlocked);
    }
    return milestones;
  }, [filterMode, milestones]);

  return (
    <div className="px-4 mt-4">
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm dark:shadow-none ${cardClass}`}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Log Benefit VIP, Lencana &amp; Bonus Karisma
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                Linimasa pencapaian milestone, akuisisi lencana, dan bonus aura karisma profil Anda secara real-time.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
              Milestone Terbuka
            </span>
            <span className="text-sm font-black font-mono-tabular text-slate-900 dark:text-white">
              {unlockedMilestonesCount} / {milestones.length}
            </span>
          </div>
        </div>

        {/* Active Bonuses Summary Row (Charisma, EXP Multiplier, Equipped Badge/Frame) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          {/* Current Charisma Bonus */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#171A23] border border-slate-200 dark:border-white/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bonus Karisma Aktif
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-extrabold font-mono-tabular text-rose-500 dark:text-rose-400">
                <Heart className="w-3.5 h-3.5 fill-current" />
                {charisma.toLocaleString('id-ID')}
              </span>
            </div>
            <p className={`text-xs font-extrabold truncate ${charismaTier.accentText}`}>
              {charismaTier.tierName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-snug">
              {charismaTier.bonusTitle}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-white/5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-500 dark:text-gray-400">
                {charismaTier.auraBoostLabel}
              </span>
              {charismaTier.nextThreshold ? (
                <span className="font-bold font-mono-tabular text-slate-700 dark:text-gray-300">
                  Target: {charisma}/{charismaTier.nextThreshold} ♥
                </span>
              ) : (
                <span className="font-bold text-emerald-500">Tier Maksimal</span>
              )}
            </div>
          </div>

          {/* Active EXP & VIP Benefit Multiplier */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#171A23] border border-slate-200 dark:border-white/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Multiplier Kultivasi
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono-tabular ${
                  hasVipAccess
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-gray-300'
                }`}
              >
                {isFounder ? 'FOUNDER ∞' : hasVipAccess ? '2.0x VIP EXP' : '1.0x REGULER'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {hasVipAccess
                ? '+100 EXP / Episode (Bonus 2x)'
                : '+50 EXP / Episode (Standar)'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-snug">
              {hasVipAccess
                ? 'Bebas iklan 10 detik & akses penuh 30+ frame Discord 3D.'
                : 'Upgrade VIP untuk menggandakan perolehan EXP harian.'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-white/5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-500 dark:text-gray-400">
                Tema: {activeThemeInfo.label}
              </span>
              <span className="font-bold font-mono-tabular text-sky-500 dark:text-sky-400">
                Lv.{level} ({user?.exp || 0} EXP)
              </span>
            </div>
          </div>

          {/* Equipped Badge & Frame Status */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#171A23] border border-slate-200 dark:border-white/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dekorasi &amp; Lencana Aktif
              </span>
              <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            </div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {activeDecorationInfo.name}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-snug">
              {hasVipAccess
                ? `Lencana ${
                    TELEGRAM_BADGE_MAP.get(user?.activeBadge || 'verified')?.label || 'Verified VIP'
                  } terpasang di profil & chat.`
                : 'Capai streak nonton harian atau aktifkan VIP untuk lencana.'}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-white/5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-500 dark:text-gray-400">
                {activeDecorationInfo.type}
              </span>
              <Link
                to="/profile/edit"
                className="font-bold text-[#E84A18] hover:underline"
              >
                Ubah Lencana →
              </Link>
            </div>
          </div>
        </div>

        {/* Badge & Frame Acquisitions Showcase */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-extrabold text-slate-800 dark:text-gray-200">
              Koleksi Akuisisi Lencana &amp; Frame ({acquiredBadges.filter((b) => b.unlocked).length}/
              {acquiredBadges.length})
            </span>
            <span className="text-[11px] text-slate-500 dark:text-gray-400">
              Rekor Streak Terbaik: <strong className="font-mono-tabular text-slate-800 dark:text-white">{longestStreak} Hari</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {acquiredBadges.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-2.5 flex items-center gap-2.5 transition-colors ${item.accentClass}`}
              >
                {item.renderBadge()}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                    {item.unlocked
                      ? item.active
                        ? 'Sedang Dipakai'
                        : 'Sudah Terbuka'
                      : `Terkunci · ${item.categoryLabel}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Bar for Timeline */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <span className="text-xs font-extrabold text-slate-800 dark:text-gray-200">
            Linimasa Milestone &amp; Riwayat Benefit
          </span>
          <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-[#171A23] p-1 border border-slate-200 dark:border-white/5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-[#242938] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Semua ({milestones.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unlocked')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterMode === 'unlocked'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Terbuka ({unlockedMilestonesCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('next')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterMode === 'next'
                  ? 'bg-[#E84A18] text-white shadow-xs'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Target Berikutnya ({milestones.length - unlockedMilestonesCount})
            </button>
          </div>
        </div>

        {/* Visual Timeline */}
        <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-white/10">
          {filteredMilestones.map((ms) => {
            const pct = Math.min(
              100,
              Math.round((ms.progressCurrent / Math.max(1, ms.progressTarget)) * 100)
            );
            return (
              <div
                key={ms.id}
                className={`relative rounded-xl border p-3 transition-colors ${
                  ms.unlocked
                    ? 'bg-slate-50/90 dark:bg-[#171A23] border-slate-200 dark:border-white/10'
                    : 'bg-slate-50/40 dark:bg-[#13161F]/70 border-slate-200/70 dark:border-white/5'
                }`}
              >
                {/* Timeline node dot */}
                <span
                  className={`
                    -left-[19px] top-4 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
                    ${
                      ms.unlocked
                        ? 'bg-emerald-500 border-white dark:border-[#12131A]'
                        : 'bg-slate-300 dark:bg-slate-700 border-white dark:border-[#12131A]'
                    }
                  `}
                  style={{ position: 'absolute' }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${ms.iconBgClass}`}
                    >
                      {ms.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {ms.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            ms.unlocked
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-gray-400'
                          }`}
                        >
                          {ms.unlocked ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Terbuka</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Terkunci</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {ms.subtitle}
                      </p>

                      {/* Progress Bar & Status Note */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold ${
                            ms.unlocked
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-gray-400'
                          }`}
                        >
                          {ms.unlocked
                            ? ms.unlockedNote
                            : `Progres: ${ms.progressCurrent}/${ms.progressTarget} ${ms.progressUnit} (${pct}%)`}
                        </span>
                        <span className={`text-[10px] font-extrabold ${ms.accentClass}`}>
                          Hadiah: {ms.rewardLabel}
                        </span>
                      </div>

                      {!ms.unlocked && (
                        <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#E84A18] to-amber-500 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {!ms.unlocked && ms.category === 'vip' && (
                    <button
                      type="button"
                      onClick={onOpenUpgrade}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#E84A18] hover:bg-[#F35B2B] text-white text-[10px] font-bold transition-colors"
                    >
                      Aktifkan VIP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
