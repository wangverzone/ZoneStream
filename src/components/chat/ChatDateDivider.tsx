import React from 'react';

export function formatChatDateLabel(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((todayStart - targetStart) / 86400000);

  if (diffDays === 0) return 'Hari Ini';
  if (diffDays === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function isSameCalendarDay(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

interface ChatDateDividerProps {
  label: string;
  darkSurface?: boolean;
}

export const ChatDateDivider: React.FC<ChatDateDividerProps> = ({ label, darkSurface = false }) => {
  if (!label) return null;
  return (
    <div className="sticky top-2 z-10 flex justify-center my-3 pointer-events-none">
      <span
        className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm backdrop-blur-md border ${
          darkSurface
            ? 'bg-[#171B24]/90 border-white/10 text-gray-300'
            : 'bg-white/90 dark:bg-[#182229]/90 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-gray-300'
        }`}
      >
        {label}
      </span>
    </div>
  );
};
