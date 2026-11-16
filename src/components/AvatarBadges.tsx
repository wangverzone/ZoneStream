import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Shield, Trophy, X } from 'lucide-react';

export type TopRankCategory = 'charisma' | 'watchtime' | 'level';

export interface ClanLeaderBadgeInfo {
  isLeader: boolean;
  clanTag?: string;
  clanName?: string;
  clanRank?: number | null;
}

export interface TopRankBadgeInfo {
  rank: number;
  category?: TopRankCategory | null;
}

interface InteractiveAvatarBadgesProps {
  uid?: string;
  ownerName?: string;
  clanLeader?: ClanLeaderBadgeInfo | null;
  topRank?: TopRankBadgeInfo | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  popoverAlign?: 'left' | 'center' | 'right';
  popoverPlacement?: 'top' | 'bottom';
  children: React.ReactNode;
  className?: string;
}

const BADGE_SIZE_MAP: Record<
  NonNullable<InteractiveAvatarBadgesProps['size']>,
  {
    rankBox: string;
    leaderBox: string;
    rankOffset: string;
    leaderOffset: string;
    leaderSingleOffset: string;
  }
> = {
  xs: {
    rankBox: 'w-4 h-4',
    leaderBox: 'w-4 h-4',
    rankOffset: '-top-1 -right-1',
    leaderOffset: '-bottom-1 -right-1',
    leaderSingleOffset: '-top-1 -right-1',
  },
  sm: {
    rankBox: 'w-[18px] h-[18px]',
    leaderBox: 'w-[18px] h-[18px]',
    rankOffset: '-top-1.5 -right-1.5',
    leaderOffset: '-bottom-1.5 -right-1.5',
    leaderSingleOffset: '-top-1.5 -right-1.5',
  },
  md: {
    rankBox: 'w-5 h-5',
    leaderBox: 'w-5 h-5',
    rankOffset: '-top-1.5 -right-1.5',
    leaderOffset: '-bottom-1.5 -right-1.5',
    leaderSingleOffset: '-top-1.5 -right-1.5',
  },
  lg: {
    rankBox: 'w-6 h-6',
    leaderBox: 'w-6 h-6',
    rankOffset: '-top-1.5 -right-1.5',
    leaderOffset: '-bottom-1.5 -right-1.5',
    leaderSingleOffset: '-top-1.5 -right-1.5',
  },
  xl: {
    rankBox: 'w-7 h-7',
    leaderBox: 'w-7 h-7',
    rankOffset: '-top-1.5 -right-1.5',
    leaderOffset: '-top-1.5 -left-1.5',
    leaderSingleOffset: '-top-1.5 -right-1.5',
  },
};

function getCategoryLabel(category?: TopRankCategory | null): string {
  if (category === 'charisma') return 'Top Charisma';
  if (category === 'watchtime') return 'Top Nonton Anime';
  if (category === 'level') return 'Top Level';
  return 'Peringkat Teratas';
}

function getRankTierTitle(rank: number): string {
  if (rank === 1) return 'Juara #1 Peringkat Utama';
  if (rank === 2) return 'Peringkat #2 Vanguard';
  if (rank === 3) return 'Peringkat #3 Ascendant';
  return `Top #${rank} Elit Komunitas`;
}

export function ClanLeaderSvgEmblem({
  className = 'w-full h-full',
  clanTag,
}: {
  className?: string;
  clanTag?: string;
}) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 40 40"
      className={`${className} overflow-visible drop-shadow-[0_2px_6px_rgba(245,158,11,0.6)]`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`cl-gold-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="35%" stopColor="#FCD34D" />
          <stop offset="72%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id={`cl-shield-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="55%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <radialGradient id={`cl-gem-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="45%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#064E3B" />
        </radialGradient>
      </defs>

      {/* Crossed Sovereign Blades Behind Shield */}
      <path
        d="M8 31 L31 8 L33 10 L10 33 Z"
        fill={`url(#cl-gold-${uid})`}
        stroke="#451A03"
        strokeWidth="0.7"
      />
      <path
        d="M32 31 L9 8 L7 10 L30 33 Z"
        fill={`url(#cl-gold-${uid})`}
        stroke="#451A03"
        strokeWidth="0.7"
      />

      {/* Heraldic Shield Frame */}
      <path
        d="M20 6 L32 10.5 V20.5 C32 27.6 26.8 32.8 20 35.5 C13.2 32.8 8 27.6 8 20.5 V10.5 L20 6 Z"
        fill={`url(#cl-shield-${uid})`}
        stroke={`url(#cl-gold-${uid})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Inner Hairline Filigree */}
      <path
        d="M20 9 L29 12.4 V20.2 C29 25.8 25 29.9 20 32.1 C15 29.9 11 25.8 11 20.2 V12.4 L20 9 Z"
        fill="none"
        stroke="#FDE68A"
        strokeWidth="0.75"
        opacity="0.55"
      />

      {/* Crown Apex on Top of Shield */}
      <path
        d="M12.5 11.5 L14 4.5 L17.8 8.2 L20 3.2 L22.2 8.2 L26 4.5 L27.5 11.5 Z"
        fill={`url(#cl-gold-${uid})`}
        stroke="#FFFBEB"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Center Emerald Core or Tag Monogram */}
      {clanTag && clanTag.length <= 4 ? (
        <>
          <circle
            cx="20"
            cy="21"
            r="6.2"
            fill={`url(#cl-gem-${uid})`}
            stroke="#FDE047"
            strokeWidth="1"
          />
          <text
            x="20"
            y="22.8"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize={clanTag.length >= 4 ? '5.1' : '6'}
            fontWeight="800"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="-0.3"
          >
            {clanTag.slice(0, 4)}
          </text>
        </>
      ) : (
        <>
          <polygon
            points="20,14 25.5,20.5 20,27.5 14.5,20.5"
            fill={`url(#cl-gem-${uid})`}
            stroke="#FDE047"
            strokeWidth="1.1"
          />
          <polygon points="20,16 22.3,19.4 20,21 18.2,19" fill="#FFFFFF" opacity="0.75" />
        </>
      )}
    </svg>
  );
}

export function TopRankSvgEmblem({
  rank,
  className = 'w-full h-full',
}: {
  rank: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const isRank1 = rank === 1;
  const isRank2 = rank === 2;
  const isRank3 = rank === 3;

  const palette = isRank1
    ? {
        light: '#FFFBEB',
        mid: '#FACC15',
        deep: '#B45309',
        dark: '#451A03',
        coreTop: '#F59E0B',
        coreBottom: '#78350F',
        shadow: 'rgba(250,204,21,0.7)',
        textColor: '#FFFBEB',
      }
    : isRank2
    ? {
        light: '#F8FAFC',
        mid: '#7DD3FC',
        deep: '#0284C7',
        dark: '#0F172A',
        coreTop: '#38BDF8',
        coreBottom: '#1E3A8A',
        shadow: 'rgba(56,189,248,0.65)',
        textColor: '#F8FAFC',
      }
    : isRank3
    ? {
        light: '#FFE4E6',
        mid: '#FB7185',
        deep: '#BE123C',
        dark: '#4C0519',
        coreTop: '#F43F5E',
        coreBottom: '#881337',
        shadow: 'rgba(244,63,94,0.65)',
        textColor: '#FFF1F2',
      }
    : {
        light: '#E0E7FF',
        mid: '#818CF8',
        deep: '#4338CA',
        dark: '#1E1B4B',
        coreTop: '#4F46E5',
        coreBottom: '#1E1B4B',
        shadow: 'rgba(129,140,248,0.55)',
        textColor: '#EEF2FF',
      };

  const label = rank >= 10 ? String(rank) : `${rank}`;

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      style={{
        overflow: 'visible',
        filter: `drop-shadow(0 2px 5px ${palette.shadow})`,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`tr-rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="40%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.deep} />
        </linearGradient>
        <radialGradient id={`tr-core-${uid}`} cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor={palette.coreTop} />
          <stop offset="100%" stopColor={palette.coreBottom} />
        </radialGradient>
      </defs>

      {/* Tier 1 Sovereign Wings / Tier 2-3 Laurel Crests */}
      {isRank1 ? (
        <>
          <path
            d="M11 23 C4 20, 2 13, 6 9 C8 13, 11 15, 13.5 16.5 Z"
            fill={`url(#tr-rim-${uid})`}
            stroke={palette.dark}
            strokeWidth="0.7"
          />
          <path
            d="M29 23 C36 20, 38 13, 34 9 C32 13, 29 15, 26.5 16.5 Z"
            fill={`url(#tr-rim-${uid})`}
            stroke={palette.dark}
            strokeWidth="0.7"
          />
          <path
            d="M14 10 L16 3.5 L20 7 L24 3.5 L26 10 Z"
            fill={`url(#tr-rim-${uid})`}
            stroke="#FFFBEB"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M10 26 C5 22, 5 14, 10 10 L13 13 C10.5 16, 10.5 21, 13 24 Z"
            fill={`url(#tr-rim-${uid})`}
            opacity="0.9"
          />
          <path
            d="M30 26 C35 22, 35 14, 30 10 L27 13 C29.5 16, 29.5 21, 27 24 Z"
            fill={`url(#tr-rim-${uid})`}
            opacity="0.9"
          />
        </>
      )}

      {/* Faceted Octagonal / Hex Medallion */}
      <polygon
        points="20,6.5 29.5,11 33.5,20.5 29.5,30 20,34.5 10.5,30 6.5,20.5 10.5,11"
        fill={`url(#tr-core-${uid})`}
        stroke={`url(#tr-rim-${uid})`}
        strokeWidth="2.3"
        strokeLinejoin="round"
      />

      {/* Specular Bevel Highlight */}
      <polygon
        points="20,9.5 27.2,13 30.2,20.5 27.2,28 20,31.2 12.8,28 9.8,20.5 12.8,13"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="0.75"
        opacity="0.5"
      />

      {/* Top Diamond Spark */}
      <polygon points="20,9 22,12 20,14.5 18,12" fill="#FFFFFF" opacity="0.85" />

      {/* Crisp Rank Number */}
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fill={palette.textColor}
        fontSize={rank >= 10 ? '11.5' : '13.5'}
        fontWeight="900"
        fontFamily="JetBrains Mono, monospace"
        stroke={palette.dark}
        strokeWidth="0.8"
        paintOrder="stroke"
      >
        {label}
      </text>
    </svg>
  );
}

export function AvatarWithBadges({
  uid,
  ownerName = 'Pengguna',
  clanLeader,
  topRank,
  size = 'md',
  popoverAlign = 'center',
  popoverPlacement = 'top',
  children,
  className = '',
}: InteractiveAvatarBadgesProps) {
  const navigate = useNavigate();
  const [activePopover, setActivePopover] = useState<'leader' | 'rank' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hasLeader = Boolean(clanLeader?.isLeader);
  const hasTopRank = Boolean(topRank && topRank.rank >= 1 && topRank.rank <= 10);
  const dims = BADGE_SIZE_MAP[size] || BADGE_SIZE_MAP.md;

  useEffect(() => {
    if (!activePopover) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover(null);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [activePopover]);

  const alignClass =
    popoverAlign === 'left'
      ? 'left-0'
      : popoverAlign === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  const placementClass =
    popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5';

  const handleToggle = (kind: 'leader' | 'rank') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePopover((prev) => (prev === kind ? null : kind));
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {children}

      {/* Top-Ranking Member Interactive SVG Badge */}
      {hasTopRank && topRank && (
        <button
          type="button"
          onClick={handleToggle('rank')}
          aria-expanded={activePopover === 'rank'}
          aria-label={`${getRankTierTitle(topRank.rank)} — ${getCategoryLabel(topRank.category)}`}
          title={`${getRankTierTitle(topRank.rank)} (${getCategoryLabel(topRank.category)}) — Klik untuk detail`}
          className={`group/badge absolute ${dims.rankOffset} ${dims.rankBox} z-30 flex items-center justify-center rounded-full cursor-pointer transition-transform duration-150 hover:scale-125 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
        >
          {/* Expanded invisible touch hitbox for mobile ergonomics */}
          <span className="absolute -inset-2.5 rounded-full" aria-hidden="true" />
          <TopRankSvgEmblem rank={topRank.rank} className="w-full h-full" />
        </button>
      )}

      {/* Clan Leader Interactive SVG Badge */}
      {hasLeader && clanLeader && (
        <button
          type="button"
          onClick={handleToggle('leader')}
          aria-expanded={activePopover === 'leader'}
          aria-label={`Pemimpin Klan ${clanLeader.clanName || clanLeader.clanTag || ''}`}
          title={`Pemimpin Klan ${clanLeader.clanName || ''}${clanLeader.clanTag ? ` [${clanLeader.clanTag}]` : ''} — Klik untuk detail`}
          className={`group/badge absolute ${
            hasTopRank ? dims.leaderOffset : dims.leaderSingleOffset
          } ${dims.leaderBox} z-30 flex items-center justify-center rounded-full cursor-pointer transition-transform duration-150 hover:scale-125 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        >
          <span className="absolute -inset-2.5 rounded-full" aria-hidden="true" />
          <ClanLeaderSvgEmblem clanTag={clanLeader.clanTag} className="w-full h-full" />
        </button>
      )}

      {/* Interactive Badge Inspector Popover */}
      {activePopover && (
        <div
          role="dialog"
          aria-label="Detail Lencana"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute ${placementClass} ${alignClass} z-50 w-64 rounded-2xl bg-[#131620] border border-white/15 p-3.5 shadow-2xl text-left text-white`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 p-1">
                {activePopover === 'leader' ? (
                  <ClanLeaderSvgEmblem clanTag={clanLeader?.clanTag} className="w-8 h-8" />
                ) : (
                  <TopRankSvgEmblem rank={topRank?.rank || 1} className="w-8 h-8" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-amber-300 truncate">
                  {activePopover === 'leader'
                    ? 'Pemimpin Klan'
                    : getRankTierTitle(topRank?.rank || 1)}
                </p>
                <p className="text-[11px] font-bold text-gray-200 truncate">
                  {ownerName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActivePopover(null);
              }}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Tutup detail lencana"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5 text-[11px] text-gray-300">
            {activePopover === 'leader' && clanLeader ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Klan
                  </span>
                  <span className="font-bold text-white truncate">
                    {clanLeader.clanName || clanLeader.clanTag}{' '}
                    {clanLeader.clanTag ? `[${clanLeader.clanTag}]` : ''}
                  </span>
                </div>
                {clanLeader.clanRank && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Peringkat Klan</span>
                    <span className="font-mono-tabular font-extrabold text-amber-400">
                      #{clanLeader.clanRank}
                    </span>
                  </div>
                )}
              </>
            ) : (
              topRank && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400 inline-flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400" />
                      Kategori
                    </span>
                    <span className="font-bold text-white">
                      {getCategoryLabel(topRank.category)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400">Posisi Aktif</span>
                    <span className="font-mono-tabular font-extrabold text-amber-400">
                      Peringkat #{topRank.rank}
                    </span>
                  </div>
                </>
              )
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {uid && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActivePopover(null);
                  navigate(`/u/${uid}`);
                }}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white text-center inline-flex items-center justify-center gap-1 transition-colors"
              >
                <span>Profil</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActivePopover(null);
                navigate('/leaderboard');
              }}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[11px] font-extrabold text-slate-950 text-center inline-flex items-center justify-center gap-1 transition-colors"
            >
              <span>Peringkat</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
