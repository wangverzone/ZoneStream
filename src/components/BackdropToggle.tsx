import { Film } from 'lucide-react';
import { useBackground } from '../context/BackgroundContext';

export function BackdropToggle({ compact = false }: { compact?: boolean }) {
  const { config, openCustomizer } = useBackground();
  const isActive = config.mode !== 'none';

  return (
    <button
      type="button"
      onClick={openCustomizer}
      aria-label="Ubah Latar Belakang Foto atau Video"
      title="Ganti Latar Belakang (Foto / Video)"
      className={`min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
        compact ? 'min-w-[40px] px-2.5' : 'px-3'
      } ${
        isActive
          ? 'bg-white hover:bg-slate-100 border-slate-200 text-[#E84A18] dark:bg-[#14161E] dark:hover:bg-[#1D202C] dark:border-white/[0.08] dark:text-[#FF7A50]'
          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-[#14161E] dark:hover:bg-[#1D202C] dark:border-white/[0.08] dark:text-gray-200'
      }`}
    >
      <Film className="w-4 h-4 shrink-0" />
      {!compact && <span className="text-xs font-semibold">Latar</span>}
    </button>
  );
}
