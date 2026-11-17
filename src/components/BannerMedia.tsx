import { useEffect, useRef, useState } from 'react';
import { isVideoMediaUrl } from '../utils/backdropStorage';

export function BannerMedia({
  src,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  fetchPriority,
}: {
  src?: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const [errored, setErrored] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const resolved = !errored && src ? src : fallbackSrc;
  const isVideo = !errored && isVideoMediaUrl(resolved);

  useEffect(() => {
    if (!isVideo) return;
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
  }, [isVideo]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={resolved}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        disablePictureInPicture
        onError={() => setErrored(true)}
        className={className}
      />
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => {
        if (!errored) setErrored(true);
      }}
      className={className}
    />
  );
}
