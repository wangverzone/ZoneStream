import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import celestialPalaceImg from '../assets/images/bg_celestial_palace_1794925701211.jpg';
import cyberRainCityImg from '../assets/images/bg_cyber_rain_city_1794925702075.jpg';
import sakuraShrineImg from '../assets/images/bg_sakura_shrine_night_1794925700466.jpg';
import mechaBannerImg from '../assets/images/default_profile_banner_1794755346957.jpg';
import xianxiaHeroImg from '../assets/images/donghua_hero_fallback_1794755348232.jpg';
import {
  clearCustomBackdropBlob,
  isVideoMediaUrl,
  loadCustomBackdropBlob,
  sanitizeMediaUrl,
  saveCustomBackdropBlob,
} from '../utils/backdropStorage';

export type BackdropMode = 'preset-photo' | 'preset-motion' | 'custom-upload' | 'custom-url' | 'none';

export interface BackdropPreset {
  id: string;
  label: string;
  subtitle: string;
  mode: 'preset-photo' | 'preset-motion';
  imageSrc: string;
  motionVariant?: 'sakura' | 'embers' | 'aurora';
  accentColor: string;
}

export const PHOTO_BACKDROP_PRESETS: BackdropPreset[] = [
  {
    id: 'celestial-palace',
    label: 'Istana Langit',
    subtitle: 'Kultivasi awan senja sinematik',
    mode: 'preset-photo',
    imageSrc: celestialPalaceImg,
    accentColor: '#F59E0B',
  },
  {
    id: 'cyber-rain',
    label: 'Kota Malam Lampion',
    subtitle: 'Refleksi hujan & lentera hangat',
    mode: 'preset-photo',
    imageSrc: cyberRainCityImg,
    accentColor: '#E84A18',
  },
  {
    id: 'sakura-night',
    label: 'Kuil Sakura Malam',
    subtitle: 'Bulan purnama & kelopak sakura',
    mode: 'preset-photo',
    imageSrc: sakuraShrineImg,
    accentColor: '#F472B6',
  },
  {
    id: 'xianxia-peaks',
    label: 'Puncak Sekte Abadi',
    subtitle: 'Siluet gunung donghua klasik',
    mode: 'preset-photo',
    imageSrc: xianxiaHeroImg,
    accentColor: '#38BDF8',
  },
  {
    id: 'mecha-grid',
    label: 'Hanggar Mecha',
    subtitle: 'Nuansa futuristik gelap',
    mode: 'preset-photo',
    imageSrc: mechaBannerImg,
    accentColor: '#818CF8',
  },
];

export const MOTION_BACKDROP_PRESETS: BackdropPreset[] = [
  {
    id: 'motion-sakura',
    label: 'Sakura Melayang',
    subtitle: 'Animasi kelopak sakura 60fps',
    mode: 'preset-motion',
    imageSrc: sakuraShrineImg,
    motionVariant: 'sakura',
    accentColor: '#F472B6',
  },
  {
    id: 'motion-embers',
    label: 'Bara Api Malam',
    subtitle: 'Partikel bara & bokeh hujan halus',
    mode: 'preset-motion',
    imageSrc: cyberRainCityImg,
    motionVariant: 'embers',
    accentColor: '#E84A18',
  },
  {
    id: 'motion-aurora',
    label: 'Aurora Istana Langit',
    subtitle: 'Kabut bintang & cahaya surgawi',
    mode: 'preset-motion',
    imageSrc: celestialPalaceImg,
    motionVariant: 'aurora',
    accentColor: '#F59E0B',
  },
];

export const ALL_BACKDROP_PRESETS: BackdropPreset[] = [
  ...PHOTO_BACKDROP_PRESETS,
  ...MOTION_BACKDROP_PRESETS,
];

export interface BackgroundConfig {
  mode: BackdropMode;
  presetId: string;
  customUrl: string;
  customUrlKind: 'image' | 'video';
  customUploadKind: 'image' | 'video' | null;
  customUploadName: string;
  opacity: number; // 15 - 85
  blurPx: number;  // 0 - 14
}

const STORAGE_KEY = 'zonestream_backdrop_config_v1';

const DEFAULT_CONFIG: BackgroundConfig = {
  mode: 'preset-motion',
  presetId: 'motion-embers',
  customUrl: '',
  customUrlKind: 'image',
  customUploadKind: null,
  customUploadName: '',
  opacity: 44,
  blurPx: 1,
};

function readSavedConfig(): BackgroundConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BackgroundConfig>;
    const validMode: BackdropMode =
      parsed.mode === 'preset-photo' ||
      parsed.mode === 'preset-motion' ||
      parsed.mode === 'custom-upload' ||
      parsed.mode === 'custom-url' ||
      parsed.mode === 'none'
        ? parsed.mode
        : DEFAULT_CONFIG.mode;

    return {
      mode: validMode,
      presetId:
        typeof parsed.presetId === 'string' && parsed.presetId.trim()
          ? parsed.presetId
          : DEFAULT_CONFIG.presetId,
      customUrl: sanitizeMediaUrl(parsed.customUrl),
      customUrlKind: parsed.customUrlKind === 'video' ? 'video' : 'image',
      customUploadKind:
        parsed.customUploadKind === 'video'
          ? 'video'
          : parsed.customUploadKind === 'image'
          ? 'image'
          : null,
      customUploadName: typeof parsed.customUploadName === 'string' ? parsed.customUploadName : '',
      opacity:
        typeof parsed.opacity === 'number'
          ? Math.min(85, Math.max(15, Math.round(parsed.opacity)))
          : DEFAULT_CONFIG.opacity,
      blurPx:
        typeof parsed.blurPx === 'number'
          ? Math.min(14, Math.max(0, Math.round(parsed.blurPx)))
          : DEFAULT_CONFIG.blurPx,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

interface BackgroundContextValue {
  config: BackgroundConfig;
  activePreset: BackdropPreset | null;
  customObjectUrl: string;
  isCustomizerOpen: boolean;
  openCustomizer: () => void;
  closeCustomizer: () => void;
  selectPreset: (presetId: string) => void;
  setCustomUrlBackdrop: (url: string, explicitKind?: 'image' | 'video') => boolean;
  uploadCustomBackdrop: (file: File) => Promise<{ ok: boolean; error?: string }>;
  clearCustomUpload: () => Promise<void>;
  disableBackdrop: () => void;
  resetDefaultBackdrop: () => void;
  setOpacity: (opacity: number) => void;
  setBlurPx: (blurPx: number) => void;
}

const BackgroundContext = createContext<BackgroundContextValue | undefined>(undefined);

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BackgroundConfig>(readSavedConfig);
  const [customObjectUrl, setCustomObjectUrl] = useState<string>('');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const objectUrlRef = useRef<string>('');

  const replaceObjectUrl = useCallback((nextUrl: string) => {
    if (objectUrlRef.current && objectUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = nextUrl;
    setCustomObjectUrl(nextUrl);
  }, []);

  useEffect(() => {
    let active = true;
    void loadCustomBackdropBlob().then((record) => {
      if (!active) return;
      if (record?.blob) {
        const url = URL.createObjectURL(record.blob);
        replaceObjectUrl(url);
        setConfig((prev) => {
          if (prev.mode === 'custom-upload' && !prev.customUploadKind) {
            return {
              ...prev,
              customUploadKind: record.kind,
              customUploadName: record.name,
            };
          }
          return prev;
        });
      } else {
        setConfig((prev) =>
          prev.mode === 'custom-upload'
            ? { ...prev, mode: DEFAULT_CONFIG.mode, presetId: DEFAULT_CONFIG.presetId }
            : prev
        );
      }
    });
    return () => {
      active = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [replaceObjectUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage write errors
    }
  }, [config]);

  const activePreset =
    ALL_BACKDROP_PRESETS.find((p) => p.id === config.presetId) ||
    ALL_BACKDROP_PRESETS[0] ||
    null;

  const selectPreset = useCallback((presetId: string) => {
    const found = ALL_BACKDROP_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setConfig((prev) => ({
      ...prev,
      mode: found.mode,
      presetId: found.id,
    }));
  }, []);

  const setCustomUrlBackdrop = useCallback(
    (rawUrl: string, explicitKind?: 'image' | 'video'): boolean => {
      const safe = sanitizeMediaUrl(rawUrl);
      if (!safe) return false;
      const detectedKind: 'image' | 'video' =
        explicitKind || (isVideoMediaUrl(safe) ? 'video' : 'image');
      setConfig((prev) => ({
        ...prev,
        mode: 'custom-url',
        customUrl: safe,
        customUrlKind: detectedKind,
      }));
      return true;
    },
    []
  );

  const uploadCustomBackdrop = useCallback(
    async (file: File): Promise<{ ok: boolean; error?: string }> => {
      try {
        const saved = await saveCustomBackdropBlob(file);
        const nextObjUrl = URL.createObjectURL(file);
        replaceObjectUrl(nextObjUrl);
        setConfig((prev) => ({
          ...prev,
          mode: 'custom-upload',
          customUploadKind: saved.kind,
          customUploadName: saved.name,
        }));
        return { ok: true };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message || 'Gagal memproses file foto/video.',
        };
      }
    },
    [replaceObjectUrl]
  );

  const clearCustomUpload = useCallback(async () => {
    await clearCustomBackdropBlob();
    replaceObjectUrl('');
    setConfig((prev) => ({
      ...prev,
      mode: prev.mode === 'custom-upload' ? DEFAULT_CONFIG.mode : prev.mode,
      customUploadKind: null,
      customUploadName: '',
    }));
  }, [replaceObjectUrl]);

  const disableBackdrop = useCallback(() => {
    setConfig((prev) => ({ ...prev, mode: 'none' }));
  }, []);

  const resetDefaultBackdrop = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      mode: DEFAULT_CONFIG.mode,
      presetId: DEFAULT_CONFIG.presetId,
      opacity: DEFAULT_CONFIG.opacity,
      blurPx: DEFAULT_CONFIG.blurPx,
    }));
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    const clamped = Math.min(85, Math.max(15, Math.round(opacity)));
    setConfig((prev) => ({ ...prev, opacity: clamped }));
  }, []);

  const setBlurPx = useCallback((blurPx: number) => {
    const clamped = Math.min(14, Math.max(0, Math.round(blurPx)));
    setConfig((prev) => ({ ...prev, blurPx: clamped }));
  }, []);

  return (
    <BackgroundContext.Provider
      value={{
        config,
        activePreset,
        customObjectUrl,
        isCustomizerOpen,
        openCustomizer: () => setIsCustomizerOpen(true),
        closeCustomizer: () => setIsCustomizerOpen(false),
        selectPreset,
        setCustomUrlBackdrop,
        uploadCustomBackdrop,
        clearCustomUpload,
        disableBackdrop,
        resetDefaultBackdrop,
        setOpacity,
        setBlurPx,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error('useBackground must be used inside BackgroundProvider');
  return ctx;
}
