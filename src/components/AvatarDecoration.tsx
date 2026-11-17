import React, { useEffect, useId, useState } from 'react';
import defaultAvatarImg from '../assets/images/default_avatar_ink_1794755346613.jpg';

export interface DiscordDecorationPreset {
  id: string;
  name: string;
  subtitle: string;
  vip: boolean;
  accentColor: string;
}

export interface StreakFrameReward {
  id: 'streak-ember' | 'streak-aurora' | 'streak-celestial' | 'streak-eternal';
  name: string;
  subtitle: string;
  minStreak: number;
  accentColor: string;
  tierLabel: string;
}

export const STREAK_FRAME_REWARDS: StreakFrameReward[] = [
  {
    id: 'streak-ember',
    name: 'Ember Pulse 3D',
    subtitle: 'Cincin bara berputar & aura api dinamis',
    minStreak: 3,
    accentColor: '#F97316',
    tierLabel: '3 Hari',
  },
  {
    id: 'streak-aurora',
    name: 'Aurora Prism 3D',
    subtitle: 'Prisma aurora spektrum berotasi & kilau bintang',
    minStreak: 7,
    accentColor: '#22D3EE',
    tierLabel: '7 Hari',
  },
  {
    id: 'streak-celestial',
    name: 'Celestial Orbit 3D',
    subtitle: 'Astrolab emas ganda & komet mengorbit',
    minStreak: 14,
    accentColor: '#FACC15',
    tierLabel: '14 Hari',
  },
  {
    id: 'streak-eternal',
    name: 'Eternal Phoenix 3D',
    subtitle: 'Sayap api abadi & korona surya berdenyut',
    minStreak: 30,
    accentColor: '#F43F5E',
    tierLabel: '30 Hari',
  },
];

export const DISCORD_AVATAR_DECORATIONS: DiscordDecorationPreset[] = [
  {
    id: 'dragon-crown',
    name: 'Sovereign Dragon Crown 3D',
    subtitle: 'Tanduk Naga Emas 3D & Permata Kaisar',
    vip: true,
    accentColor: '#F59E0B',
  },
  {
    id: 'cat-ears',
    name: 'Cyber Neko Headset 3D',
    subtitle: 'Headset Kucing Mecha 3D & Neon Gloss',
    vip: true,
    accentColor: '#EC4899',
  },
  {
    id: 'kitsune-ears',
    name: 'Nine-Tail Kitsune Spirit 3D',
    subtitle: 'Telinga Rubah Roh 3D & Api Biru Kitsune',
    vip: true,
    accentColor: '#FB7185',
  },
  {
    id: 'angel-wings',
    name: 'Seraphim Celestial Wings 3D',
    subtitle: 'Sayap Malaikat Berlapis 3D & Halo Emas',
    vip: true,
    accentColor: '#38BDF8',
  },
  {
    id: 'lightning-aura',
    name: 'Thunder God Aureole 3D',
    subtitle: 'Mahkota Petir 3D & Cincin Energi Ungu',
    vip: true,
    accentColor: '#A855F7',
  },
  {
    id: 'sakura-wreath',
    name: 'Sakura Blossom Wreath 3D',
    subtitle: 'Mahkota Bunga Sakura 3D & Kelopak Berkilau',
    vip: true,
    accentColor: '#F472B6',
  },
  {
    id: 'sword-lotus',
    name: 'Immortal Flying Swords 3D',
    subtitle: 'Formasi Pedang Giok 3D & Teratai Abadi',
    vip: true,
    accentColor: '#10B981',
  },
  {
    id: 'shadow-horns',
    name: 'Abyssal Monarch Horns 3D',
    subtitle: 'Tanduk Raja Bayangan 3D & Kristal Void',
    vip: true,
    accentColor: '#8B5CF6',
  },
  {
    id: 'cyber-visor',
    name: 'Mecha Tactical HUD 3D',
    subtitle: 'Armor Visor Siber 3D & Hologram Inti',
    vip: true,
    accentColor: '#06B6D4',
  },
  {
    id: 'frost-crown',
    name: 'Glacial Ice Diadem 3D',
    subtitle: 'Mahkota Berlian Es 3D & Prisma Salju',
    vip: true,
    accentColor: '#67E8F9',
  },
  {
    id: 'astral-orbit',
    name: 'Cosmic Starlight Orbit 3D',
    subtitle: 'Cincin Galaksi 3D & Bintang Kosmik',
    vip: true,
    accentColor: '#818CF8',
  },
  {
    id: 'none',
    name: 'Tanpa Dekorasi',
    subtitle: 'Bingkai HD Bersih',
    vip: false,
    accentColor: '#64748B',
  },
];

export function upgradeAvatarUrlToHd(rawUrl?: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return defaultAvatarImg;
  if (url.startsWith('data:image/')) return url;
  if (url.includes('googleusercontent.com')) {
    return url.replace(/=s\d+(-c)?/g, '=s512-c');
  }
  return url;
}

export function normalizeDecorationId(rawId?: string): string {
  const id = String(rawId || '').trim().toLowerCase();
  if (!id || id === 'classic' || id === 'none') return 'none';

  const legacyMap: Record<string, string> = {
    gold: 'dragon-crown',
    'rainbow-prism': 'dragon-crown',
    crimson: 'kitsune-ears',
    'phoenix-fire': 'kitsune-ears',
    'cyber-neon': 'cat-ears',
    sakura: 'sakura-wreath',
    'emerald-jade': 'sword-lotus',
    'void-abyss': 'shadow-horns',
    'celestial-ice': 'frost-crown',
    'thunder-god': 'lightning-aura',
    'blood-monarch': 'shadow-horns',
    'starlight-idol': 'angel-wings',
    'royal-amethyst': 'astral-orbit',
    'emerald-venom': 'sword-lotus',
    azure: 'frost-crown',
    'celestial-aurora': 'angel-wings',
    'frost-crystal': 'frost-crown',
    'solar-flare': 'dragon-crown',
    'amethyst-royal': 'astral-orbit',
    'blood-moon': 'shadow-horns',
  };

  if (legacyMap[id]) return legacyMap[id];
  if (STREAK_FRAME_REWARDS.some((s) => s.id === id)) return id;
  if (DISCORD_AVATAR_DECORATIONS.some((d) => d.id === id)) return id;
  return 'dragon-crown';
}

interface AvatarDecorationProps {
  src?: string;
  alt?: string;
  decorationId?: string;
  bgColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children?: React.ReactNode;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const SIZE_MAP: Record<
  NonNullable<AvatarDecorationProps['size']>,
  { box: string; img: string; svgInset: string }
> = {
  xs: { box: 'w-7 h-7', img: 'w-7 h-7', svgInset: '-inset-1.5' },
  sm: { box: 'w-9 h-9', img: 'w-9 h-9', svgInset: '-inset-2' },
  md: { box: 'w-11 h-11', img: 'w-11 h-11', svgInset: '-inset-2.5' },
  lg: { box: 'w-16 h-16', img: 'w-16 h-16', svgInset: '-inset-3.5' },
  xl: {
    box: 'w-24 h-24 sm:w-28 sm:h-28',
    img: 'w-24 h-24 sm:w-28 sm:h-28',
    svgInset: '-inset-4 sm:-inset-5',
  },
};

export function AvatarDecoration({
  src,
  alt = 'Avatar',
  decorationId,
  bgColor,
  size = 'md',
  className = '',
  children,
}: AvatarDecorationProps) {
  const hdSrc = upgradeAvatarUrlToHd(src);
  const [imgSrc, setImgSrc] = useState<string>(hdSrc);
  const resolvedId = normalizeDecorationId(decorationId);
  const dims = SIZE_MAP[size] || SIZE_MAP.md;
  const svgUid = useId().replace(/:/g, '');
  const cleanBg =
    typeof bgColor === 'string' && HEX_COLOR_RE.test(bgColor.trim())
      ? bgColor.trim()
      : '';

  useEffect(() => {
    setImgSrc(upgradeAvatarUrlToHd(src));
  }, [src]);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${dims.box} ${className}`}
    >
      {cleanBg && (
        <div
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-full blur-md opacity-55 pointer-events-none z-0"
          style={{ backgroundColor: cleanBg }}
        />
      )}
      <div
        className={`${dims.img} rounded-full overflow-hidden bg-[#12151E] ring-2 ring-white/25 dark:ring-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.55)] relative z-10`}
        style={
          cleanBg
            ? {
                backgroundColor: cleanBg,
                boxShadow: `0 0 0 2px ${cleanBg}88, 0 10px 26px ${cleanBg}55`,
              }
            : undefined
        }
      >
        <img
          src={imgSrc || defaultAvatarImg}
          alt={alt}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (imgSrc !== defaultAvatarImg) setImgSrc(defaultAvatarImg);
          }}
          className="w-full h-full object-cover contrast-[1.04] saturate-[1.06]"
        />
        {/* Subtle 3D Glass Inner Rim for HD Clarity */}
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25 pointer-events-none" />
      </div>

      {resolvedId !== 'none' && (
        <div
          className={`absolute ${dims.svgInset} pointer-events-none z-20 flex items-center justify-center [contain:layout_style]`}
        >
          {render3DDecorationSvg(resolvedId, svgUid)}
        </div>
      )}

      {children}
    </div>
  );
}

function render3DDecorationSvg(id: string, uid = 'g') {
  switch (id) {
    case 'streak-ember':
      return (
        <div className="relative w-full h-full">
          {/* Static Base Glow + Side Flame Accents */}
          <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`se-fire-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9A3412" />
                <stop offset="45%" stopColor="#F97316" />
                <stop offset="80%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#FFFBEB" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="43" fill="none" stroke="#F97316" strokeWidth="7.5" opacity="0.2" />
            <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#se-fire-${uid})`} strokeWidth="3.2" />
            <path
              d="M17 55 C9 49, 7 39, 13 33 C14 40, 18 45, 22 49 Z"
              fill={`url(#se-fire-${uid})`}
              opacity="0.9"
            />
            <path
              d="M103 55 C111 49, 113 39, 107 33 C106 40, 102 45, 98 49 Z"
              fill={`url(#se-fire-${uid})`}
              opacity="0.9"
            />
          </svg>

          {/* GPU-Composited Rotating Molten Orbit Ring */}
          <div className="absolute inset-0 animate-streak-spin">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <radialGradient id={`se-orb-${uid}`} cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFBEB" />
                  <stop offset="45%" stopColor="#FB923C" />
                  <stop offset="100%" stopColor="#C2410C" />
                </radialGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="46.5"
                fill="none"
                stroke="#FDBA74"
                strokeWidth="2"
                strokeDasharray="18 10 6 10"
                strokeLinecap="round"
              />
              <circle cx="60" cy="13.5" r="4" fill={`url(#se-orb-${uid})`} stroke="#FFFBEB" strokeWidth="1" />
              <circle cx="60" cy="106.5" r="3.5" fill={`url(#se-orb-${uid})`} stroke="#FFFBEB" strokeWidth="0.9" />
            </svg>
          </div>

          {/* GPU-Composited Pulse & Shimmer Flame Crest */}
          <div className="absolute inset-0 animate-streak-shimmer">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`se-crest-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="65%" stopColor="#FACC15" />
                  <stop offset="100%" stopColor="#FFFBEB" />
                </linearGradient>
              </defs>
              <path
                d="M52 17 C54 8, 59 3, 60 1 C61 3, 66 8, 68 17 C63 14, 57 14, 52 17 Z"
                fill={`url(#se-crest-${uid})`}
                stroke="#FFFBEB"
                strokeWidth="1"
              />
            </svg>
          </div>
        </div>
      );

    case 'streak-aurora':
      return (
        <div className="relative w-full h-full">
          {/* Static Prism Base Glow Ring */}
          <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`sa-prism-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="35%" stopColor="#34D399" />
                <stop offset="70%" stopColor="#A855F7" />
                <stop offset="100%" stopColor="#F472B6" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="42" fill="none" stroke="#22D3EE" strokeWidth="7.5" opacity="0.18" />
            <circle cx="60" cy="60" r="42" fill="none" stroke={`url(#sa-prism-${uid})`} strokeWidth="3.5" />
          </svg>

          {/* GPU-Composited Forward Rotating Star Arc */}
          <div className="absolute inset-0 animate-streak-spin">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`sa-arc-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22D3EE" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#F472B6" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke={`url(#sa-arc-${uid})`}
                strokeWidth="2.2"
                strokeDasharray="24 12"
                strokeLinecap="round"
              />
              <polygon points="60,8 63,14 69,17 63,20 60,26 57,20 51,17 57,14" fill="#ECFEFF" />
            </svg>
          </div>

          {/* GPU-Composited Reverse Orbiting Nodes */}
          <div className="absolute inset-0 animate-streak-spin-rev">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <circle
                cx="60"
                cy="60"
                r="40"
                fill="none"
                stroke="#A5F3FC"
                strokeWidth="1.2"
                strokeDasharray="8 14"
                opacity="0.85"
              />
              <circle cx="19" cy="60" r="3.4" fill="#34D399" stroke="#FFFFFF" strokeWidth="1" />
              <circle cx="101" cy="60" r="3.4" fill="#F472B6" stroke="#FFFFFF" strokeWidth="1" />
            </svg>
          </div>

          {/* GPU-Composited Bottom Prism Gem Pulse */}
          <div className="absolute inset-0 animate-streak-pulse">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <polygon
                points="60,96 65,103 60,110 55,103"
                fill="#22D3EE"
                stroke="#FFFFFF"
                strokeWidth="1.1"
              />
            </svg>
          </div>
        </div>
      );

    case 'streak-celestial':
      return (
        <div className="relative w-full h-full">
          {/* Static Celestial Gold Halo & Gem */}
          <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`sc-gold-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="40%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <radialGradient id={`sc-gem-${uid}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="42" fill="none" stroke="#FACC15" strokeWidth="7.5" opacity="0.2" />
            <circle cx="60" cy="60" r="42" fill="none" stroke={`url(#sc-gold-${uid})`} strokeWidth="3.5" />
            <polygon
              points="60,94 65,103 60,112 55,103"
              fill={`url(#sc-gem-${uid})`}
              stroke="#FEF08A"
              strokeWidth="1.2"
            />
          </svg>

          {/* GPU-Composited Slow Gold Astrolabe Orbit */}
          <div className="absolute inset-0 animate-streak-spin-slow">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`sc-ring1-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFBEB" />
                  <stop offset="50%" stopColor="#FACC15" />
                  <stop offset="100%" stopColor="#B45309" />
                </linearGradient>
                <radialGradient id={`sc-star-${uid}`} cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="50%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </radialGradient>
              </defs>
              <ellipse
                cx="60"
                cy="60"
                rx="51"
                ry="19"
                transform="rotate(-22 60 60)"
                fill="none"
                stroke={`url(#sc-ring1-${uid})`}
                strokeWidth="2.4"
              />
              <circle cx="15" cy="41" r="4.5" fill={`url(#sc-star-${uid})`} stroke="#FEF08A" strokeWidth="1.2" />
            </svg>
          </div>

          {/* GPU-Composited Counter-Rotating Cyan Comet Ring */}
          <div className="absolute inset-0 animate-streak-spin-rev">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <ellipse
                cx="60"
                cy="60"
                rx="51"
                ry="19"
                transform="rotate(22 60 60)"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.8"
                strokeDasharray="16 8"
              />
              <circle cx="105" cy="41" r="4" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.1" />
            </svg>
          </div>

          {/* GPU-Composited Floating Crown Crest */}
          <div className="absolute inset-0 animate-streak-shimmer">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <path
                d="M47 18 L53 6 L60 13 L67 6 L73 18 Z"
                fill="#FACC15"
                stroke="#FFFBEB"
                strokeWidth="1.1"
              />
            </svg>
          </div>
        </div>
      );

    case 'streak-eternal':
      return (
        <div className="relative w-full h-full">
          {/* Static Phoenix Base Ring & Crown */}
          <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`set-base-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9F1239" />
                <stop offset="45%" stopColor="#F43F5E" />
                <stop offset="80%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#FFFBEB" />
              </linearGradient>
              <radialGradient id={`set-core-${uid}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="40%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#E11D48" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="41.8" fill="none" stroke="#F43F5E" strokeWidth="8" opacity="0.22" />
            <circle cx="60" cy="60" r="41.8" fill="none" stroke={`url(#set-base-${uid})`} strokeWidth="3.6" />
            <path
              d="M44 21 L51 6 L60 15 L69 6 L76 21 Q60 16 44 21 Z"
              fill={`url(#set-base-${uid})`}
              stroke="#FFFBEB"
              strokeWidth="1.1"
            />
            <polygon
              points="60,3 65,12 60,21 55,12"
              fill={`url(#set-core-${uid})`}
              stroke="#FFFBEB"
              strokeWidth="1.2"
            />
          </svg>

          {/* GPU-Composited Rotating Solar Corona Ring */}
          <div className="absolute inset-0 animate-streak-spin">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`set-corona-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F43F5E" />
                  <stop offset="60%" stopColor="#FACC15" />
                  <stop offset="100%" stopColor="#FFFBEB" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="45.5"
                fill="none"
                stroke={`url(#set-corona-${uid})`}
                strokeWidth="2.8"
                strokeDasharray="14 6 4 6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* GPU-Composited Shimmering Phoenix Flame Wings */}
          <div className="absolute inset-0 animate-streak-shimmer">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`set-wing-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9F1239" />
                  <stop offset="45%" stopColor="#F43F5E" />
                  <stop offset="80%" stopColor="#FACC15" />
                  <stop offset="100%" stopColor="#FFFBEB" />
                </linearGradient>
              </defs>
              <path
                d="M20 58 C1 46, 0 22, 14 14 C15 24, 21 31, 27 35 C9 37, 5 50, 12 61 C18 58, 22 57, 25 59 C11 66, 10 80, 22 86 C25 78, 27 72, 29 66 Z"
                fill={`url(#set-wing-${uid})`}
                stroke="#FEF08A"
                strokeWidth="1.2"
              />
              <path
                d="M100 58 C119 46, 120 22, 106 14 C105 24, 99 31, 93 35 C111 37, 115 50, 108 61 C102 58, 98 57, 95 59 C109 66, 110 80, 98 86 C95 78, 93 72, 91 66 Z"
                fill={`url(#set-wing-${uid})`}
                stroke="#FEF08A"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          {/* GPU-Composited Bottom Solar Gem Pulse */}
          <div className="absolute inset-0 animate-streak-pulse">
            <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
              <polygon
                points="60,94 67,104 60,113 53,104"
                fill="#FDE047"
                stroke="#FEF08A"
                strokeWidth="1.3"
              />
            </svg>
          </div>
        </div>
      );

    case 'dragon-crown':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(245,158,11,0.65)]"
        >
          <defs>
            <linearGradient id="dc3d-metal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="28%" stopColor="#FDE047" />
              <stop offset="65%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
            <linearGradient id="dc3d-rim" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#92400E" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FEF08A" />
            </linearGradient>
            <radialGradient id="dc3d-ruby" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFE4E6" />
              <stop offset="35%" stopColor="#FB7185" />
              <stop offset="75%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#881337" />
            </radialGradient>
          </defs>
          {/* 3D Beveled Outer & Inner Gold Torus Ring */}
          <circle cx="60" cy="60" r="42.5" fill="none" stroke="#451A03" strokeWidth="4.5" opacity="0.65" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="url(#dc3d-metal)" strokeWidth="3.5" />
          <circle
            cx="60"
            cy="60"
            r="40.5"
            fill="none"
            stroke="#FEF9C3"
            strokeWidth="1"
            strokeDasharray="18 6"
            opacity="0.85"
          />
          {/* Left 3D Sculpted Dragon Horn with Shadow & Highlight */}
          <path
            d="M27 36 C11 26, 8 9, 20 2 C19 13, 25 19, 35 23 C29 15, 31 7, 39 4 C36 14, 38 21, 43 26 Z"
            fill="#451A03"
            transform="translate(0, 2)"
            opacity="0.55"
          />
          <path
            d="M27 36 C11 26, 8 9, 20 2 C19 13, 25 19, 35 23 C29 15, 31 7, 39 4 C36 14, 38 21, 43 26 Z"
            fill="url(#dc3d-metal)"
            stroke="#FEF08A"
            strokeWidth="1"
          />
          {/* Right 3D Sculpted Dragon Horn */}
          <path
            d="M93 36 C109 26, 112 9, 100 2 C101 13, 95 19, 85 23 C91 15, 89 7, 81 4 C84 14, 82 21, 77 26 Z"
            fill="#451A03"
            transform="translate(0, 2)"
            opacity="0.55"
          />
          <path
            d="M93 36 C109 26, 112 9, 100 2 C101 13, 95 19, 85 23 C91 15, 89 7, 81 4 C84 14, 82 21, 77 26 Z"
            fill="url(#dc3d-metal)"
            stroke="#FEF08A"
            strokeWidth="1"
          />
          {/* Center 3D Sovereign Diadem */}
          <path
            d="M41 24 L49 9 L60 17 L71 9 L79 24 Q60 19 41 24 Z"
            fill="url(#dc3d-rim)"
            stroke="#FEF9C3"
            strokeWidth="1.2"
          />
          {/* 3D Faceted Center Ruby Gem + Specular Shine */}
          <polygon
            points="60,6 66,15 60,24 54,15"
            fill="url(#dc3d-ruby)"
            stroke="#FEF08A"
            strokeWidth="1.3"
          />
          <polygon points="60,8 63,13 60,15 58,12" fill="#FFFFFF" opacity="0.75" />
          {/* Side & Bottom 3D Dragon Claws / Pearls */}
          <circle cx="17" cy="60" r="4.5" fill="url(#dc3d-ruby)" stroke="#FDE047" strokeWidth="1.2" />
          <circle cx="15.8" cy="58.8" r="1.3" fill="#FFFFFF" opacity="0.8" />
          <circle cx="103" cy="60" r="4.5" fill="url(#dc3d-ruby)" stroke="#FDE047" strokeWidth="1.2" />
          <circle cx="101.8" cy="58.8" r="1.3" fill="#FFFFFF" opacity="0.8" />
          <polygon
            points="60,95 66,103 60,111 54,103"
            fill="url(#dc3d-metal)"
            stroke="#FEF9C3"
            strokeWidth="1.1"
          />
        </svg>
      );

    case 'cat-ears':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(236,72,153,0.65)]"
        >
          <defs>
            <linearGradient id="neko3d-shell" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCE7F3" />
              <stop offset="35%" stopColor="#F472B6" />
              <stop offset="70%" stopColor="#DB2777" />
              <stop offset="100%" stopColor="#4C1D95" />
            </linearGradient>
            <linearGradient id="neko3d-ear" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#311042" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <radialGradient id="neko3d-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#F9A8D4" />
              <stop offset="100%" stopColor="#F43F5E" />
            </radialGradient>
            <radialGradient id="neko3d-bell" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="45%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#B45309" />
            </radialGradient>
          </defs>
          {/* 3D Glossy Ring */}
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#neko3d-shell)" strokeWidth="3.2" />
          {/* 3D Headband Arch */}
          <path
            d="M18 56 A43 43 0 0 1 102 56"
            fill="none"
            stroke="url(#neko3d-shell)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          {/* Left 3D Mecha Cat Ear Chassis */}
          <path
            d="M20 40 L11 7 L43 22 Z"
            fill="url(#neko3d-ear)"
            stroke="url(#neko3d-shell)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M23 34 L17 14 L36 23 Z" fill="url(#neko3d-glow)" />
          <path d="M19 16 L24 19 L21 26 Z" fill="#FFFFFF" opacity="0.65" />
          {/* Right 3D Mecha Cat Ear Chassis */}
          <path
            d="M100 40 L109 7 L77 22 Z"
            fill="url(#neko3d-ear)"
            stroke="url(#neko3d-shell)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M97 34 L103 14 L84 23 Z" fill="url(#neko3d-glow)" />
          <path d="M101 16 L96 19 L99 26 Z" fill="#FFFFFF" opacity="0.65" />
          {/* 3D Cushioned Ear Cups with Neon LED Ring */}
          <rect
            x="10"
            y="46"
            width="10"
            height="22"
            rx="5"
            fill="url(#neko3d-shell)"
            stroke="#FDF2F8"
            strokeWidth="1.2"
          />
          <rect x="13" y="50" width="3" height="14" rx="1.5" fill="#22D3EE" />
          <rect
            x="100"
            y="46"
            width="10"
            height="22"
            rx="5"
            fill="url(#neko3d-shell)"
            stroke="#FDF2F8"
            strokeWidth="1.2"
          />
          <rect x="104" y="50" width="3" height="14" rx="1.5" fill="#22D3EE" />
          {/* 3D Golden Neko Bell & Ribbon */}
          <path d="M48 99 L60 95 L72 99 L68 105 L60 101 L52 105 Z" fill="#F43F5E" />
          <circle cx="60" cy="102" r="6.5" fill="url(#neko3d-bell)" stroke="#FEF08A" strokeWidth="1.2" />
          <circle cx="58" cy="99.8" r="1.8" fill="#FFFFFF" opacity="0.85" />
          <circle cx="60" cy="104.5" r="1.4" fill="#451A03" />
        </svg>
      );

    case 'kitsune-ears':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(244,63,94,0.65)]"
        >
          <defs>
            <linearGradient id="kit3d-fur" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#FFE4E6" />
              <stop offset="75%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#9F1239" />
            </linearGradient>
            <radialGradient id="kit3d-orb" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#7DD3FC" />
              <stop offset="80%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </radialGradient>
          </defs>
          {/* 3D Shrine Rope Ring */}
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="#E11D48" strokeWidth="3.2" />
          <circle
            cx="60"
            cy="60"
            r="41.5"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
          {/* Left 3D Sculpted Fox Ear */}
          <path
            d="M23 39 C12 21, 8 4, 16 1 C27 5, 37 16, 43 26 Z"
            fill="url(#kit3d-fur)"
            stroke="#881337"
            strokeWidth="1.8"
          />
          <path d="M26 33 C19 21, 16 10, 19 8 C26 11, 32 18, 36 25 Z" fill="#F43F5E" opacity="0.85" />
          <path d="M16 4 C19 7, 22 12, 20 16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          {/* Right 3D Sculpted Fox Ear */}
          <path
            d="M97 39 C108 21, 112 4, 104 1 C93 5, 83 16, 77 26 Z"
            fill="url(#kit3d-fur)"
            stroke="#881337"
            strokeWidth="1.8"
          />
          <path d="M94 33 C101 21, 104 10, 101 8 C94 11, 88 18, 84 25 Z" fill="#F43F5E" opacity="0.85" />
          {/* 3D Floating Kitsune Spirit Orbs */}
          <path
            d="M13 78 C6 69, 12 56, 16 49 C21 58, 25 69, 18 78 Z"
            fill="url(#kit3d-orb)"
            stroke="#E0F2FE"
            strokeWidth="1"
          />
          <circle cx="15" cy="69" r="3" fill="#FFFFFF" opacity="0.8" />
          <path
            d="M107 78 C114 69, 108 56, 104 49 C99 58, 95 69, 102 78 Z"
            fill="url(#kit3d-orb)"
            stroke="#E0F2FE"
            strokeWidth="1"
          />
          <circle cx="105" cy="69" r="3" fill="#FFFFFF" opacity="0.8" />
          {/* Top Kitsune Jewel */}
          <circle cx="60" cy="17" r="5.5" fill="url(#kit3d-orb)" stroke="#FDE047" strokeWidth="1.5" />
          <circle cx="58.3" cy="15.3" r="1.6" fill="#FFFFFF" />
        </svg>
      );

    case 'angel-wings':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_12px_rgba(56,189,248,0.65)]"
        >
          <defs>
            <linearGradient id="ang3d-feather" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E0F2FE" />
              <stop offset="85%" stopColor="#7DD3FC" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="ang3d-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          {/* 3D Celestial Ring */}
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#ang3d-feather)" strokeWidth="3" />
          {/* 3D Double-Layered Halo */}
          <ellipse cx="60" cy="11" rx="24" ry="5.5" fill="none" stroke="#78350F" strokeWidth="4" opacity="0.45" />
          <ellipse cx="60" cy="10" rx="24" ry="5.5" fill="none" stroke="url(#ang3d-gold)" strokeWidth="3.2" />
          {/* Left 3D Layered Wing */}
          <path
            d="M21 54 C2 43, 0 24, 12 17 C14 26, 20 32, 26 35 C8 35, 2 48, 9 59 C15 56, 20 55, 24 56 C9 62, 7 75, 18 81 C22 74, 25 69, 27 64 Z"
            fill="url(#ang3d-feather)"
            stroke="#BAE6FD"
            strokeWidth="1.4"
          />
          {/* Right 3D Layered Wing */}
          <path
            d="M99 54 C118 43, 120 24, 108 17 C106 26, 100 32, 94 35 C112 35, 118 48, 111 59 C105 56, 100 55, 96 56 C111 62, 113 75, 102 81 C98 74, 95 69, 93 64 Z"
            fill="url(#ang3d-feather)"
            stroke="#BAE6FD"
            strokeWidth="1.4"
          />
          {/* Bottom 3D Starburst Gem */}
          <path
            d="M60 93 L63 100 L70 103 L63 106 L60 113 L57 106 L50 103 L57 100 Z"
            fill="url(#ang3d-gold)"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        </svg>
      );

    case 'lightning-aura':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_0_12px_rgba(168,85,247,0.85)]"
        >
          <defs>
            <linearGradient id="th3d-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F3E8FF" />
              <stop offset="35%" stopColor="#C084FC" />
              <stop offset="70%" stopColor="#9333EA" />
              <stop offset="100%" stopColor="#3B0764" />
            </linearGradient>
            <linearGradient id="th3d-gold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          {/* 3D Plasma Ring */}
          <circle cx="60" cy="60" r="42" fill="none" stroke="#3B0764" strokeWidth="5" opacity="0.7" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="url(#th3d-ring)" strokeWidth="3.2" />
          <circle
            cx="60"
            cy="60"
            r="39.5"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.2"
            strokeDasharray="10 8"
          />
          {/* Top 3D Thunder God Crown Crest */}
          <polygon
            points="60,2 50,19 58,19 53,31 70,14 62,14"
            fill="url(#th3d-gold)"
            stroke="#9333EA"
            strokeWidth="1.4"
          />
          {/* Left 3D High-Voltage Bolts */}
          <polyline
            points="24,25 11,39 20,43 9,58 19,63 12,79"
            fill="none"
            stroke="#581C87"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="24,25 11,39 20,43 9,58 19,63 12,79"
            fill="none"
            stroke="url(#th3d-gold)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right 3D High-Voltage Bolts */}
          <polyline
            points="96,25 109,39 100,43 111,58 101,63 108,79"
            fill="none"
            stroke="#581C87"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="96,25 109,39 100,43 111,58 101,63 108,79"
            fill="none"
            stroke="url(#th3d-gold)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bottom 3D Electro Core Crystal */}
          <polygon
            points="48,99 60,93 72,99 60,109"
            fill="url(#th3d-ring)"
            stroke="#FEF08A"
            strokeWidth="1.4"
          />
          <polygon points="55,98 60,95 65,98 60,102" fill="#FFFFFF" opacity="0.8" />
        </svg>
      );

    case 'sakura-wreath':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(244,114,182,0.65)]"
        >
          <defs>
            <radialGradient id="sak3d-petal" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#FBCFE8" />
              <stop offset="100%" stopColor="#EC4899" />
            </radialGradient>
            <radialGradient id="sak3d-core" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="#9D174D" strokeWidth="3.5" />
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="#F9A8D4" strokeWidth="2" strokeDasharray="12 5" />
          {/* Top-Left 3D Blossom */}
          <g transform="translate(25, 25)">
            <circle cx="0" cy="-6" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="3" fill="url(#sak3d-core)" />
          </g>
          {/* Top-Right 3D Blossom */}
          <g transform="translate(95, 25)">
            <circle cx="0" cy="-6" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="3" fill="url(#sak3d-core)" />
          </g>
          {/* Bottom Center 3D Blossom */}
          <g transform="translate(60, 102) scale(0.85)">
            <circle cx="0" cy="-6" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-3.5" cy="5.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="-5.5" cy="-1.5" r="5" fill="url(#sak3d-petal)" stroke="#BE185D" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="3" fill="url(#sak3d-core)" />
          </g>
        </svg>
      );

    case 'sword-lotus':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(16,185,129,0.65)]"
        >
          <defs>
            <linearGradient id="sw3d-jade" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ECFDF5" />
              <stop offset="40%" stopColor="#6EE7B7" />
              <stop offset="80%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#064E3B" />
            </linearGradient>
            <linearGradient id="sw3d-hilt" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B45309" />
              <stop offset="50%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#sw3d-jade)" strokeWidth="3.2" />
          {/* Left 3D Jade Immortal Sword */}
          <g transform="rotate(-24 20 55)">
            <polygon
              points="15,12 19,2 23,12 21.5,68 16.5,68"
              fill="url(#sw3d-jade)"
              stroke="#ECFDF5"
              strokeWidth="1"
            />
            <line x1="19" y1="5" x2="19" y2="66" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
            <rect x="12" y="68" width="14" height="3.5" rx="1.5" fill="url(#sw3d-hilt)" />
            <rect x="17.2" y="71.5" width="3.6" height="9" rx="1" fill="#065F46" />
          </g>
          {/* Right 3D Jade Immortal Sword */}
          <g transform="rotate(24 100 55)">
            <polygon
              points="97,12 101,2 105,12 103.5,68 98.5,68"
              fill="url(#sw3d-jade)"
              stroke="#ECFDF5"
              strokeWidth="1"
            />
            <line x1="101" y1="5" x2="101" y2="66" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
            <rect x="94" y="68" width="14" height="3.5" rx="1.5" fill="url(#sw3d-hilt)" />
            <rect x="99.2" y="71.5" width="3.6" height="9" rx="1" fill="#065F46" />
          </g>
          {/* Bottom 3D Sculpted Jade Lotus */}
          <path d="M44 98 L54 101 L60 108 L48 106 Z" fill="#059669" stroke="#A7F3D0" strokeWidth="0.9" />
          <path d="M76 98 L66 101 L60 108 L72 106 Z" fill="#059669" stroke="#A7F3D0" strokeWidth="0.9" />
          <path
            d="M60 90 L67 101 L60 109 L53 101 Z"
            fill="url(#sw3d-jade)"
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'shadow-horns':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_12px_rgba(139,92,246,0.8)]"
        >
          <defs>
            <linearGradient id="sh3d-horn" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DDD6FE" />
              <stop offset="40%" stopColor="#7C3AED" />
              <stop offset="80%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#090A0F" />
            </linearGradient>
            <radialGradient id="sh3d-gem" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#581C87" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#sh3d-horn)" strokeWidth="3.5" />
          {/* Left 3D Curved Demon Horn */}
          <path
            d="M29 31 C14 23, 6 6, 19 1 C17 12, 26 20, 39 24 Z"
            fill="url(#sh3d-horn)"
            stroke="#C4B5FD"
            strokeWidth="1.5"
          />
          {/* Right 3D Curved Demon Horn */}
          <path
            d="M91 31 C106 23, 114 6, 101 1 C103 12, 94 20, 81 24 Z"
            fill="url(#sh3d-horn)"
            stroke="#C4B5FD"
            strokeWidth="1.5"
          />
          {/* Top 3D Abyssal Eye Crystal */}
          <polygon
            points="60,5 66,15 60,25 54,15"
            fill="url(#sh3d-gem)"
            stroke="#F3E8FF"
            strokeWidth="1.3"
          />
          <polygon points="60,8 63,13 60,16 58,12" fill="#FFFFFF" opacity="0.8" />
          {/* Bottom 3D Shadow Spikes */}
          <polygon points="45,98 51,109 56,100" fill="url(#sh3d-horn)" stroke="#A855F7" strokeWidth="1" />
          <polygon points="56,99 60,112 64,99" fill="url(#sh3d-gem)" stroke="#F3E8FF" strokeWidth="1" />
          <polygon points="75,98 69,109 64,100" fill="url(#sh3d-horn)" stroke="#A855F7" strokeWidth="1" />
        </svg>
      );

    case 'cyber-visor':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_2px_10px_rgba(6,182,212,0.75)]"
        >
          <defs>
            <linearGradient id="cy3d-armor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ECFEFF" />
              <stop offset="40%" stopColor="#22D3EE" />
              <stop offset="80%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke="url(#cy3d-armor)"
            strokeWidth="3.2"
            strokeDasharray="26 6 8 6"
          />
          {/* Top 3D Mecha Visor Shield */}
          <path
            d="M30 25 L45 12 L75 12 L90 25 L79 29 L60 22 L41 29 Z"
            fill="url(#cy3d-armor)"
            stroke="#CFFAFE"
            strokeWidth="1.5"
          />
          <path d="M46 15 L74 15 L68 19 L52 19 Z" fill="#FFFFFF" opacity="0.75" />
          {/* Side 3D Mecha Fins */}
          <polygon
            points="12,54 6,30 18,41 18,68 12,68"
            fill="url(#cy3d-armor)"
            stroke="#CFFAFE"
            strokeWidth="1.1"
          />
          <polygon
            points="108,54 114,30 102,41 102,68 108,68"
            fill="url(#cy3d-armor)"
            stroke="#CFFAFE"
            strokeWidth="1.1"
          />
          {/* Bottom 3D Core Reactor */}
          <rect
            x="49"
            y="97"
            width="22"
            height="7"
            rx="3.5"
            fill="url(#cy3d-armor)"
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
        </svg>
      );

    case 'frost-crown':
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(103,232,249,0.7)]"
        >
          <defs>
            <linearGradient id="fr3d-ice" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#A5F3FC" />
              <stop offset="80%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#fr3d-ice)" strokeWidth="3.2" />
          {/* 3D Faceted Ice Crown Spires */}
          <polygon points="60,1 66,18 60,24 54,18" fill="url(#fr3d-ice)" stroke="#FFFFFF" strokeWidth="1.3" />
          <polygon points="44,8 51,21 46,26 40,18" fill="url(#fr3d-ice)" stroke="#E0F2FE" strokeWidth="1.1" />
          <polygon points="76,8 69,21 74,26 80,18" fill="url(#fr3d-ice)" stroke="#E0F2FE" strokeWidth="1.1" />
          <polygon points="31,18 40,26 35,31 28,25" fill="url(#fr3d-ice)" stroke="#BAE6FD" strokeWidth="1" />
          <polygon points="89,18 80,26 85,31 92,25" fill="url(#fr3d-ice)" stroke="#BAE6FD" strokeWidth="1" />
          {/* Bottom 3D Glacial Diamond */}
          <polygon points="60,94 66,103 60,112 54,103" fill="url(#fr3d-ice)" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
      );

    case 'astral-orbit':
    default:
      return (
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_12px_rgba(129,140,248,0.75)]"
        >
          <defs>
            <linearGradient id="as3d-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <radialGradient id="as3d-star" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#D97706" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="41.5" fill="none" stroke="url(#as3d-ring)" strokeWidth="3" />
          {/* 3D Tilted Planetary Ring */}
          <ellipse
            cx="60"
            cy="60"
            rx="51"
            ry="16"
            transform="rotate(-24 60 60)"
            fill="none"
            stroke="url(#as3d-ring)"
            strokeWidth="2.8"
          />
          {/* 3D Star & Orbiting Planets */}
          <path
            d="M60 3 L63 11 L71 14 L63 17 L60 25 L57 17 L49 14 L57 11 Z"
            fill="url(#as3d-star)"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
          <circle cx="15" cy="42" r="4.5" fill="url(#as3d-ring)" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="105" cy="78" r="4.5" fill="url(#as3d-star)" stroke="#FFFFFF" strokeWidth="1" />
        </svg>
      );
  }
}
