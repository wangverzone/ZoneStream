import {
  BadgeCheck,
  Crown,
  Flame,
  Gem,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Zap,
} from 'lucide-react';
import React from 'react';

export interface TelegramBadgePreset {
  id: string;
  label: string;
  pillClass: string;
  checkClass: string;
  icon: React.ComponentType<{ className?: string }>;
  founderOnly?: boolean;
}

export const FOUNDER_ONLY_BADGE = 'Verified Founder';

export function isFounderBadgeLabel(label?: string): boolean {
  return String(label || '').trim().toLowerCase() === 'verified founder';
}

export function resolveDisplayBadgeLabel(
  badgeLabel?: string,
  isFounder = false,
  isPremium = true
): string {
  const clean = String(badgeLabel || '').trim();
  if (!isFounder && isFounderBadgeLabel(clean)) {
    return isPremium ? 'Verified VIP' : 'Member';
  }
  if (!clean) {
    return isFounder ? FOUNDER_ONLY_BADGE : isPremium ? 'Verified VIP' : 'Member';
  }
  return clean;
}

export const TELEGRAM_BADGE_PRESETS: TelegramBadgePreset[] = [
  {
    id: 'Verified Founder',
    label: 'Verified Founder',
    pillClass:
      'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-[#E84A18]/25 border border-amber-400/50 text-amber-700 dark:text-amber-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-amber-500 dark:text-amber-400 fill-amber-400/20',
    icon: Crown,
    founderOnly: true,
  },
  {
    id: 'Verified VIP',
    label: 'Verified VIP',
    pillClass:
      'bg-gradient-to-r from-sky-500/25 to-blue-600/25 border border-sky-400/50 text-sky-700 dark:text-sky-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-sky-500 dark:text-[#38BDF8] fill-[#38BDF8]/20',
    icon: BadgeCheck,
  },
  {
    id: 'Telegram Star',
    label: 'Telegram Star',
    pillClass:
      'bg-gradient-to-r from-cyan-500/25 to-teal-500/25 border border-cyan-400/50 text-cyan-700 dark:text-cyan-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-cyan-400 fill-cyan-400/20',
    icon: Star,
  },
  {
    id: 'Immortal Sovereign',
    label: 'Immortal Sovereign',
    pillClass:
      'bg-gradient-to-r from-yellow-500/25 to-amber-600/25 border border-yellow-400/50 text-yellow-700 dark:text-yellow-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-amber-400 fill-amber-400/20',
    icon: Crown,
  },
  {
    id: 'Nitro Boost',
    label: 'Nitro Boost',
    pillClass:
      'bg-gradient-to-r from-indigo-500/25 to-purple-600/25 border border-indigo-400/50 text-indigo-700 dark:text-indigo-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-indigo-400 fill-indigo-400/20',
    icon: Zap,
  },
  {
    id: 'Cultivator Pro',
    label: 'Cultivator Pro',
    pillClass:
      'bg-gradient-to-r from-emerald-500/25 to-teal-600/25 border border-emerald-400/50 text-emerald-700 dark:text-emerald-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-emerald-400 fill-emerald-400/20',
    icon: Gem,
  },
  {
    id: 'Shadow Monarch',
    label: 'Shadow Monarch',
    pillClass:
      'bg-gradient-to-r from-violet-500/25 to-purple-700/25 border border-violet-400/50 text-violet-700 dark:text-violet-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-violet-400 fill-violet-400/20',
    icon: ShieldCheck,
  },
  {
    id: 'Donghua Master',
    label: 'Donghua Master',
    pillClass:
      'bg-gradient-to-r from-[#E84A18]/25 to-orange-600/25 border border-[#E84A18]/50 text-[#E84A18] dark:text-[#FF9872] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-orange-400 fill-orange-400/20',
    icon: Flame,
  },
  {
    id: 'Anime Legend',
    label: 'Anime Legend',
    pillClass:
      'bg-gradient-to-r from-rose-500/25 to-pink-600/25 border border-rose-400/50 text-rose-700 dark:text-rose-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-rose-400 fill-rose-400/20',
    icon: Sparkles,
  },
  {
    id: 'Celestial Knight',
    label: 'Celestial Knight',
    pillClass:
      'bg-gradient-to-r from-blue-500/25 to-cyan-600/25 border border-blue-400/50 text-blue-700 dark:text-blue-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-sky-400 fill-sky-400/20',
    icon: Swords,
  },
  {
    id: 'Top Supporter',
    label: 'Top Supporter',
    pillClass:
      'bg-gradient-to-r from-orange-500/25 to-amber-600/25 border border-orange-400/50 text-orange-700 dark:text-orange-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-orange-400 fill-orange-400/20',
    icon: Star,
  },
  {
    id: 'Otaku King',
    label: 'Otaku King',
    pillClass:
      'bg-gradient-to-r from-purple-500/25 to-fuchsia-600/25 border border-purple-400/50 text-purple-700 dark:text-purple-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-purple-400 fill-purple-400/20',
    icon: Crown,
  },
  {
    id: 'Early Adopter',
    label: 'Early Adopter',
    pillClass:
      'bg-gradient-to-r from-teal-500/25 to-emerald-600/25 border border-teal-400/50 text-teal-700 dark:text-teal-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-teal-400 fill-teal-400/20',
    icon: ShieldCheck,
  },
  {
    id: 'Mythic Viewer',
    label: 'Mythic Viewer',
    pillClass:
      'bg-gradient-to-r from-slate-500/20 to-indigo-500/20 border border-slate-400/40 dark:border-white/25 text-slate-800 dark:text-gray-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]',
    checkClass: 'text-sky-400 fill-sky-400/20',
    icon: Sparkles,
  },
];

export const TELEGRAM_BADGE_MAP = new Map(TELEGRAM_BADGE_PRESETS.map((b) => [b.label, b]));

export function VerifiedBadge({
  size = 'md',
  isFounder = false,
  badgeLabel,
  variant,
}: {
  size?: 'sm' | 'md' | 'lg';
  isFounder?: boolean;
  badgeLabel?: string;
  variant?: 'blue' | 'red' | 'pink' | 'gold' | 'purple';
}) {
  const iconSize =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-[22px] h-[22px]' : 'w-[18px] h-[18px]';

  const safeBadgeLabel =
    !isFounder && isFounderBadgeLabel(badgeLabel) ? 'Verified VIP' : badgeLabel;

  // Determine fill color of the 8-point rounded starburst
  let fillColor = '#0099EA'; // Default iconic Sky Blue (images_09c016ec.jfif)
  if (variant === 'red') {
    fillColor = '#E52E2E';
  } else if (variant === 'pink') {
    fillColor = '#EC4899';
  } else if (variant === 'gold') {
    fillColor = '#F59E0B';
  } else if (variant === 'purple') {
    fillColor = '#8B5CF6';
  } else if (isFounder || safeBadgeLabel === 'Donghua Master') {
    fillColor = '#E52E2E'; // Crimson Red like the reference screenshot
  } else if (safeBadgeLabel === 'Anime Legend') {
    fillColor = '#EC4899'; // Pink like Calista in the reference screenshot
  } else if (safeBadgeLabel === 'Immortal Sovereign' || safeBadgeLabel === 'Top Supporter') {
    fillColor = '#F59E0B';
  } else if (
    safeBadgeLabel === 'Shadow Monarch' ||
    safeBadgeLabel === 'Nitro Boost' ||
    safeBadgeLabel === 'Otaku King'
  ) {
    fillColor = '#8B5CF6';
  }

  return (
    <span
      title={safeBadgeLabel || (isFounder ? 'Verified Founder' : 'Verified VIP')}
      className="inline-flex items-center justify-center shrink-0 select-none align-middle"
    >
      <svg
        viewBox="0 0 24 24"
        className={`${iconSize} overflow-visible drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]`}
        aria-hidden="true"
      >
        {/* Iconic 8-Point Rounded Starburst (Exact shape from images_09c016ec.jfif & reference screenshot) */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill={fillColor}
          stroke="#FFFFFF"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        {/* Crisp Bold White Checkmark */}
        <path
          d="M8.4 12.35l2.35 2.35 5.05-5.2"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

