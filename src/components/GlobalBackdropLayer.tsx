import { useEffect, useRef, useState } from 'react';
import { useBackground } from '../context/BackgroundContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rot: number;
  vRot: number;
  hue: string;
}

function AmbientMotionCanvas({
  variant,
}: {
  variant: 'sakura' | 'embers' | 'aurora';
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isMobile = width < 768;
      const count = variant === 'aurora' ? (isMobile ? 22 : 36) : isMobile ? 20 : 38;

      particles = Array.from({ length: count }, () => {
        if (variant === 'sakura') {
          return {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: -0.35 - Math.random() * 0.45,
            vy: 0.45 + Math.random() * 0.75,
            size: 3.5 + Math.random() * 5,
            alpha: 0.25 + Math.random() * 0.45,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.025,
            hue: Math.random() > 0.35 ? '251, 182, 206' : '244, 114, 182',
          };
        }
        if (variant === 'embers') {
          return {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: -0.35 - Math.random() * 0.65,
            size: 1.8 + Math.random() * 3.4,
            alpha: 0.25 + Math.random() * 0.55,
            rot: 0,
            vRot: 0,
            hue: Math.random() > 0.3 ? '232, 74, 24' : '251, 191, 36',
          };
        }
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          size: 1.2 + Math.random() * 2.4,
          alpha: 0.2 + Math.random() * 0.55,
          rot: Math.random() * Math.PI * 2,
          vRot: 0.015,
          hue: Math.random() > 0.45 ? '253, 224, 71' : '125, 211, 252',
        };
      });
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    let lastTime = 0;
    const render = (now: number) => {
      if (document.hidden) {
        animId = window.requestAnimationFrame(render);
        return;
      }
      // Cap frame cadence cleanly (~30-45fps) so scroll stays effortless on low-end phones
      if (now - lastTime < 22) {
        animId = window.requestAnimationFrame(render);
        return;
      }
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;

        if (variant === 'sakura') {
          if (p.y > height + 20) {
            p.y = -15;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 15;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.56, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (variant === 'embers') {
          if (p.y < -20) {
            p.y = height + 15;
            p.x = Math.random() * width;
          }
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
          const twinkle = 0.65 + 0.35 * Math.sin(p.rot);
          ctx.fillStyle = `rgba(${p.hue}, ${p.alpha * twinkle})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

export function GlobalBackdropLayer() {
  const { config, activePreset, customObjectUrl } = useBackground();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    setUrlError(false);
  }, [config.mode, config.customUrl, customObjectUrl]);

  useEffect(() => {
    const onVisibility = () => {
      const vid = videoRef.current;
      if (!vid) return;
      if (document.hidden) {
        vid.pause();
      } else {
        void vid.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (config.mode === 'none') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#F5F7FB] dark:bg-[#090A0E] transition-colors duration-200"
      >
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.08),_transparent_68%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.14),_transparent_68%)]" />
      </div>
    );
  }

  let mediaKind: 'image' | 'video' = 'image';
  let mediaSrc = activePreset?.imageSrc || '';

  if (config.mode === 'custom-upload' && customObjectUrl) {
    mediaKind = config.customUploadKind || 'image';
    mediaSrc = customObjectUrl;
  } else if (config.mode === 'custom-url' && config.customUrl && !urlError) {
    mediaKind = config.customUrlKind;
    mediaSrc = config.customUrl;
  }

  const opacityFraction = Math.min(0.85, Math.max(0.15, config.opacity / 100));
  const blurFilter = config.blurPx > 0 ? `blur(${config.blurPx}px)` : undefined;
  const mediaScale = config.blurPx > 0 ? 'scale(1.06)' : 'scale(1.02)';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#F5F7FB] dark:bg-[#090A0E] select-none"
      style={{ contain: 'strict', transform: 'translateZ(0)' }}
    >
      <div
        className={`absolute inset-0 ${
          config.mode === 'preset-motion' ? 'animate-backdrop-drift' : ''
        }`}
      >
        {mediaSrc && mediaKind === 'video' ? (
          <video
            ref={videoRef}
            src={mediaSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            onError={() => setUrlError(true)}
            className="w-full h-full object-cover object-center transition-opacity duration-300"
            style={{
              opacity: opacityFraction,
              filter: blurFilter,
              transform: `translate3d(0,0,0) ${mediaScale}`,
            }}
          />
        ) : mediaSrc ? (
          <img
            src={mediaSrc}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setUrlError(true)}
            className="w-full h-full object-cover object-center transition-opacity duration-500"
            style={{
              opacity: opacityFraction,
              filter: blurFilter,
              transform: `translate3d(0,0,0) ${mediaScale}`,
            }}
          />
        ) : null}
      </div>

      {/* Smooth GPU-throttled Ambient Particles when a Live Motion preset is active */}
      {config.mode === 'preset-motion' && activePreset?.motionVariant && (
        <AmbientMotionCanvas variant={activePreset.motionVariant} />
      )}

      {/* Measured Readability Contrast Scrim (preserves WCAG AA text contrast in both Light & Dark modes) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F5F7FB]/58 via-[#F5F7FB]/74 to-[#F5F7FB]/90 dark:from-[#090A0E]/42 dark:via-[#090A0E]/60 dark:to-[#090A0E]/82 transition-colors duration-200" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.09),_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.14),_transparent_70%)]" />
    </div>
  );
}
