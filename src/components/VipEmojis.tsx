import React from 'react';
import {
  Atom,
  Crown,
  Eye,
  Flame,
  Gem,
  Ghost,
  Heart,
  Infinity as InfinityIcon,
  Moon,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Sun,
  Swords,
  Zap,
} from 'lucide-react';

export const FREE_EMOJIS = ['🔥', '❤️', '😭', '🤯', '👏', '⚔️', '✨', '😂', '🙏', '👀'];

export interface VipEmojiDef {
  id: string;
  label: string;
  token: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const VIP_EMOJIS: VipEmojiDef[] = [
  {
    id: 'infinity-dao',
    label: 'Tak Terbatas',
    token: '[vip:infinity-dao]',
    bgClass: 'bg-gradient-to-r from-amber-500/25 to-[#E84A18]/25',
    textClass: 'text-amber-500 dark:text-amber-300',
    borderClass: 'border-amber-400/50',
    icon: InfinityIcon,
  },
  {
    id: 'immortal-crown',
    label: 'Immortal',
    token: '[vip:immortal-crown]',
    bgClass: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
    textClass: 'text-amber-600 dark:text-amber-300',
    borderClass: 'border-amber-500/40',
    icon: Crown,
  },
  {
    id: 'founder-flame',
    label: 'Dragon Flame',
    token: '[vip:founder-flame]',
    bgClass: 'bg-gradient-to-r from-[#E84A18]/20 to-rose-500/20',
    textClass: 'text-[#E84A18] dark:text-[#FF7A50]',
    borderClass: 'border-[#E84A18]/40',
    icon: Flame,
  },
  {
    id: 'celestial-sword',
    label: 'Heavenly Sword',
    token: '[vip:celestial-sword]',
    bgClass: 'bg-gradient-to-r from-sky-500/20 to-cyan-500/20',
    textClass: 'text-sky-600 dark:text-sky-300',
    borderClass: 'border-sky-500/40',
    icon: Swords,
  },
  {
    id: 'thunder-tribulation',
    label: 'Petir VIP',
    token: '[vip:thunder-tribulation]',
    bgClass: 'bg-gradient-to-r from-violet-500/20 to-indigo-500/20',
    textClass: 'text-violet-600 dark:text-violet-300',
    borderClass: 'border-violet-500/40',
    icon: Zap,
  },
  {
    id: 'jade-lotus',
    label: 'Permata Giok',
    token: '[vip:jade-lotus]',
    bgClass: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
    textClass: 'text-emerald-600 dark:text-emerald-300',
    borderClass: 'border-emerald-500/40',
    icon: Gem,
  },
  {
    id: 'golden-star',
    label: 'Bintang VIP',
    token: '[vip:golden-star]',
    bgClass: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
    textClass: 'text-yellow-600 dark:text-yellow-300',
    borderClass: 'border-yellow-500/40',
    icon: Star,
  },
  {
    id: 'guardian-shield',
    label: 'Perisai Sekte',
    token: '[vip:guardian-shield]',
    bgClass: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20',
    textClass: 'text-blue-600 dark:text-blue-300',
    borderClass: 'border-blue-500/40',
    icon: Shield,
  },
  {
    id: 'dao-spark',
    label: 'Kilau Dao',
    token: '[vip:dao-spark]',
    bgClass: 'bg-gradient-to-r from-pink-500/20 to-rose-500/20',
    textClass: 'text-pink-600 dark:text-pink-300',
    borderClass: 'border-pink-500/40',
    icon: Sparkles,
  },
  {
    id: 'cosmos-atom',
    label: 'Kosmik Atom',
    token: '[vip:cosmos-atom]',
    bgClass: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
    textClass: 'text-cyan-600 dark:text-cyan-300',
    borderClass: 'border-cyan-500/40',
    icon: Atom,
  },
  {
    id: 'phantom-ghost',
    label: 'Bayangan',
    token: '[vip:phantom-ghost]',
    bgClass: 'bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20',
    textClass: 'text-purple-600 dark:text-purple-300',
    borderClass: 'border-purple-500/40',
    icon: Ghost,
  },
  {
    id: 'rocket-boost',
    label: 'Nitro Boost',
    token: '[vip:rocket-boost]',
    bgClass: 'bg-gradient-to-r from-indigo-500/20 to-fuchsia-500/20',
    textClass: 'text-indigo-600 dark:text-indigo-300',
    borderClass: 'border-indigo-500/40',
    icon: Rocket,
  },
  {
    id: 'royal-heart',
    label: 'Hati VIP',
    token: '[vip:royal-heart]',
    bgClass: 'bg-gradient-to-r from-rose-500/20 to-pink-500/20',
    textClass: 'text-rose-600 dark:text-rose-300',
    borderClass: 'border-rose-500/40',
    icon: Heart,
  },
  {
    id: 'crescent-moon',
    label: 'Bulan Sabit',
    token: '[vip:crescent-moon]',
    bgClass: 'bg-gradient-to-r from-slate-500/20 to-indigo-500/20',
    textClass: 'text-indigo-600 dark:text-sky-200',
    borderClass: 'border-sky-400/40',
    icon: Moon,
  },
  {
    id: 'solar-eclipse',
    label: 'Matahari',
    token: '[vip:solar-eclipse]',
    bgClass: 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20',
    textClass: 'text-orange-600 dark:text-orange-300',
    borderClass: 'border-orange-500/40',
    icon: Sun,
  },
  {
    id: 'mystic-eye',
    label: 'Mata Dewa',
    token: '[vip:mystic-eye]',
    bgClass: 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20',
    textClass: 'text-teal-600 dark:text-teal-300',
    borderClass: 'border-teal-500/40',
    icon: Eye,
  },
];

export const VIP_EMOJI_MAP = new Map(VIP_EMOJIS.map((v) => [v.id, v]));

export function StatusEmojiBadge({
  statusEmoji,
  size = 'sm',
}: {
  statusEmoji?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  if (!statusEmoji) return null;
  const def = VIP_EMOJI_MAP.get(statusEmoji);
  if (!def) return null;
  const Icon = def.icon;
  const boxCls =
    size === 'md'
      ? 'w-6 h-6 rounded-lg'
      : size === 'sm'
      ? 'w-5 h-5 rounded-md'
      : 'w-4 h-4 rounded';
  const iconCls =
    size === 'md' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <span
      title={`Status Eksklusif: ${def.label}`}
      className={`inline-flex items-center justify-center border shrink-0 animate-vip-float shadow-sm ${boxCls} ${def.bgClass} ${def.textClass} ${def.borderClass}`}
    >
      <Icon className={iconCls} />
    </span>
  );
}

export function VipStickerCard({ stickerId }: { stickerId: string }) {
  const def = VIP_EMOJI_MAP.get(stickerId);
  if (!def) return null;
  const Icon = def.icon;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-2xl border ${def.bgClass} ${def.borderClass} shadow-sm`}
    >
      <Icon className={`w-6 h-6 ${def.textClass}`} />
      <div className="leading-tight">
        <p className={`text-xs font-extrabold ${def.textClass}`}>{def.label}</p>
        <p className="text-[10px] text-slate-500 dark:text-gray-400">Stiker VIP</p>
      </div>
    </div>
  );
}

export function renderCommentRichText(text: string): React.ReactNode[] {
  const parts = text.split(/(\[vip:[a-z0-9_-]+\])/gi);
  return parts.map((part, idx) => {
    const match = part.match(/^\[vip:([a-z0-9_-]+)\]$/i);
    if (!match) {
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    }
    const def = VIP_EMOJI_MAP.get(match[1].toLowerCase());
    if (!def) {
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    }
    const Icon = def.icon;
    return (
      <span
        key={idx}
        title={`${def.label} (Emoji VIP)`}
        className={`inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-lg border align-middle text-[11px] font-bold ${def.bgClass} ${def.textClass} ${def.borderClass}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{def.label}</span>
      </span>
    );
  });
}
