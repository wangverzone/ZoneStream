import React from 'react';

export interface CountryInfo {
  code: string;
  name: string;
}

export const COUNTRY_LIST: CountryInfo[] = [
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapura' },
  { code: 'JP', name: 'Jepang' },
  { code: 'CN', name: 'Tiongkok' },
  { code: 'KR', name: 'Korea Selatan' },
  { code: 'PH', name: 'Filipina' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'TL', name: 'Timor Leste' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'Amerika Serikat' },
  { code: 'GB', name: 'Inggris' },
  { code: 'SA', name: 'Arab Saudi' },
  { code: 'AE', name: 'Uni Emirat Arab' },
  { code: 'DE', name: 'Jerman' },
  { code: 'FR', name: 'Prancis' },
  { code: 'NL', name: 'Belanda' },
  { code: 'BR', name: 'Brasil' },
  { code: 'IN', name: 'India' },
];

const COUNTRY_NAME_MAP = new Map<string, string>(
  COUNTRY_LIST.map((c) => [c.code.toUpperCase(), c.name])
);

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Ujung_Pandang': 'ID',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Harbin': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Seoul': 'KR',
  'Asia/Manila': 'PH',
  'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Brunei': 'BN',
  'Asia/Dili': 'TL',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Kolkata': 'IN',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Amsterdam': 'NL',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
  'America/Sao_Paulo': 'BR',
};

export function detectClientCountryCode(): string {
  try {
    const cached = localStorage.getItem('zonestream_user_country_v1');
    if (cached && /^[A-Z]{2}$/.test(cached)) {
      return cached;
    }
  } catch {
    // ignore
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
      return TIMEZONE_COUNTRY_MAP[tz];
    }
    const lang = (navigator.language || '').toUpperCase();
    if (lang.includes('-')) {
      const region = lang.split('-')[1];
      if (region && /^[A-Z]{2}$/.test(region)) {
        // Default US browser locale in Indonesian timezone still maps to ID above;
        // if region is ID/MY/SG/JP etc., return it
        if (region !== 'US') return region;
      }
    }
    if (lang.startsWith('ID')) return 'ID';
    if (lang.startsWith('MS')) return 'MY';
    if (lang.startsWith('JA')) return 'JP';
    if (lang.startsWith('ZH')) return 'CN';
  } catch {
    // ignore
  }
  return 'ID';
}

export function getCountryName(code?: string): string {
  const clean = String(code || 'ID').trim().toUpperCase();
  return COUNTRY_NAME_MAP.get(clean) || clean || 'Indonesia';
}

function InlineFlagSvg({ code }: { code: string }) {
  switch (code) {
    case 'ID':
      return (
        <svg viewBox="0 0 24 16" className="w-full h-full block">
          <rect width="24" height="8" y="0" fill="#EF4444" />
          <rect width="24" height="8" y="8" fill="#FFFFFF" />
        </svg>
      );
    case 'JP':
      return (
        <svg viewBox="0 0 24 16" className="w-full h-full block">
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="4.5" fill="#BC002D" />
        </svg>
      );
    default:
      return null;
  }
}

export function CountryFlagBadge({
  countryCode,
  showName = false,
  size = 'sm',
  className = '',
}: {
  countryCode?: string;
  showName?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const code = String(countryCode || detectClientCountryCode() || 'ID')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const validCode = /^[A-Z]{2}$/.test(code) ? code : 'ID';
  const name = getCountryName(validCode);
  const [imgError, setImgError] = React.useState(false);

  const dims =
    size === 'xs'
      ? 'w-4 h-3 rounded-[3px]'
      : size === 'md'
      ? 'w-5 h-3.5 rounded-[4px]'
      : 'w-[18px] h-[13px] rounded-[3px]';

  const useInline = validCode === 'ID' || validCode === 'JP' || imgError;

  return (
    <span
      title={`Lokasi: ${name} (${validCode})`}
      className={`inline-flex items-center gap-1.5 shrink-0 select-none ${className}`}
    >
      <span
        className={`inline-flex overflow-hidden border border-black/15 dark:border-white/25 shadow-sm shrink-0 ${dims}`}
      >
        {useInline ? (
          <InlineFlagSvg code={validCode} />
        ) : (
          <img
            src={`https://flagcdn.com/w40/${validCode.toLowerCase()}.png`}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover block"
          />
        )}
      </span>
      {showName && (
        <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300">
          {name}
        </span>
      )}
    </span>
  );
}
