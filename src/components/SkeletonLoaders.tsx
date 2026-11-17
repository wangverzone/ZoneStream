import React from 'react';

interface SkeletonBlockProps {
  className?: string;
  delayMs?: number;
}

export function SkeletonBlock({ className = '', delayMs = 0 }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      style={{ '--skeleton-delay': `${delayMs}ms` } as React.CSSProperties}
      className={`skeleton-shimmer bg-slate-200/90 dark:bg-[#1E222E] ${className}`}
    />
  );
}

export function MediaCardSkeleton({ index = 0 }: { index?: number }) {
  const delayMs = (index % 6) * 75;

  return (
    <div
      aria-hidden="true"
      style={{ '--skeleton-delay': `${delayMs}ms` } as React.CSSProperties}
      className="skeleton-shimmer relative block rounded-xl overflow-hidden aspect-[3/4] bg-slate-200/80 dark:bg-[#141720] border border-slate-200/90 dark:border-white/[0.07] shadow-sm"
    >
      {/* Top Row Badges */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-10">
        <div className="h-4 w-12 rounded bg-slate-300/85 dark:bg-white/[0.09]" />
        <div className="h-4 w-10 rounded bg-slate-300/85 dark:bg-white/[0.09]" />
      </div>

      {/* Subtle Center Poster Silhouette */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-slate-300/50 dark:bg-white/[0.04] border border-slate-300/60 dark:border-white/[0.06]" />
      </div>

      {/* Bottom Scrim & Metadata Lines */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 pt-10 bg-gradient-to-t from-slate-300/85 via-slate-300/35 to-transparent dark:from-[#090A0F]/95 dark:via-[#090A0F]/70 dark:to-transparent z-10 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-14 rounded bg-slate-400/50 dark:bg-[#E84A18]/25" />
          <div className="h-3.5 w-16 rounded bg-slate-400/35 dark:bg-white/[0.08]" />
        </div>
        <div className="h-3 w-[88%] rounded bg-slate-400/60 dark:bg-white/[0.14]" />
        <div className="h-3 w-[58%] rounded bg-slate-400/45 dark:bg-white/[0.09]" />
      </div>
    </div>
  );
}

export function MediaGridSkeleton({
  count = 12,
  label = 'Memuat daftar konten...',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <MediaCardSkeleton key={`skel-card-${idx}`} index={idx} />
        ))}
      </div>
    </div>
  );
}

export function HeroShowcaseSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat sorotan unggulan..."
      className="relative w-full h-[370px] sm:h-[430px] lg:h-[490px] rounded-3xl overflow-hidden bg-slate-200/85 dark:bg-[#11131B] border border-slate-200 dark:border-white/[0.09] shadow-lg"
    >
      <span className="sr-only">Memuat sorotan unggulan...</span>

      {/* Ambient Shimmer Surface */}
      <div className="skeleton-shimmer absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-[#161924] dark:via-[#11131B] dark:to-[#0C0E14]" />

      {/* Scrim Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-300/75 via-transparent to-transparent dark:from-[#090A0E]/90 dark:via-[#090A0E]/35 dark:to-transparent pointer-events-none" />

      {/* Top Editorial Badges */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center gap-2.5 z-10">
        <SkeletonBlock className="h-6 w-24 rounded-lg bg-[#E84A18]/25 dark:bg-[#E84A18]/20" delayMs={0} />
        <SkeletonBlock className="h-6 w-20 rounded-lg" delayMs={80} />
        <SkeletonBlock className="h-6 w-16 rounded-lg hidden sm:block" delayMs={160} />
      </div>

      {/* Key-Art Framed Poster Silhouette (Tablet/Desktop) */}
      <div className="hidden sm:block absolute right-6 lg:right-[268px] top-7 bottom-9 aspect-[3/4] rounded-2xl overflow-hidden border border-white/25 dark:border-white/10 shadow-xl z-10">
        <SkeletonBlock className="w-full h-full rounded-none" delayMs={120} />
      </div>

      {/* Right Thumbnail Switcher Rail Skeleton (Desktop lg:) */}
      <div className="hidden lg:flex flex-col gap-2 absolute right-5 top-1/2 -translate-y-1/2 z-10 w-56">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={`hero-rail-${idx}`}
            className={`flex items-center gap-2.5 p-1.5 rounded-xl border ${
              idx === 0
                ? 'bg-white/60 dark:bg-[#E84A18]/10 border-[#E84A18]/40'
                : 'bg-white/40 dark:bg-black/40 border-slate-300/60 dark:border-white/10'
            }`}
          >
            <SkeletonBlock className="w-9 h-12 rounded-lg shrink-0" delayMs={idx * 70} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <SkeletonBlock className="h-3 w-4/5 rounded" delayMs={idx * 70 + 30} />
              <SkeletonBlock className="h-2.5 w-3/5 rounded" delayMs={idx * 70 + 60} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Left Title, Metadata & Action Buttons */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7 lg:p-9 max-w-xl lg:max-w-2xl z-10 space-y-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 sm:h-9 w-4/5 rounded-xl" delayMs={60} />
          <SkeletonBlock className="h-6 sm:h-8 w-3/5 rounded-xl hidden sm:block" delayMs={120} />
        </div>

        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-4 w-12 rounded" delayMs={140} />
          <SkeletonBlock className="h-4 w-16 rounded" delayMs={180} />
          <SkeletonBlock className="h-4 w-24 rounded hidden sm:block" delayMs={220} />
        </div>

        <div className="space-y-1.5 max-w-lg">
          <SkeletonBlock className="h-3.5 w-full rounded" delayMs={180} />
          <SkeletonBlock className="h-3.5 w-4/5 rounded" delayMs={240} />
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 pt-1">
          <SkeletonBlock
            className="h-11 w-40 sm:w-44 rounded-xl bg-[#E84A18]/25 dark:bg-[#E84A18]/25"
            delayMs={100}
          />
          <SkeletonBlock className="h-11 w-24 sm:w-28 rounded-xl" delayMs={160} />
          <SkeletonBlock className="h-11 w-11 sm:w-28 rounded-xl" delayMs={220} />
        </div>
      </div>
    </div>
  );
}

export function TrendingRankRailSkeleton() {
  return (
    <section aria-hidden="true" className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <SkeletonBlock className="h-6 w-52 rounded-lg" />
        <SkeletonBlock className="h-4 w-16 rounded" delayMs={80} />
      </div>
      <div className="flex gap-3.5 overflow-hidden pb-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={`trend-skel-${idx}`} className="flex items-end shrink-0 w-36 sm:w-44">
            <span
              className="text-6xl sm:text-7xl font-black leading-none text-slate-300/70 dark:text-white/[0.08] select-none -mr-4 z-10 font-mono-tabular"
            >
              {idx + 1}
            </span>
            <div className="flex-1">
              <MediaCardSkeleton index={idx} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HorizontalSectionSkeleton({
  titleWidthClass = 'w-44',
  count = 6,
}: {
  titleWidthClass?: string;
  count?: number;
}) {
  return (
    <section aria-hidden="true" className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <SkeletonBlock className={`h-6 ${titleWidthClass} rounded-lg`} />
        <SkeletonBlock className="h-4 w-20 rounded" delayMs={80} />
      </div>
      <div className="flex gap-3 overflow-hidden pb-1">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={`horiz-skel-${idx}`} className="w-32 sm:w-40 shrink-0">
            <MediaCardSkeleton index={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TopClanSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={`clan-skel-${idx}`}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5"
        >
          <SkeletonBlock className="w-12 h-12 rounded-2xl shrink-0 bg-white/10 dark:bg-white/10" delayMs={idx * 80} />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-3/4 rounded bg-white/15 dark:bg-white/10" delayMs={idx * 80 + 40} />
            <SkeletonBlock className="h-3 w-1/2 rounded bg-amber-400/20 dark:bg-amber-400/15" delayMs={idx * 80 + 80} />
            <SkeletonBlock className="h-2.5 w-2/3 rounded bg-white/10 dark:bg-white/10" delayMs={idx * 80 + 120} />
          </div>
        </div>
      ))}
    </div>
  );
}
