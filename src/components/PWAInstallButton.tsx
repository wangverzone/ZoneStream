import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  MonitorSmartphone,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'pill' | 'cta';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'pill',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Sembunyikan tombol instalasi secara otomatis jika sudah berjalan dalam mode Standalone App
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Instal Aplikasi ZoneStream"
          title={
            isInstallable
              ? 'Instal Aplikasi ZoneStream ke Perangkat'
              : 'Cara Instal Aplikasi Standalone'
          }
          className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-100 hover:bg-[#E84A18] hover:text-white dark:bg-[#13151C] dark:hover:bg-[#E84A18] border border-slate-200 dark:border-white/[0.08] text-[#E84A18] dark:text-[#FF7A4D] flex items-center justify-center transition-colors shrink-0 ${className}`}
        >
          <Download className="w-4 h-4" />
        </button>
      ) : variant === 'cta' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`px-5 py-2.5 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-lg shadow-[#E84A18]/30 ${className}`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{isInstallable ? 'Install Aplikasi Sekarang' : 'Install Aplikasi (Fullscreen)'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`h-9 px-3 rounded-xl bg-[#E84A18] hover:bg-[#F35B2B] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm shadow-[#E84A18]/25 transition-colors whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install App</span>
        </button>
      )}

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instal Aplikasi ZoneStream"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="ZoneStream Icon"
                  className="w-11 h-11 rounded-xl object-cover ring-2 ring-[#E84A18]/60 shrink-0"
                />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {isIOS ? 'Instal ZoneStream di iPhone / iPad' : 'Instal Aplikasi ZoneStream'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Mode Layar Penuh Standalone · Tanpa Bar Browser
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Tutup panduan"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-gray-200">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-start gap-2.5">
                  <Share className="w-4 h-4 text-[#E84A18] shrink-0 mt-0.5" />
                  <p>
                    1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-[#E84A18] shrink-0 mt-0.5" />
                  <p>
                    2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    3. Buka ikon <strong>ZoneStream</strong> dari Home Screen untuk tampilan aplikasi penuh!
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-gray-200">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-[#E84A18] shrink-0 mt-0.5" />
                  <p>
                    <strong>Android (Chrome / Edge):</strong> Buka menu titik tiga (⋮) di pojok kanan atas lalu pilih{' '}
                    <strong>&ldquo;Instal Aplikasi&rdquo;</strong> atau <strong>&ldquo;Tambahkan ke layar utama&rdquo;</strong>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] flex items-start gap-2.5">
                  <MonitorSmartphone className="w-4 h-4 text-[#E84A18] shrink-0 mt-0.5" />
                  <p>
                    <strong>PC / Laptop (Chrome / Edge):</strong> Klik ikon <strong>Instal (⊕ / Layar)</strong> di sisi kanan kolom alamat browser.
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-gray-400 px-1">
                  Catatan: Jika Anda sedang membuka pratinjau di dalam frame, buka tautan langsung di Chrome/Safari agar tombol instalasi native muncul otomatis.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-[#E84A18] dark:hover:bg-[#E84A18] dark:hover:text-white text-xs font-extrabold transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
