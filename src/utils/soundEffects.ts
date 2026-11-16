import { useEffect, useState } from 'react';

export type SoundCategory = 'chat' | 'notification' | 'levelUp';
export type ChatSoundId = 'pop' | 'chime' | 'droplet' | 'arcade' | 'none';
export type NotificationSoundId = 'bell' | 'pulse' | 'sparkle' | 'gentle' | 'none';
export type LevelUpSoundId = 'fanfare' | 'powerup' | 'orchestral' | 'retro' | 'none';

export interface SoundSettings {
  volume: number; // 0..1
  chat: ChatSoundId;
  notification: NotificationSoundId;
  levelUp: LevelUpSoundId;
}

export interface SoundPresetOption<T extends string = string> {
  id: T;
  labelId: string;
  labelEn: string;
  descId: string;
  descEn: string;
}

export const SOUND_PRESETS: {
  chat: SoundPresetOption<ChatSoundId>[];
  notification: SoundPresetOption<NotificationSoundId>[];
  levelUp: SoundPresetOption<LevelUpSoundId>[];
} = {
  chat: [
    {
      id: 'pop',
      labelId: 'Bubble Pop',
      labelEn: 'Bubble Pop',
      descId: 'Pop halus modern untuk chat masuk',
      descEn: 'Soft modern bubble pop',
    },
    {
      id: 'chime',
      labelId: 'Crystal Chime',
      labelEn: 'Crystal Chime',
      descId: 'Dentingan ganda jernih',
      descEn: 'Bright double crystal chime',
    },
    {
      id: 'droplet',
      labelId: 'Water Drop',
      labelEn: 'Water Drop',
      descId: 'Tetesan air lembut',
      descEn: 'Smooth resonant droplet',
    },
    {
      id: 'arcade',
      labelId: 'Retro Blip',
      labelEn: 'Retro Blip',
      descId: 'Ping 8-bit ringan dan cepat',
      descEn: 'Crisp 8-bit ping',
    },
    {
      id: 'none',
      labelId: 'Senyap',
      labelEn: 'Muted',
      descId: 'Matikan suara pesan baru',
      descEn: 'Disable chat message sound',
    },
  ],
  notification: [
    {
      id: 'bell',
      labelId: 'Classic Bell',
      labelEn: 'Classic Bell',
      descId: 'Lonceng dua nada bersih',
      descEn: 'Clean two-tone bell',
    },
    {
      id: 'pulse',
      labelId: 'Sonar Ping',
      labelEn: 'Sonar Ping',
      descId: 'Denyut radar ambient lembut',
      descEn: 'Gentle ambient sonar ping',
    },
    {
      id: 'sparkle',
      labelId: 'Starlight Ding',
      labelEn: 'Starlight Ding',
      descId: 'Nada berkilau untuk episode baru',
      descEn: 'Shimmering alert chime',
    },
    {
      id: 'gentle',
      labelId: 'Soft Breeze',
      labelEn: 'Soft Breeze',
      descId: 'Akord hangat tidak mencolok',
      descEn: 'Warm subtle chord',
    },
    {
      id: 'none',
      labelId: 'Senyap',
      labelEn: 'Muted',
      descId: 'Matikan suara notifikasi',
      descEn: 'Disable notification sound',
    },
  ],
  levelUp: [
    {
      id: 'fanfare',
      labelId: 'Victory Fanfare',
      labelEn: 'Victory Fanfare',
      descId: 'Arpeggio kemenangan penuh semangat',
      descEn: 'Uplifting ascending arpeggio',
    },
    {
      id: 'powerup',
      labelId: 'Cultivation Surge',
      labelEn: 'Cultivation Surge',
      descId: 'Lonjakan energi kultivator',
      descEn: 'Energetic synth surge',
    },
    {
      id: 'orchestral',
      labelId: 'Royal Ascend',
      labelEn: 'Royal Ascend',
      descId: 'Akord megah naik tingkat',
      descEn: 'Warm major triad swell',
    },
    {
      id: 'retro',
      labelId: '8-Bit Level Up',
      labelEn: '8-Bit Level Up',
      descId: 'Melodi level-up game klasik',
      descEn: 'Classic retro game melody',
    },
    {
      id: 'none',
      labelId: 'Senyap',
      labelEn: 'Muted',
      descId: 'Matikan suara naik level',
      descEn: 'Disable level-up sound',
    },
  ],
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  volume: 0.75,
  chat: 'pop',
  notification: 'bell',
  levelUp: 'fanfare',
};

const STORAGE_KEY = 'zonestream_sound_settings_v1';
const EVENT_NAME = 'zonestream:sound-settings-change';

export function getSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    const validChat = SOUND_PRESETS.chat.some((p) => p.id === parsed.chat)
      ? (parsed.chat as ChatSoundId)
      : DEFAULT_SOUND_SETTINGS.chat;
    const validNotif = SOUND_PRESETS.notification.some((p) => p.id === parsed.notification)
      ? (parsed.notification as NotificationSoundId)
      : DEFAULT_SOUND_SETTINGS.notification;
    const validLevel = SOUND_PRESETS.levelUp.some((p) => p.id === parsed.levelUp)
      ? (parsed.levelUp as LevelUpSoundId)
      : DEFAULT_SOUND_SETTINGS.levelUp;
    const vol =
      typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_SOUND_SETTINGS.volume;
    return {
      volume: vol,
      chat: validChat,
      notification: validNotif,
      levelUp: validLevel,
    };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function saveSoundSettings(next: SoundSettings): SoundSettings {
  const normalized: SoundSettings = {
    volume: Math.min(1, Math.max(0, Number(next.volume) || 0)),
    chat: next.chat,
    notification: next.notification,
    levelUp: next.levelUp,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
    } catch {
      // Ignore storage quota errors
    }
  }
  return normalized;
}

export function useSoundSettings() {
  const [settings, setSettings] = useState<SoundSettings>(() => getSoundSettings());

  useEffect(() => {
    const handler = () => setSettings(getSoundSettings());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const updateSettings = (patch: Partial<SoundSettings>) => {
    const merged = saveSoundSettings({ ...getSoundSettings(), ...patch });
    setSettings(merged);
  };

  return { settings, updateSettings };
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function scheduleTone(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  freqStart: number,
  freqEnd: number,
  type: OscillatorType,
  peakGain: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freqStart), startTime);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), startTime + duration);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), startTime + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function playSoundEffect(
  category: SoundCategory,
  overrideId?: string,
  overrideVolume?: number
): void {
  try {
    const settings = getSoundSettings();
    const soundId = overrideId ?? settings[category];
    if (!soundId || soundId === 'none') return;

    const vol =
      typeof overrideVolume === 'number'
        ? Math.min(1, Math.max(0, overrideVolume))
        : settings.volume;
    if (vol <= 0.01) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.01;
    const base = 0.22 * vol;

    if (category === 'chat') {
      switch (soundId) {
        case 'pop':
          scheduleTone(ctx, now, 0.09, 440, 880, 'sine', base);
          break;
        case 'chime':
          scheduleTone(ctx, now, 0.14, 880, 880, 'triangle', base * 0.8);
          scheduleTone(ctx, now + 0.08, 0.18, 1174.66, 1174.66, 'sine', base * 0.75);
          break;
        case 'droplet':
          scheduleTone(ctx, now, 0.14, 620, 1240, 'sine', base * 0.9);
          break;
        case 'arcade':
          scheduleTone(ctx, now, 0.07, 659.25, 987.77, 'square', base * 0.35);
          break;
      }
      return;
    }

    if (category === 'notification') {
      switch (soundId) {
        case 'bell':
          scheduleTone(ctx, now, 0.22, 783.99, 783.99, 'sine', base * 0.85);
          scheduleTone(ctx, now + 0.1, 0.3, 1046.5, 1046.5, 'sine', base * 0.75);
          break;
        case 'pulse':
          scheduleTone(ctx, now, 0.28, 523.25, 520, 'sine', base * 0.75);
          scheduleTone(ctx, now + 0.14, 0.32, 783.99, 780, 'sine', base * 0.45);
          break;
        case 'sparkle':
          scheduleTone(ctx, now, 0.14, 987.77, 987.77, 'triangle', base * 0.65);
          scheduleTone(ctx, now + 0.07, 0.16, 1318.51, 1318.51, 'sine', base * 0.65);
          scheduleTone(ctx, now + 0.14, 0.24, 1567.98, 1567.98, 'sine', base * 0.6);
          break;
        case 'gentle':
          scheduleTone(ctx, now, 0.35, 392.0, 392.0, 'sine', base * 0.5);
          scheduleTone(ctx, now + 0.04, 0.38, 493.88, 493.88, 'sine', base * 0.45);
          scheduleTone(ctx, now + 0.08, 0.4, 587.33, 587.33, 'sine', base * 0.4);
          break;
      }
      return;
    }

    if (category === 'levelUp') {
      switch (soundId) {
        case 'fanfare': {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((f, idx) => {
            const dur = idx === notes.length - 1 ? 0.42 : 0.14;
            scheduleTone(ctx, now + idx * 0.09, dur, f, f, 'triangle', base * 0.85);
          });
          break;
        }
        case 'powerup':
          scheduleTone(ctx, now, 0.22, 329.63, 659.25, 'sawtooth', base * 0.3);
          scheduleTone(ctx, now + 0.14, 0.22, 523.25, 1046.5, 'triangle', base * 0.75);
          scheduleTone(ctx, now + 0.28, 0.4, 1318.51, 1318.51, 'sine', base * 0.85);
          break;
        case 'orchestral':
          scheduleTone(ctx, now, 0.45, 261.63, 261.63, 'triangle', base * 0.55);
          scheduleTone(ctx, now + 0.06, 0.45, 392.0, 392.0, 'sine', base * 0.55);
          scheduleTone(ctx, now + 0.12, 0.5, 523.25, 523.25, 'sine', base * 0.6);
          scheduleTone(ctx, now + 0.18, 0.55, 659.25, 659.25, 'triangle', base * 0.65);
          break;
        case 'retro': {
          const notes = [440, 554.37, 659.25, 880, 1108.73];
          notes.forEach((f, idx) => {
            const dur = idx === notes.length - 1 ? 0.32 : 0.08;
            scheduleTone(ctx, now + idx * 0.075, dur, f, f, 'square', base * 0.35);
          });
          break;
        }
      }
    }
  } catch {
    // Ignore audio errors when device/browser blocks playback
  }
}
