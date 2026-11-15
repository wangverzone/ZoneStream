import React from 'react';

export const FREE_EMOJIS = ['🔥', '❤️', '😭', '🤯', '👏', '⚔️', '✨', '😂', '🙏', '👀'];

export interface VipEmojiDef {
  id: string;
  label: string;
  subtitle: string;
  token: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

function make3DEmojiIcon(id: string): React.ComponentType<{ className?: string }> {
  return function Emoji3DIcon({ className = 'w-5 h-5' }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 48 48"
        className={`${className} overflow-visible select-none shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`g3d-gold-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id={`g3d-fire-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="38%" stopColor="#FB923C" />
            <stop offset="75%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <linearGradient id={`g3d-cyan-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#67E8F9" />
            <stop offset="75%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id={`g3d-purple-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5F3FF" />
            <stop offset="35%" stopColor="#C084FC" />
            <stop offset="75%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#3B0764" />
          </linearGradient>
          <linearGradient id={`g3d-jade-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ECFDF5" />
            <stop offset="35%" stopColor="#6EE7B7" />
            <stop offset="75%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>
          <linearGradient id={`g3d-pink-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF1F2" />
            <stop offset="35%" stopColor="#F472B6" />
            <stop offset="75%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#831843" />
          </linearGradient>
        </defs>

        {id === 'infinity-dao' && (
          <g>
            {/* 3D Shadow Loop */}
            <path
              d="M14 27 C8 27, 5 22, 8 18 C11 14, 17 16, 24 23 C31 30, 37 32, 40 28 C43 24, 40 19, 34 19 C29 19, 26 22, 24 24 C22 26, 19 27, 14 27 Z"
              fill="none"
              stroke="#78350F"
              strokeWidth="7.5"
              strokeLinecap="round"
              transform="translate(0, 2)"
              opacity="0.6"
            />
            {/* 3D Golden Infinity Ribbon */}
            <path
              d="M14 29 C7 29, 4 24, 4 19 C4 14, 9 11, 15 14 C19 16, 22 20, 24 22 C26 24, 29 28, 33 30 C39 33, 44 30, 44 25 C44 20, 41 15, 34 15 C28 15, 25 19, 24 21 C23 23, 20 29, 14 29 Z"
              fill="none"
              stroke={`url(#g3d-gold-${id})`}
              strokeWidth="6.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Specular 3D Top Highlight */}
            <path
              d="M8 17 C10 14, 14 14, 18 17 M31 17 C35 15, 39 16, 41 19"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Center Floating Core Diamond */}
            <polygon points="24,6 27,11 24,16 21,11" fill={`url(#g3d-fire-${id})`} stroke="#FEF08A" strokeWidth="1" />
          </g>
        )}

        {id === 'immortal-crown' && (
          <g>
            <path
              d="M7 36 L11 16 L19 24 L24 10 L29 24 L37 16 L41 36 Z"
              fill="#78350F"
              transform="translate(0, 2.5)"
              opacity="0.6"
            />
            <path
              d="M7 35 L10 15 L18.5 23.5 L24 9 L29.5 23.5 L38 15 L41 35 Z"
              fill={`url(#g3d-gold-${id})`}
              stroke="#FEF08A"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <rect x="7" y="34" width="34" height="6" rx="3" fill={`url(#g3d-fire-${id})`} stroke="#FEF08A" strokeWidth="1.2" />
            <polygon points="24,18 27.5,24 24,30 20.5,24" fill={`url(#g3d-pink-${id})`} stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="10" cy="12" r="3" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="0.9" />
            <circle cx="24" cy="6.5" r="3.5" fill={`url(#g3d-gold-${id})`} stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="38" cy="12" r="3" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="0.9" />
          </g>
        )}

        {id === 'founder-flame' && (
          <g>
            <path
              d="M25 4 C33 13, 41 21, 39 32 C37 40, 31 45, 24 45 C16 45, 9 39, 9 30 C9 22, 14 16, 17 12 C17 17, 20 19, 22 19 C19 13, 21 7, 25 4 Z"
              fill={`url(#g3d-fire-${id})`}
              stroke="#FEF08A"
              strokeWidth="1.4"
            />
            <path
              d="M24 17 C29 22, 33 27, 31 34 C30 39, 27 42, 24 42 C20 42, 16 38, 17 32 C18 26, 21 22, 24 17 Z"
              fill={`url(#g3d-gold-${id})`}
            />
            <ellipse cx="23.5" cy="34.5" rx="3.5" ry="5" fill="#FFFFFF" opacity="0.9" />
          </g>
        )}

        {id === 'celestial-sword' && (
          <g>
            {/* Crossed 3D Swords */}
            <g transform="rotate(-36 24 24)">
              <polygon points="21,5 24,1 27,5 26,32 22,32" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="1.2" />
              <rect x="16" y="32" width="16" height="4" rx="2" fill={`url(#g3d-gold-${id})`} />
              <rect x="22" y="36" width="4" height="9" rx="1.5" fill="#1E3A8A" />
            </g>
            <g transform="rotate(36 24 24)">
              <polygon points="21,5 24,1 27,5 26,32 22,32" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="1.2" />
              <rect x="16" y="32" width="16" height="4" rx="2" fill={`url(#g3d-gold-${id})`} />
              <rect x="22" y="36" width="4" height="9" rx="1.5" fill="#1E3A8A" />
            </g>
            <polygon points="24,17 28,24 24,31 20,24" fill={`url(#g3d-gold-${id})`} stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        )}

        {id === 'thunder-tribulation' && (
          <g>
            <circle cx="24" cy="24" r="18" fill={`url(#g3d-purple-${id})`} opacity="0.3" />
            <polygon
              points="28,3 11,26 23,26 18,45 38,20 26,20"
              fill="#4C1D95"
              transform="translate(1.5, 2)"
              opacity="0.65"
            />
            <polygon
              points="28,3 11,26 23,26 18,45 38,20 26,20"
              fill={`url(#g3d-gold-${id})`}
              stroke="#F3E8FF"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <polygon points="26,8 16,23 23,23 21,34 32,21 25,21" fill="#FFFFFF" opacity="0.7" />
          </g>
        )}

        {id === 'jade-lotus' && (
          <g>
            <polygon
              points="24,4 41,17 34,42 14,42 7,17"
              fill={`url(#g3d-jade-${id})`}
              stroke="#A7F3D0"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <polygon points="24,4 34,17 24,29 14,17" fill="#6EE7B7" opacity="0.75" />
            <polygon points="24,7 30,16 24,22 18,16" fill="#FFFFFF" opacity="0.85" />
            <line x1="7" y1="17" x2="41" y2="17" stroke="#ECFDF5" strokeWidth="1.2" opacity="0.7" />
          </g>
        )}

        {id === 'golden-star' && (
          <g>
            <polygon
              points="24,3 30,16 44,18 33.5,28 36.5,42 24,35 11.5,42 14.5,28 4,18 18,16"
              fill="#78350F"
              transform="translate(0, 2.5)"
              opacity="0.55"
            />
            <polygon
              points="24,3 30,16 44,18 33.5,28 36.5,42 24,35 11.5,42 14.5,28 4,18 18,16"
              fill={`url(#g3d-gold-${id})`}
              stroke="#FEF9C3"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <polygon points="24,8 27.5,16 35,17 29,22 24,19 19,22 13,17 20.5,16" fill="#FFFFFF" opacity="0.7" />
          </g>
        )}

        {id === 'guardian-shield' && (
          <g>
            <path
              d="M24 4 L40 10 V23 C40 34, 32 41, 24 45 C16 41, 8 34, 8 23 V10 Z"
              fill={`url(#g3d-cyan-${id})`}
              stroke={`url(#g3d-gold-${id})`}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M24 9 L35 13.5 V22.5 C35 30.5, 29.5 36, 24 39.5 C18.5 36, 13 30.5, 13 22.5 V13.5 Z"
              fill="#0F172A"
              opacity="0.45"
            />
            <polygon points="24,13 29,23 24,33 19,23" fill={`url(#g3d-gold-${id})`} stroke="#FFFFFF" strokeWidth="1" />
          </g>
        )}

        {id === 'dao-spark' && (
          <g>
            <path
              d="M24 2 L28.5 17.5 L44 22 L28.5 26.5 L24 42 L19.5 26.5 L4 22 L19.5 17.5 Z"
              fill={`url(#g3d-pink-${id})`}
              stroke="#FCE7F3"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="22" r="5" fill="#FFFFFF" />
            <path d="M38 6 L39.5 10.5 L44 12 L39.5 13.5 L38 18 L36.5 13.5 L32 12 L36.5 10.5 Z" fill={`url(#g3d-gold-${id})`} />
            <path d="M11 32 L12.2 35.5 L16 37 L12.2 38.5 L11 42 L9.8 38.5 L6 37 L9.8 35.5 Z" fill={`url(#g3d-cyan-${id})`} />
          </g>
        )}

        {id === 'cosmos-atom' && (
          <g>
            <ellipse
              cx="24"
              cy="24"
              rx="20"
              ry="8"
              transform="rotate(30 24 24)"
              fill="none"
              stroke={`url(#g3d-cyan-${id})`}
              strokeWidth="2.8"
            />
            <ellipse
              cx="24"
              cy="24"
              rx="20"
              ry="8"
              transform="rotate(-30 24 24)"
              fill="none"
              stroke={`url(#g3d-purple-${id})`}
              strokeWidth="2.8"
            />
            <ellipse
              cx="24"
              cy="24"
              rx="20"
              ry="8"
              transform="rotate(90 24 24)"
              fill="none"
              stroke={`url(#g3d-gold-${id})`}
              strokeWidth="2.2"
            />
            <circle cx="24" cy="24" r="6.5" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="22" cy="22" r="2" fill="#FFFFFF" />
          </g>
        )}

        {id === 'phantom-ghost' && (
          <g>
            <path
              d="M11 24 C11 12, 17 6, 24 6 C31 6, 37 12, 37 24 V41 L32 36 L27 41 L24 37 L21 41 L16 36 L11 41 Z"
              fill={`url(#g3d-purple-${id})`}
              stroke="#E9D5FF"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <ellipse cx="18" cy="14" rx="5" ry="3" transform="rotate(-25 18 14)" fill="#FFFFFF" opacity="0.45" />
            <circle cx="19" cy="23" r="3" fill="#FEF08A" />
            <circle cx="29" cy="23" r="3" fill="#FEF08A" />
            <circle cx="19" cy="23" r="1.2" fill="#E11D48" />
            <circle cx="29" cy="23" r="1.2" fill="#E11D48" />
          </g>
        )}

        {id === 'rocket-boost' && (
          <g>
            <path d="M14 34 L8 42 L18 39 Z" fill={`url(#g3d-fire-${id})`} />
            <path
              d="M39 9 C31 9, 21 14, 15 22 L10 23 L14 29 L19 34 L25 38 L26 33 C34 27, 39 17, 39 9 Z"
              fill={`url(#g3d-purple-${id})`}
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="28" cy="20" r="4.5" fill={`url(#g3d-cyan-${id})`} stroke="#FFFFFF" strokeWidth="1.4" />
          </g>
        )}

        {id === 'royal-heart' && (
          <g>
            <path
              d="M24 41 C24 41, 6 29, 6 16.5 C6 10.5, 11 6.5, 16.5 6.5 C20.2 6.5, 22.8 8.5, 24 11 C25.2 8.5, 27.8 6.5, 31.5 6.5 C37 6.5, 42 10.5, 42 16.5 C42 29, 24 41, 24 41 Z"
              fill={`url(#g3d-pink-${id})`}
              stroke={`url(#g3d-gold-${id})`}
              strokeWidth="2"
            />
            <ellipse cx="15" cy="14" rx="4.5" ry="2.5" transform="rotate(-25 15 14)" fill="#FFFFFF" opacity="0.7" />
          </g>
        )}

        {id === 'crescent-moon' && (
          <g>
            <path
              d="M31 7 C20 8, 11 17, 11 28 C11 37, 18 43, 28 43 C34 43, 39 40, 41 36 C33 37, 25 31, 25 22 C25 15, 28 10, 31 7 Z"
              fill={`url(#g3d-gold-${id})`}
              stroke="#FEF9C3"
              strokeWidth="1.5"
            />
            <polygon points="35,11 37,16 42,18 37,20 35,25 33,20 28,18 33,16" fill={`url(#g3d-cyan-${id})`} />
          </g>
        )}

        {id === 'solar-eclipse' && (
          <g>
            <circle cx="24" cy="24" r="19" fill={`url(#g3d-fire-${id})`} opacity="0.35" />
            <circle cx="24" cy="24" r="13.5" fill={`url(#g3d-gold-${id})`} stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="19.5" cy="19.5" r="4" fill="#FFFFFF" opacity="0.65" />
          </g>
        )}

        {id === 'mystic-eye' && (
          <g>
            <path
              d="M4 24 C10 13, 17 9, 24 9 C31 9, 38 13, 44 24 C38 35, 31 39, 24 39 C17 39, 10 35, 4 24 Z"
              fill={`url(#g3d-cyan-${id})`}
              stroke={`url(#g3d-gold-${id})`}
              strokeWidth="2"
            />
            <circle cx="24" cy="24" r="8" fill={`url(#g3d-purple-${id})`} stroke="#FFFFFF" strokeWidth="1.4" />
            <circle cx="24" cy="24" r="3.5" fill="#FEF08A" />
            <circle cx="21.5" cy="21.5" r="2" fill="#FFFFFF" />
          </g>
        )}
      </svg>
    );
  };
}

export const VIP_EMOJIS: VipEmojiDef[] = [
  {
    id: 'infinity-dao',
    label: 'Tak Terbatas',
    subtitle: 'Emblem 3D Sovereign Infinity',
    token: '[vip:infinity-dao]',
    bgClass: 'bg-gradient-to-br from-amber-500/30 via-[#E84A18]/25 to-amber-950/40',
    textClass: 'text-amber-500 dark:text-amber-300',
    borderClass: 'border-amber-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(245,158,11,0.45)',
    icon: make3DEmojiIcon('infinity-dao'),
  },
  {
    id: 'immortal-crown',
    label: 'Immortal',
    subtitle: 'Mahkota Kaisar 3D Berkilau',
    token: '[vip:immortal-crown]',
    bgClass: 'bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-amber-950/40',
    textClass: 'text-amber-600 dark:text-amber-300',
    borderClass: 'border-amber-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(234,179,8,0.45)',
    icon: make3DEmojiIcon('immortal-crown'),
  },
  {
    id: 'founder-flame',
    label: 'Dragon Flame',
    subtitle: 'Api Naga Samadhi 3D',
    token: '[vip:founder-flame]',
    bgClass: 'bg-gradient-to-br from-[#E84A18]/35 via-rose-500/25 to-red-950/40',
    textClass: 'text-[#E84A18] dark:text-[#FF8559]',
    borderClass: 'border-[#E84A18]/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(232,74,24,0.45)',
    icon: make3DEmojiIcon('founder-flame'),
  },
  {
    id: 'celestial-sword',
    label: 'Heavenly Sword',
    subtitle: 'Pedang Langit 3D Silang',
    token: '[vip:celestial-sword]',
    bgClass: 'bg-gradient-to-br from-sky-400/30 via-cyan-500/20 to-blue-950/40',
    textClass: 'text-sky-600 dark:text-sky-300',
    borderClass: 'border-sky-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(56,189,248,0.45)',
    icon: make3DEmojiIcon('celestial-sword'),
  },
  {
    id: 'thunder-tribulation',
    label: 'Petir VIP',
    subtitle: 'Halilintar Ungu Emas 3D',
    token: '[vip:thunder-tribulation]',
    bgClass: 'bg-gradient-to-br from-violet-500/35 via-purple-600/20 to-indigo-950/40',
    textClass: 'text-violet-600 dark:text-violet-300',
    borderClass: 'border-violet-400/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(168,85,247,0.45)',
    icon: make3DEmojiIcon('thunder-tribulation'),
  },
  {
    id: 'jade-lotus',
    label: 'Permata Giok',
    subtitle: 'Kristal Giok Abadi 3D',
    token: '[vip:jade-lotus]',
    bgClass: 'bg-gradient-to-br from-emerald-400/30 via-teal-500/20 to-emerald-950/40',
    textClass: 'text-emerald-600 dark:text-emerald-300',
    borderClass: 'border-emerald-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(16,185,129,0.45)',
    icon: make3DEmojiIcon('jade-lotus'),
  },
  {
    id: 'golden-star',
    label: 'Bintang VIP',
    subtitle: 'Bintang Emas 3D',
    token: '[vip:golden-star]',
    bgClass: 'bg-gradient-to-br from-yellow-400/30 via-amber-500/20 to-yellow-950/40',
    textClass: 'text-yellow-600 dark:text-yellow-300',
    borderClass: 'border-yellow-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(250,204,21,0.45)',
    icon: make3DEmojiIcon('golden-star'),
  },
  {
    id: 'guardian-shield',
    label: 'Perisai Sekte',
    subtitle: 'Perisai Pelindung 3D',
    token: '[vip:guardian-shield]',
    bgClass: 'bg-gradient-to-br from-blue-400/30 via-indigo-500/20 to-slate-950/40',
    textClass: 'text-blue-600 dark:text-blue-300',
    borderClass: 'border-blue-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(59,130,246,0.45)',
    icon: make3DEmojiIcon('guardian-shield'),
  },
  {
    id: 'dao-spark',
    label: 'Kilau Dao',
    subtitle: 'Bintang Prisma 3D',
    token: '[vip:dao-spark]',
    bgClass: 'bg-gradient-to-br from-pink-400/30 via-rose-500/20 to-pink-950/40',
    textClass: 'text-pink-600 dark:text-pink-300',
    borderClass: 'border-pink-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(244,114,182,0.45)',
    icon: make3DEmojiIcon('dao-spark'),
  },
  {
    id: 'cosmos-atom',
    label: 'Kosmik Atom',
    subtitle: 'Inti Kosmik 3D',
    token: '[vip:cosmos-atom]',
    bgClass: 'bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-cyan-950/40',
    textClass: 'text-cyan-600 dark:text-cyan-300',
    borderClass: 'border-cyan-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(6,182,212,0.45)',
    icon: make3DEmojiIcon('cosmos-atom'),
  },
  {
    id: 'phantom-ghost',
    label: 'Bayangan',
    subtitle: 'Roh Shadow Monarch 3D',
    token: '[vip:phantom-ghost]',
    bgClass: 'bg-gradient-to-br from-purple-400/30 via-fuchsia-500/20 to-purple-950/40',
    textClass: 'text-purple-600 dark:text-purple-300',
    borderClass: 'border-purple-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(168,85,247,0.45)',
    icon: make3DEmojiIcon('phantom-ghost'),
  },
  {
    id: 'rocket-boost',
    label: 'Nitro Boost',
    subtitle: 'Roket Turbo Nitro 3D',
    token: '[vip:rocket-boost]',
    bgClass: 'bg-gradient-to-br from-indigo-400/30 via-fuchsia-500/20 to-indigo-950/40',
    textClass: 'text-indigo-600 dark:text-indigo-300',
    borderClass: 'border-indigo-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(99,102,241,0.45)',
    icon: make3DEmojiIcon('rocket-boost'),
  },
  {
    id: 'royal-heart',
    label: 'Hati VIP',
    subtitle: 'Permata Hati 3D',
    token: '[vip:royal-heart]',
    bgClass: 'bg-gradient-to-br from-rose-400/30 via-pink-500/20 to-rose-950/40',
    textClass: 'text-rose-600 dark:text-rose-300',
    borderClass: 'border-rose-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(244,63,94,0.45)',
    icon: make3DEmojiIcon('royal-heart'),
  },
  {
    id: 'crescent-moon',
    label: 'Bulan Sabit',
    subtitle: 'Bulan Sabit Emas 3D',
    token: '[vip:crescent-moon]',
    bgClass: 'bg-gradient-to-br from-sky-400/25 via-indigo-500/20 to-slate-950/40',
    textClass: 'text-indigo-600 dark:text-sky-200',
    borderClass: 'border-sky-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(56,189,248,0.45)',
    icon: make3DEmojiIcon('crescent-moon'),
  },
  {
    id: 'solar-eclipse',
    label: 'Matahari',
    subtitle: 'Inti Surya 3D',
    token: '[vip:solar-eclipse]',
    bgClass: 'bg-gradient-to-br from-orange-400/30 via-yellow-500/20 to-orange-950/40',
    textClass: 'text-orange-600 dark:text-orange-300',
    borderClass: 'border-orange-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(249,115,22,0.45)',
    icon: make3DEmojiIcon('solar-eclipse'),
  },
  {
    id: 'mystic-eye',
    label: 'Mata Dewa',
    subtitle: 'Mata Langit 3D',
    token: '[vip:mystic-eye]',
    bgClass: 'bg-gradient-to-br from-teal-400/30 via-cyan-500/20 to-teal-950/40',
    textClass: 'text-teal-600 dark:text-teal-300',
    borderClass: 'border-teal-400/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]',
    glowColor: 'rgba(20,184,166,0.45)',
    icon: make3DEmojiIcon('mystic-eye'),
  },
];

export const VIP_EMOJI_MAP = new Map(VIP_EMOJIS.map((v) => [v.id, v]));

export function StatusEmojiBadge({
  statusEmoji: _statusEmoji,
  size: _size = 'sm',
}: {
  statusEmoji?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  // Sesuai referensi UI terbaru: di samping nama user cukup tampilkan 1 Lencana Verified 8-sudut yang bersih tanpa ikon tambahan di sebelahnya
  return null;
}

export function VipStickerCard({ stickerId }: { stickerId: string }) {
  const def = VIP_EMOJI_MAP.get(stickerId);
  if (!def) return null;
  const Icon = def.icon;
  return (
    <div
      className={`mt-2 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border ${def.bgClass} ${def.borderClass} shadow-md`}
    >
      <Icon className="w-8 h-8" />
      <div className="leading-tight">
        <p className={`text-xs font-extrabold ${def.textClass}`}>{def.label}</p>
        <p className="text-[10px] text-slate-500 dark:text-gray-300">{def.subtitle}</p>
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
        title={`${def.label} (Emoji 3D VIP)`}
        className={`inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-lg border align-middle text-[11px] font-bold shadow-sm ${def.bgClass} ${def.textClass} ${def.borderClass}`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{def.label}</span>
      </span>
    );
  });
}
