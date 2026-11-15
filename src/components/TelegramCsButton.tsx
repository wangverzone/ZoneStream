const TELEGRAM_CS_URL = 'https://t.me/ZhuuVerzon';

export function TelegramCsButton({
  floating = false,
  className = '',
}: {
  floating?: boolean;
  className?: string;
}) {
  return (
    <a
      href={TELEGRAM_CS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Customer Service Telegram"
      title="Customer Service"
      className={
        floating
          ? `fixed bottom-20 right-4 z-40 lg:hidden w-12 h-12 rounded-full bg-[#229ED9] hover:bg-[#1E8EC5] text-white flex items-center justify-center shadow-xl shadow-[#229ED9]/35 ring-2 ring-white/25 transition-transform active:scale-95 ${className}`
          : `w-10 h-10 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9] text-[#229ED9] hover:text-white border border-[#229ED9]/30 flex items-center justify-center transition-colors shrink-0 ${className}`
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={floating ? 'w-6 h-6 -ml-0.5' : 'w-5 h-5 -ml-0.5'}
        aria-hidden="true"
      >
        <path d="M21.944 4.104a1.15 1.15 0 0 0-1.18-.156L2.77 11.425c-.864.359-.814 1.601.076 1.889l4.527 1.464 1.75 5.477a1 1 0 0 0 1.675.398l2.587-2.662 4.928 3.63c.723.532 1.756.143 1.946-.733l3.186-14.703a1.15 1.15 0 0 0-.501-1.081ZM9.45 14.375l8.88-6.415-6.98 7.503-.31 3.214-1.364-4.268-3.822-1.236 12.16-5.054-8.564 6.256Z" />
      </svg>
    </a>
  );
}
