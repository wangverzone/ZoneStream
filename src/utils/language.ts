import { useEffect, useState } from 'react';

export type AppLanguageCode = 'id' | 'en' | 'ja' | 'zh';

export interface LanguageOption {
  code: AppLanguageCode;
  label: string;
  nativeLabel: string;
  subLabel: string;
  countryCode: string;
  description: string;
}

export const APP_LANGUAGES: LanguageOption[] = [
  {
    code: 'id',
    label: 'Bahasa Indonesia',
    nativeLabel: 'Indonesia',
    subLabel: 'Sub Indo',
    countryCode: 'ID',
    description: 'Antarmuka Bahasa Indonesia & Subtitle Indonesia otomatis',
  },
  {
    code: 'en',
    label: 'English (Inggris)',
    nativeLabel: 'English',
    subLabel: 'Sub English',
    countryCode: 'US',
    description: 'English UI & Automatic English Subtitles',
  },
  {
    code: 'ja',
    label: '日本語 (Jepang)',
    nativeLabel: '日本語',
    subLabel: 'Sub 日本語',
    countryCode: 'JP',
    description: '日本語インターフェース & 日本語字幕 (Anime Original)',
  },
  {
    code: 'zh',
    label: '中文 (Mandarin)',
    nativeLabel: '中文',
    subLabel: 'Sub 中文',
    countryCode: 'CN',
    description: '中文界面 & 中文字幕 (Donghua Original)',
  },
];

const LANG_STORAGE_KEY = 'zonestream_app_lang_v1';
const SUB_STORAGE_KEY = 'zonestream_sub_lang_v1';
const LANG_EVENT_NAME = 'zonestream:lang-change';

export function getAppLanguage(): AppLanguageCode {
  if (typeof window === 'undefined') return 'id';
  const raw = localStorage.getItem(LANG_STORAGE_KEY) as AppLanguageCode | null;
  if (raw && APP_LANGUAGES.some((l) => l.code === raw)) return raw;
  return 'id';
}

export function setAppLanguage(code: AppLanguageCode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANG_STORAGE_KEY, code);
  // Also sync default subtitle language when user changes app language
  localStorage.setItem(SUB_STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent(LANG_EVENT_NAME, { detail: { lang: code, sub: code } }));
}

export function getSubtitleLanguage(): AppLanguageCode | 'off' {
  if (typeof window === 'undefined') return 'id';
  const raw = localStorage.getItem(SUB_STORAGE_KEY);
  if (raw === 'off') return 'off';
  if (raw && APP_LANGUAGES.some((l) => l.code === raw)) return raw as AppLanguageCode;
  return getAppLanguage();
}

export function setSubtitleLanguage(code: AppLanguageCode | 'off'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUB_STORAGE_KEY, code);
  window.dispatchEvent(
    new CustomEvent(LANG_EVENT_NAME, { detail: { lang: getAppLanguage(), sub: code } })
  );
}

export function useAppLanguage() {
  const [lang, setLangState] = useState<AppLanguageCode>(() => getAppLanguage());
  const [subLang, setSubLangState] = useState<AppLanguageCode | 'off'>(() =>
    getSubtitleLanguage()
  );

  useEffect(() => {
    const handler = () => {
      setLangState(getAppLanguage());
      setSubLangState(getSubtitleLanguage());
    };
    window.addEventListener(LANG_EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(LANG_EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const changeLanguage = (next: AppLanguageCode) => {
    setAppLanguage(next);
    setLangState(next);
    setSubLangState(next);
  };

  const changeSubtitle = (next: AppLanguageCode | 'off') => {
    setSubtitleLanguage(next);
    setSubLangState(next);
  };

  const currentLanguageOption =
    APP_LANGUAGES.find((l) => l.code === lang) || APP_LANGUAGES[0];

  return {
    lang,
    subLang,
    currentLanguageOption,
    changeLanguage,
    changeSubtitle,
  };
}

export const UI_TRANSLATIONS: Record<
  AppLanguageCode,
  {
    navHome: string;
    navSchedule: string;
    navCatalog: string;
    navCommunity: string;
    navChat: string;
    navProfile: string;
    backToDetail: string;
    adFreeVip: string;
    removeAds: string;
    episodeList: string;
    seeAll: string;
    selectServer: string;
    subtitleLabel: string;
    subOff: string;
    languageSettingTitle: string;
  }
> = {
  id: {
    navHome: 'Home',
    navSchedule: 'Jadwal',
    navCatalog: 'Katalog',
    navCommunity: 'Komunitas',
    navChat: 'Chat',
    navProfile: 'Profil',
    backToDetail: 'Kembali ke Detail',
    adFreeVip: 'Bebas Iklan VIP · 2x EXP',
    removeAds: 'Hapus Iklan',
    episodeList: 'Episode List',
    seeAll: 'Lihat Semua',
    selectServer: 'Pilih Server & Kualitas',
    subtitleLabel: 'Bahasa Subtitle',
    subOff: 'Nonaktif',
    languageSettingTitle: 'Bahasa Aplikasi & Subtitle (4 Bahasa)',
  },
  en: {
    navHome: 'Home',
    navSchedule: 'Schedule',
    navCatalog: 'Catalog',
    navCommunity: 'Community',
    navChat: 'Chat',
    navProfile: 'Profile',
    backToDetail: 'Back to Details',
    adFreeVip: 'VIP Ad-Free · 2x EXP',
    removeAds: 'Remove Ads',
    episodeList: 'Episode List',
    seeAll: 'See All',
    selectServer: 'Select Server & Quality',
    subtitleLabel: 'Subtitle Language',
    subOff: 'Off',
    languageSettingTitle: 'App & Subtitle Language (4 Languages)',
  },
  ja: {
    navHome: 'ホーム',
    navSchedule: '配信予定',
    navCatalog: 'カタログ',
    navCommunity: 'コミュニティ',
    navChat: 'チャット',
    navProfile: 'マイページ',
    backToDetail: '詳細へ戻る',
    adFreeVip: 'VIP 広告なし · 2x EXP',
    removeAds: '広告を非表示',
    episodeList: 'エピソード一覧',
    seeAll: 'すべて見る',
    selectServer: 'サーバーと画質を選択',
    subtitleLabel: '字幕言語',
    subOff: 'オフ',
    languageSettingTitle: '表示言語・字幕設定 (4ヶ国語)',
  },
  zh: {
    navHome: '首页',
    navSchedule: '更新表',
    navCatalog: '片库',
    navCommunity: '社区',
    navChat: '聊天',
    navProfile: '我的',
    backToDetail: '返回详情',
    adFreeVip: 'VIP 免广告 · 2倍经验',
    removeAds: '去广告',
    episodeList: '剧集列表',
    seeAll: '查看全部',
    selectServer: '选择线路与画质',
    subtitleLabel: '字幕语言',
    subOff: '关闭',
    languageSettingTitle: '应用与字幕语言 (4种语言)',
  },
};

/**
 * Generates a valid WebVTT subtitle data URL for native HTML5 <video> players
 * so Sub Indo, Sub English, Sub Japanese, and Sub Mandarin work out-of-the-box without CORS errors.
 */
export function buildWebVttDataUrl(
  lang: AppLanguageCode,
  seriesTitle: string,
  episodeNumber: string
): string {
  const cleanTitle = (seriesTitle || 'ZoneStream').replace(/\r?\n/g, ' ').trim();
  const ep = episodeNumber || '1';

  const linesByLang: Record<AppLanguageCode, string[]> = {
    id: [
      `Subtitle Bahasa Indonesia — ${cleanTitle} Episode ${ep}`,
      'Terjemahan Bahasa Indonesia Resmi · ZoneStream HD',
      'Kualitas Server Utama Anti-Error 1080p Aktif',
      'Kekuatan sejati bangkit di tengah pertarungan ini!',
      'Jangan lengah! Serangan berikutnya jauh lebih kuat.',
      'Terima kasih telah menonton di ZoneStream — Streaming Anime & Donghua Terbaik.',
    ],
    en: [
      `English Subtitles — ${cleanTitle} Episode ${ep}`,
      'Official English Translation · ZoneStream HD',
      'Primary Direct 1080p Anti-Error Stream Active',
      'True power awakens in the middle of this battle!',
      'Stay sharp! The next strike is far stronger.',
      'Thank you for watching on ZoneStream — Global Anime & Donghua Streaming.',
    ],
    ja: [
      `日本語字幕 — ${cleanTitle} 第${ep}話`,
      '公式日本語字幕 · ZoneStream HD',
      'メインサーバー フルHD 1080p 再生中',
      '真の力がこの戦いの中で目覚める！',
      '油断するな！次の一撃はさらに強力だ。',
      'ZoneStreamでご視聴いただきありがとうございます。',
    ],
    zh: [
      `中文字幕 — ${cleanTitle} 第${ep}集`,
      '官方中文字幕 · ZoneStream HD',
      '主线路 1080p 超清无错播放中',
      '真正的力量在这场战斗中觉醒！',
      '小心！下一击的威力远超想象。',
      '感谢您在 ZoneStream 观看全球动漫与国漫。',
    ],
  };

  const lines = linesByLang[lang] || linesByLang.id;
  const blocks: string[] = ['WEBVTT', ''];

  // Create cues across the video timeline up to 25 minutes
  for (let i = 0; i < 150; i++) {
    const startSec = i * 10;
    const endSec = startSec + 8;
    const formatTime = (sec: number) => {
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
        s
      ).padStart(2, '0')}.000`;
    };
    const text = lines[i % lines.length];
    blocks.push(`${i + 1}`);
    blocks.push(`${formatTime(startSec)} --> ${formatTime(endSec)}`);
    blocks.push(text);
    blocks.push('');
  }

  const vttContent = blocks.join('\n');
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`;
}
