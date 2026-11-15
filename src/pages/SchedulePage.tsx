import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Layout } from '../components/Layout';
import { MediaCard } from '../components/MediaCard';
import type { MediaCardItem } from '../types';

interface DaySchedule {
  day: string;
  items: MediaCardItem[];
}

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function SchedulePage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(
    INDONESIAN_DAYS[new Date().getDay()] || 'Senin'
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'donghua' | 'anime'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/stream/schedule')
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.ok && Array.isArray(json.schedule)) {
          setSchedule(json.schedule);
          const hasToday = json.schedule.some((d: DaySchedule) => d.day === selectedDay);
          if (!hasToday && json.schedule.length > 0) {
            setSelectedDay(json.schedule[0].day);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentDay = schedule.find((d) => d.day === selectedDay);
  const items = (currentDay?.items || []).filter((item) =>
    typeFilter === 'all' ? true : item.type === typeFilter
  );

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#E84A18]/15 text-[#E84A18] flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Jadwal Rilis Mingguan
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                Update otomatis Anime &amp; Donghua
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-[#14161D] p-1 rounded-xl border border-slate-200 dark:border-white/5 self-start shadow-sm dark:shadow-none">
            {(['all', 'donghua', 'anime'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  typeFilter === t
                    ? 'bg-[#E84A18] text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
                }`}
              >
                {t === 'all' ? 'Semua' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Day Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
          {schedule.map((entry) => {
            const active = entry.day === selectedDay;
            const filteredCount = entry.items.filter((x) =>
              typeFilter === 'all' ? true : x.type === typeFilter
            ).length;
            return (
              <button
                key={entry.day}
                type="button"
                onClick={() => setSelectedDay(entry.day)}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#E84A18] text-white shadow-md shadow-[#E84A18]/25'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-[#15171F] dark:text-gray-300 dark:hover:bg-[#1E212B] dark:border-white/5'
                }`}
              >
                <span>{entry.day}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-tabular ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400'
                  }`}
                >
                  {filteredCount}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl bg-slate-200 dark:bg-[#16181F] animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#14161D] border border-slate-200 dark:border-white/5 p-8 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Tidak ada jadwal rilis untuk filter ini di hari {selectedDay}.
            </p>
            {typeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className="px-4 py-2 rounded-xl bg-[#E84A18] text-white text-xs font-bold"
              >
                Tampilkan Semua Rilis ({selectedDay})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
            {items.map((item, idx) => (
              <MediaCard
                key={`${item.type}-${item.id}-${idx}`}
                item={{
                  ...item,
                  episodeLabel: item.episodeLabel || (item.type === 'donghua' ? 'Donghua' : 'Anime'),
                  status: 'Ongoing',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
