import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      className={`min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
        compact ? 'min-w-[40px] px-2.5' : 'px-3'
      } bg-white hover:bg-slate-100 border-slate-200 text-slate-700 dark:bg-[#14161E] dark:hover:bg-[#1D202C] dark:border-white/[0.08] dark:text-gray-200`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-[#E84A18]" />
      )}
      {!compact && (
        <span className="text-xs font-semibold">{isDark ? 'Terang' : 'Gelap'}</span>
      )}
    </button>
  );
}
