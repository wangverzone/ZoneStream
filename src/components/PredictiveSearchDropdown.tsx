import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Tag } from 'lucide-react';

interface PredictiveSearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  items: Array<{
    id: string;
    type: 'anime' | 'donghua';
    title: string;
    poster: string;
    rating?: string;
    episodeLabel?: string;
    genres?: string[];
  }>;
}

export const PredictiveSearchDropdown: React.FC<PredictiveSearchDropdownProps> = ({
  query,
  isOpen,
  onClose,
  items,
}) => {
  const [results, setResults] = useState<any[]>([]);
  const [matchingGenres, setMatchingGenres] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) {
      setResults([]);
      setMatchingGenres([]);
      return;
    }

    const filtered = items
      .filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const genreMatch = item.genres?.some((g) => g.toLowerCase().includes(q));
        return titleMatch || genreMatch;
      })
      .slice(0, 6);

    setResults(filtered);

    const allGenres = new Set<string>();
    items.forEach((it) => {
      it.genres?.forEach((g) => {
        if (g.toLowerCase().includes(q)) {
          allGenres.add(g);
        }
      });
    });
    setMatchingGenres(Array.from(allGenres).slice(0, 4));
  }, [query, items]);

  if (!isOpen || (!results.length && !matchingGenres.length)) return null;

  return (
    <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl bg-white dark:bg-[#14161F] border border-slate-200 dark:border-white/10 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-white/5">
        <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#E84A18]" />
          Prediksi Hasil Pencarian Cepat
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {results.length} Judul Ditemukan
        </span>
      </div>

      {matchingGenres.length > 0 && (
        <div className="mb-2.5 pb-2 border-b border-slate-100 dark:border-white/5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <Tag className="w-3 h-3 text-[#E84A18]" /> Genre:
          </span>
          {matchingGenres.map((g) => (
            <Link
              key={g}
              to={`/catalog?genre=${encodeURIComponent(g)}`}
              onClick={onClose}
              className="px-2 py-0.5 rounded-lg bg-[#E84A18]/10 text-[#E84A18] hover:bg-[#E84A18] hover:text-white text-[10px] font-extrabold transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
        {results.map((item) => (
          <Link
            key={`predictive-${item.type}-${item.id}`}
            to={`/detail/${item.type}/${encodeURIComponent(item.id)}`}
            onClick={onClose}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group"
          >
            <img
              src={item.poster || '/placeholder.svg'}
              alt={item.title}
              className="w-10 h-12 rounded-lg object-cover bg-slate-200 dark:bg-[#1F222C] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-[#E84A18] transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300 uppercase">
                  {item.type}
                </span>
                <span className="text-[11px] text-[#E84A18] font-bold">
                  {item.episodeLabel || 'Ongoing'}
                </span>
                {item.rating && (
                  <span className="text-[10px] text-amber-500 font-extrabold">
                    ★ {item.rating}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
