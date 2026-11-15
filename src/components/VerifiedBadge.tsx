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
}

export const TELEGRAM_BADGE_PRESETS: TelegramBadgePreset[] = [
  {
    id: 'Verified Founder',
    label: 'Verified Founder',
    pillClass: 'bg-gradient-to-r from-amber-500 to-[#E84A18] text-white shadow-md shadow-[#E84A18]/25',
    checkClass: 'text-amber-500 dark:text-amber-400 fill-amber-400/20',
    icon: Crown,
  },
  {
    id: 'Verified VIP',
    label: 'Verified VIP',
    pillClass: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25',
    checkClass: 'text-sky-500 dark:text-[#38BDF8] fill-[#38BDF8]/20',
    icon: BadgeCheck,
  },
  {
    id: 'Telegram Star',
    label: 'Telegram Star',
    pillClass: 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25',
    checkClass: 'text-cyan-400 fill-cyan-400/20',
    icon: Star,
  },
  {
    id: 'Immortal Sovereign',
    label: 'Immortal Sovereign',
    pillClass: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-md shadow-amber-500/25',
    checkClass: 'text-amber-400 fill-amber-400/20',
    icon: Crown,
  },
  {
    id: 'Nitro Boost',
    label: 'Nitro Boost',
    pillClass: 'bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white shadow-md shadow-fuchsia-500/25',
    checkClass: 'text-fuchsia-400 fill-fuchsia-400/20',
    icon: Zap,
  },
  {
    id: 'Cultivator Pro',
    label: 'Cultivator Pro',
    pillClass: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25',
    checkClass: 'text-emerald-400 fill-emerald-400/20',
    icon: Gem,
  },
  {
    id: 'Shadow Monarch',
    label: 'Shadow Monarch',
    pillClass: 'bg-gradient-to-r from-violet-600 to-purple-800 text-white shadow-md shadow-violet-500/25',
    checkClass: 'text-violet-400 fill-violet-400/20',
    icon: ShieldCheck,
  },
  {
    id: 'Donghua Master',
    label: 'Donghua Master',
    pillClass: 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-md shadow-orange-500/25',
    checkClass: 'text-orange-400 fill-orange-400/20',
    icon: Flame,
  },
  {
    id: 'Anime Legend',
    label: 'Anime Legend',
    pillClass: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/25',
    checkClass: 'text-pink-400 fill-pink-400/20',
    icon: Sparkles,
  },
  {
    id: 'Celestial Knight',
    label: 'Celestial Knight',
    pillClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25',
    checkClass: 'text-sky-400 fill-sky-400/20',
    icon: Swords,
  },
  {
    id: 'Top Supporter',
    label: 'Top Supporter',
    pillClass: 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/25',
    checkClass: 'text-rose-400 fill-rose-400/20',
    icon: Star,
  },
  {
    id: 'Otaku King',
    label: 'Otaku King',
    pillClass: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25',
    checkClass: 'text-indigo-400 fill-indigo-400/20',
    icon: Crown,
  },
  {
    id: 'Early Adopter',
    label: 'Early Adopter',
    pillClass: 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25',
    checkClass: 'text-teal-400 fill-teal-400/20',
    icon: ShieldCheck,
  },
  {
    id: 'Mythic Viewer',
    label: 'Mythic Viewer',
    pillClass: 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md shadow-purple-500/25',
    checkClass: 'text-purple-400 fill-purple-400/20',
    icon: Sparkles,
  },
];

export const TELEGRAM_BADGE_MAP = new Map(TELEGRAM_BADGE_PRESETS.map((b) => [b.label, b]));

export function VerifiedBadge({
  size = 'md',
  isFounder = false,
  badgeLabel,
}: {
  size?: 'sm' | 'md' | 'lg';
  isFounder?: boolean;
  badgeLabel?: string;
}) {
  const iconSize =
    size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const preset = badgeLabel ? TELEGRAM_BADGE_MAP.get(badgeLabel) : undefined;
  const colorCls = isFounder
    ? 'text-amber-500 dark:text-amber-400 fill-amber-400/20 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
    : preset
    ? `${preset.checkClass} drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]`
    : 'text-sky-500 dark:text-[#38BDF8] fill-[#38BDF8]/20 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]';

  return (
    <span
      title={badgeLabel || (isFounder ? 'Verified Founder' : 'Verified Premium')}
      className="inline-flex items-center shrink-0"
    >
      <BadgeCheck className={`${iconSize} ${colorCls}`} />
    </span>
  );
}
