import React from 'react';
import { Crown, Flame, Gem, Shield, Sparkles } from 'lucide-react';

export type PremiumTierKey =
  | 'founder-immortal'
  | 'vip-immortal'
  | 'vip-pro'
  | 'vip-active'
  | 'free-member';

export interface PremiumTierSpec {
  key: PremiumTierKey;
  label: string;
  shortSubtitle: string;
  isPaidOrFounder: boolean;
  auraGradient: string;
  surfaceClass: string;
  borderClass: string;
  textClass: string;
  subtextClass: string;
  sweepGradient: string;
  emblemRingClass: string;
  iconClass: string;
  accentHex: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export interface ResolvePremiumTierInput {
  isPremium?: boolean;
  isFounder?: boolean;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  hideRemainingDays?: boolean;
}

function getRemainingDays(expiry?: string | null): number | null {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function formatCompactPlanSubtitle(plan?: string): string {
  const cleaned = String(plan || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Membership VIP';
  if (cleaned.length <= 22) return cleaned;
  const daysMatch = cleaned.match(/(\d+\s*hari)/i);
  if (daysMatch) return `Paket ${daysMatch[1]}`;
  return `${cleaned.slice(0, 19).trim()}…`;
}

export function resolvePremiumTier({
  isPremium = false,
  isFounder = false,
  premiumPlan = '',
  premiumExpiryDate = null,
  hideRemainingDays = false,
}: ResolvePremiumTierInput): PremiumTierSpec & { remainingDays: number | null } {
  const planLower = String(premiumPlan || '').trim().toLowerCase();
  const remainingDays = hideRemainingDays ? null : getRemainingDays(premiumExpiryDate);

  if (isFounder) {
    return {
      key: 'founder-immortal',
      label: 'Founder Immortal',
      shortSubtitle: 'Akses Seumur Hidup',
      isPaidOrFounder: true,
      auraGradient: 'from-amber-400/55 via-[#E84A18]/45 to-yellow-300/55',
      surfaceClass:
        'bg-gradient-to-r from-amber-50 via-orange-50/90 to-yellow-50 dark:from-[#261910]/95 dark:via-[#1F1412]/95 dark:to-[#241B0D]/95',
      borderClass: 'border-amber-400/60 dark:border-amber-400/50',
      textClass: 'text-amber-900 dark:text-amber-200',
      subtextClass: 'text-amber-700/90 dark:text-amber-300/85',
      sweepGradient: 'from-transparent via-amber-200/45 dark:via-amber-200/20 to-transparent',
      emblemRingClass: 'bg-gradient-to-br from-amber-400 to-[#E84A18] text-white shadow-sm',
      iconClass: 'text-white',
      accentHex: '#F59E0B',
      Icon: Crown,
      remainingDays: null,
    };
  }

  const isImmortalTier =
    isPremium &&
    (planLower.includes('365') ||
      planLower.includes('tahun') ||
      planLower.includes('immortal') ||
      planLower.includes('lifetime') ||
      (remainingDays !== null && remainingDays > 90));

  if (isImmortalTier) {
    return {
      key: 'vip-immortal',
      label: 'VIP Immortal',
      shortSubtitle:
        !hideRemainingDays && remainingDays !== null
          ? `Sisa ${remainingDays} Hari`
          : 'Paket Tahunan',
      isPaidOrFounder: true,
      auraGradient: 'from-cyan-400/50 via-sky-500/45 to-amber-300/50',
      surfaceClass:
        'bg-gradient-to-r from-cyan-50 via-sky-50/90 to-indigo-50 dark:from-[#0E1E28]/95 dark:via-[#11192A]/95 dark:to-[#181B2C]/95',
      borderClass: 'border-cyan-400/55 dark:border-cyan-400/45',
      textClass: 'text-cyan-950 dark:text-cyan-100',
      subtextClass: 'text-cyan-700 dark:text-cyan-300/85',
      sweepGradient: 'from-transparent via-cyan-200/50 dark:via-cyan-300/20 to-transparent',
      emblemRingClass: 'bg-gradient-to-br from-cyan-400 to-indigo-500 text-white shadow-sm',
      iconClass: 'text-white',
      accentHex: '#22D3EE',
      Icon: Sparkles,
      remainingDays,
    };
  }

  const isProTier =
    isPremium &&
    (planLower.includes('60') ||
      planLower.includes('pro') ||
      (remainingDays !== null && remainingDays > 35));

  if (isProTier) {
    return {
      key: 'vip-pro',
      label: 'VIP Pro',
      shortSubtitle:
        !hideRemainingDays && remainingDays !== null ? `Sisa ${remainingDays} Hari` : 'Paket Pro',
      isPaidOrFounder: true,
      auraGradient: 'from-violet-500/50 via-fuchsia-500/40 to-indigo-400/50',
      surfaceClass:
        'bg-gradient-to-r from-violet-50 via-purple-50/90 to-indigo-50 dark:from-[#1B1329]/95 dark:via-[#161428]/95 dark:to-[#13172B]/95',
      borderClass: 'border-violet-400/55 dark:border-violet-400/45',
      textClass: 'text-violet-950 dark:text-violet-100',
      subtextClass: 'text-violet-700 dark:text-violet-300/85',
      sweepGradient: 'from-transparent via-violet-200/45 dark:via-violet-300/20 to-transparent',
      emblemRingClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm',
      iconClass: 'text-white',
      accentHex: '#A855F7',
      Icon: Gem,
      remainingDays,
    };
  }

  if (isPremium) {
    return {
      key: 'vip-active',
      label: 'VIP Aktif',
      shortSubtitle: hideRemainingDays
        ? 'Membership VIP'
        : remainingDays !== null
        ? remainingDays === 0
          ? 'Berakhir Hari Ini'
          : `Sisa ${remainingDays} Hari`
        : formatCompactPlanSubtitle(premiumPlan),
      isPaidOrFounder: true,
      auraGradient: 'from-[#E84A18]/50 via-orange-400/45 to-amber-400/50',
      surfaceClass:
        'bg-gradient-to-r from-orange-50 via-amber-50/90 to-rose-50/70 dark:from-[#231411]/95 dark:via-[#1E1512]/95 dark:to-[#1F1710]/95',
      borderClass: 'border-[#E84A18]/50 dark:border-orange-400/45',
      textClass: 'text-orange-950 dark:text-orange-100',
      subtextClass: 'text-orange-700 dark:text-orange-300/85',
      sweepGradient: 'from-transparent via-orange-200/45 dark:via-orange-300/20 to-transparent',
      emblemRingClass: 'bg-gradient-to-br from-[#E84A18] to-amber-500 text-white shadow-sm',
      iconClass: 'text-white',
      accentHex: '#F97316',
      Icon: Flame,
      remainingDays,
    };
  }

  return {
    key: 'free-member',
    label: 'Member Reguler',
    shortSubtitle: 'Standar',
    isPaidOrFounder: false,
    auraGradient: 'from-slate-400/20 via-slate-300/15 to-slate-400/20',
    surfaceClass: 'bg-slate-100/90 dark:bg-[#171A23]',
    borderClass: 'border-slate-200 dark:border-white/10',
    textClass: 'text-slate-800 dark:text-slate-200',
    subtextClass: 'text-slate-500 dark:text-slate-400',
    sweepGradient: 'from-transparent via-white/30 dark:via-white/10 to-transparent',
    emblemRingClass: 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300',
    iconClass: 'text-slate-600 dark:text-slate-300',
    accentHex: '#64748B',
    Icon: Shield,
    remainingDays: null,
  };
}

interface PremiumTierIndicatorProps {
  isPremium?: boolean;
  isFounder?: boolean;
  premiumPlan?: string;
  premiumExpiryDate?: string | null;
  hideRemainingDays?: boolean;
  onClick?: () => void;
  actionHint?: string;
  compact?: boolean;
  className?: string;
}

export const PremiumTierIndicator: React.FC<PremiumTierIndicatorProps> = ({
  isPremium = false,
  isFounder = false,
  premiumPlan = '',
  premiumExpiryDate = null,
  hideRemainingDays = false,
  onClick,
  actionHint,
  compact = false,
  className = '',
}) => {
  const tier = resolvePremiumTier({
    isPremium,
    isFounder,
    premiumPlan,
    premiumExpiryDate,
    hideRemainingDays,
  });

  const subtitle = actionHint || tier.shortSubtitle;
  const TierIcon = tier.Icon;

  const content = (
    <span className="relative inline-flex items-center [contain:layout_style]">
      {/* Animated Outer Glow Halo (GPU-composited, matches streak pulse aesthetics) */}
      {tier.isPaidOrFounder && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r ${tier.auraGradient} blur-md animate-tier-aura-glow`}
        />
      )}

      {/* Main Badge Body */}
      <span
        className={`relative overflow-hidden inline-flex items-center gap-2 rounded-xl border ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5 min-h-[40px]'
        } ${tier.surfaceClass} ${tier.borderClass} shadow-sm transition-colors`}
      >
        {/* Animated Diagonal Light Sweep */}
        {tier.isPaidOrFounder && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r ${tier.sweepGradient} animate-tier-sweep`}
          />
        )}

        {/* Rotating / Floating Streak-Styled Mini Emblem */}
        <span className="relative flex items-center justify-center shrink-0">
          {tier.isPaidOrFounder && (
            <svg
              aria-hidden="true"
              viewBox="0 0 32 32"
              className="w-7 h-7 animate-streak-spin-slow opacity-85"
            >
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke={tier.accentHex}
                strokeWidth="1.5"
                strokeDasharray="6 4 2 4"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span
            className={`${
              tier.isPaidOrFounder ? 'absolute w-5 h-5' : 'w-6 h-6'
            } rounded-lg flex items-center justify-center ${tier.emblemRingClass} ${
              tier.isPaidOrFounder ? 'animate-tier-emblem' : ''
            }`}
          >
            <TierIcon className={`w-3.5 h-3.5 ${tier.iconClass}`} />
          </span>
        </span>

        {/* Typography Stack */}
        <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap leading-none">
          <span className={`text-xs font-extrabold tracking-tight ${tier.textClass}`}>
            {tier.label}
          </span>
          {subtitle && (
            <>
              <span aria-hidden="true" className={`text-[10px] opacity-60 ${tier.subtextClass}`}>
                ·
              </span>
              <span className={`text-[11px] font-semibold font-mono tabular-nums ${tier.subtextClass}`}>
                {subtitle}
              </span>
            </>
          )}
        </span>
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group inline-flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A18] rounded-xl cursor-pointer transition-transform active:scale-[0.98] ${className}`}
      >
        {content}
      </button>
    );
  }

  return <div className={`inline-flex items-center ${className}`}>{content}</div>;
};
