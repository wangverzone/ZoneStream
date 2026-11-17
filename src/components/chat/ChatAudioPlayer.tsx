import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';

interface ChatAudioPlayerProps {
  src: string;
  isMine?: boolean;
  darkSurface?: boolean;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const ChatAudioPlayer: React.FC<ChatAudioPlayerProps> = ({
  src,
  isMine = false,
  darkSurface = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Deterministic pseudo-waveform bars for clean visual cadence
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < Math.min(src.length, 32); i++) {
      seed = (seed * 31 + src.charCodeAt(i)) % 997;
    }
    return Array.from({ length: 24 }, (_, idx) => {
      const val = ((seed + idx * 37) % 14) + 5; // 5..18 px height
      return Math.min(22, Math.max(5, val));
    });
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div
      className={`mb-1.5 flex items-center gap-2.5 rounded-xl px-2.5 py-2 min-w-[210px] sm:min-w-[245px] ${
        darkSurface
          ? 'bg-black/30 border border-white/10'
          : isMine
          ? 'bg-black/5 dark:bg-black/25'
          : 'bg-slate-100 dark:bg-black/25'
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm ${
          darkSurface
            ? 'bg-sky-500 hover:bg-sky-400 text-white'
            : isMine
            ? 'bg-[#00A884] hover:bg-[#06CF9C] text-white'
            : 'bg-[#E84A18] hover:bg-[#F35B2B] text-white'
        }`}
        aria-label={playing ? 'Jeda Voice Note' : 'Putar Voice Note'}
      >
        {playing ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          onClick={handleSeek}
          className="h-6 flex items-center gap-[2.5px] cursor-pointer"
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {bars.map((height, i) => {
            const active = i / bars.length <= progress;
            return (
              <span
                key={i}
                style={{ height: `${height}px` }}
                className={`flex-1 rounded-full transition-colors ${
                  active
                    ? darkSurface
                      ? 'bg-sky-400'
                      : 'bg-[#00A884]'
                    : darkSurface
                    ? 'bg-white/25'
                    : 'bg-slate-400/45 dark:bg-white/20'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono-tabular opacity-75">
          <span className="inline-flex items-center gap-1">
            <Mic className="w-2.5 h-2.5" />
            <span>{playing ? formatSeconds(currentTime) : formatSeconds(duration || currentTime)}</span>
          </span>
          <span>VN</span>
        </div>
      </div>
    </div>
  );
};
