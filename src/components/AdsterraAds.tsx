import { useEffect, useRef, useState } from 'react';
import { Crown, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: string;
      height: number;
      width: number;
      params: Record<string, unknown>;
    };
  }
}

// Sequential queue so multiple Adsterra banners never overwrite window.atOptions concurrently
let adsterraQueue: Promise<void> = Promise.resolve();

function hasRenderedAdContent(container: HTMLDivElement): boolean {
  if (container.querySelector('iframe, img, a, ins')) return true;
  return container.offsetHeight >= 28;
}

function enqueueAdsterraBanner(
  container: HTMLDivElement,
  key: string,
  width: number,
  height: number,
  onAdBlocked: () => void
): () => void {
  let cancelled = false;
  let scriptLoaded = false;

  adsterraQueue = adsterraQueue.then(
    () =>
      new Promise<void>((resolve) => {
        if (cancelled || !container.isConnected) {
          resolve();
          return;
        }
        container.innerHTML = '';

        window.atOptions = {
          key,
          format: 'iframe',
          height,
          width,
          params: {},
        };

        const appendScript = (src: string, onFail?: () => void) => {
          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.async = true;
          script.src = src;

          script.onload = () => {
            scriptLoaded = true;
            // Give Adsterra DOM writer generous time before unlocking next banner slot in queue
            setTimeout(() => resolve(), 600);
          };
          script.onerror = () => {
            if (onFail) {
              onFail();
            } else {
              if (!cancelled && !hasRenderedAdContent(container)) {
                onAdBlocked();
              }
              setTimeout(resolve, 200);
            }
          };

          container.appendChild(script);
        };

        appendScript(`https://bancadeltempoidea.org/22/${key}/invoke.js`, () => {
          if (cancelled || !container.isConnected) {
            resolve();
            return;
          }
          window.atOptions = {
            key,
            format: 'iframe',
            height,
            width,
            params: {},
          };
          appendScript(`https://www.highperformanceformat.com/${key}/invoke.js`);
        });

        // Safety queue unlock even if CDN hangs, WITHOUT prematurely hiding the Adsterra slot
        setTimeout(() => {
          if (!cancelled && !scriptLoaded && !hasRenderedAdContent(container)) {
            onAdBlocked();
          }
          resolve();
        }, 6000);
      })
  );

  return () => {
    cancelled = true;
    container.innerHTML = '';
  };
}

/**
 * Banner 728x90 — Dipasang di bawah Hero Slider.
 * Tetap mempertahankan container Adsterra terbuka agar iklan live tampil penuh;
 * hanya menampilkan sponsor fallback jika script Adsterra benar-benar diblokir adblocker.
 */
export function AdsterraBanner728x90() {
  const { isPremium, loading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    if (loading || isPremium || !containerRef.current) return;
    setFallbackMode(false);
    return enqueueAdsterraBanner(
      containerRef.current,
      'f499ca57b48e1b1f25dcfa51c742777f',
      728,
      90,
      () => setFallbackMode(true)
    );
  }, [loading, isPremium]);

  if (loading || isPremium) {
    return null;
  }

  return (
    <div className="my-5 flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-[748px] rounded-2xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.06] p-2.5 flex flex-col items-center justify-center overflow-hidden shadow-sm">
        <div className="w-full flex items-center justify-between px-1 mb-1">
          <span className="text-[10px] text-slate-400 dark:text-[#7A808D] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Clean Sponsor Slot</span>
          </span>
          <Link
            to="/profile"
            className="text-[10px] font-semibold text-[#E84A18] hover:underline"
          >
            Hapus Iklan (VIP)
          </Link>
        </div>
        <div className="w-full overflow-x-auto no-scrollbar flex justify-center">
          <div
            ref={containerRef}
            className={
              fallbackMode
                ? 'hidden'
                : 'min-h-[90px] min-w-[320px] flex items-center justify-center text-[11px] text-slate-400'
            }
          />
          {fallbackMode && (
            <Link
              to="/profile"
              className="w-full min-h-[82px] px-4 py-3 rounded-xl bg-gradient-to-r from-[#E84A18]/10 via-amber-500/10 to-sky-500/10 border border-[#E84A18]/25 flex items-center justify-between gap-3 hover:border-[#E84A18] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#E84A18] text-white flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    ZoneStream VIP Pass — Bebas Iklan &amp; 2x EXP Harian
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-gray-300 truncate">
                    Dapatkan lencana Verified di sebelah nama, emoji VIP, &amp; streaming tanpa iklan.
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-2 rounded-lg bg-[#E84A18] text-white text-xs font-bold whitespace-nowrap shrink-0">
                Upgrade VIP
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Banner 300x250 — Dipasang di halaman Detail / Nonton & di dalam WatchAdsModal.
 * Menjaga slot Adsterra tetap aktif dan hanya fallback bila script diblokir total oleh jaringan/adblock.
 */
export function AdsterraBanner300x250({ className = '' }: { className?: string }) {
  const { isPremium, loading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    if (loading || isPremium || !containerRef.current) return;
    setFallbackMode(false);
    return enqueueAdsterraBanner(
      containerRef.current,
      'b5815a366a899a3a9e1826e2140efe28',
      300,
      250,
      () => setFallbackMode(true)
    );
  }, [loading, isPremium]);

  if (loading || isPremium) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="rounded-2xl bg-white dark:bg-[#13151C] border border-slate-200 dark:border-white/[0.06] p-2.5 flex flex-col items-center justify-center shadow-sm">
        <div className="w-full flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] text-slate-400 dark:text-[#7A808D]">Sponsored</span>
          <Link
            to="/profile"
            className="text-[10px] font-semibold text-[#E84A18] hover:underline"
          >
            Bebas Iklan?
          </Link>
        </div>
        <div
          ref={containerRef}
          className={
            fallbackMode
              ? 'hidden'
              : 'w-[300px] h-[250px] flex items-center justify-center bg-slate-100 dark:bg-[#0D0F14] rounded-lg overflow-hidden text-[11px] text-slate-400'
          }
        />
        {fallbackMode && (
          <Link
            to="/profile"
            className="w-[300px] h-[250px] p-5 rounded-xl bg-gradient-to-br from-[#161923] via-[#1C1618] to-[#0D0F14] border border-[#E84A18]/30 flex flex-col items-center justify-center text-center gap-3 text-white hover:border-[#E84A18] transition-colors"
          >
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E84A18] to-amber-500 flex items-center justify-center shadow-lg shadow-[#E84A18]/30">
              <Crown className="w-6 h-6 text-white" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-white">Upgrade ke ZoneStream VIP</p>
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                Nikmati streaming Anime &amp; Donghua tanpa timer iklan, 2x EXP, lencana Verified, dan stiker eksklusif.
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold">
              Aktifkan VIP Sekarang
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Mengelola Popunder & Social Bar secara dinamis berdasarkan status user.isPremium.
 * Popunder hanya dimuat di rute streaming (/detail dan /watch) untuk user non-premium.
 */
export function AdsterraGlobalManager() {
  const { user, isPremium, loading } = useAuth();
  const location = useLocation();
  const popunderLoadedRef = useRef(false);
  const premiumActive = Boolean(user?.isPremium || isPremium);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('zonestream_is_premium', String(premiumActive));

    if (premiumActive) {
      document
        .querySelectorAll('script[data-adsterra="popunder"], script[data-adsterra="social-bar"]')
        .forEach((el) => el.remove());
      if (popunderLoadedRef.current) {
        popunderLoadedRef.current = false;
        window.location.reload();
      }
      return;
    }

    const isStreamingPage =
      location.pathname.startsWith('/watch') || location.pathname.startsWith('/detail');

    if (isStreamingPage && !document.querySelector('script[data-adsterra="popunder"]')) {
      const pop = document.createElement('script');
      pop.setAttribute('data-cfasync', 'false');
      pop.setAttribute('data-adsterra', 'popunder');
      pop.src = 'https://aarems.org/1/46554fc499e74f2fef4bb6495cf5e0da';
      document.head.appendChild(pop);
      popunderLoadedRef.current = true;
    }

    const socialBarUrl = import.meta.env.VITE_ADSTERRA_SOCIAL_BAR_URL?.trim();
    if (
      isStreamingPage &&
      socialBarUrl &&
      !document.querySelector('script[data-adsterra="social-bar"]')
    ) {
      const sb = document.createElement('script');
      sb.type = 'text/javascript';
      sb.setAttribute('data-adsterra', 'social-bar');
      sb.src = socialBarUrl;
      document.body.appendChild(sb);
    }
  }, [loading, premiumActive, location.pathname]);

  return null;
}
