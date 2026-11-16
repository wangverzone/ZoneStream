import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  Compass,
  Home,
  MessageCircle,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { TelegramCsButton } from './TelegramCsButton';
import { VerifiedBadge } from './VerifiedBadge';
import { StatusEmojiBadge } from './VipEmojis';
import { AvatarDecoration } from './AvatarDecoration';
import { CountryFlagBadge } from './CountryFlag';
import { HeaderSearch } from './HeaderSearch';
import { APP_LANGUAGES, UI_TRANSLATIONS, useAppLanguage } from '../utils/language';

export function Layout({
  children,
  hideBottomNav = false,
}: {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}) {
  const location = useLocation();
  const { user, isPremium } = useAuth();
  const { lang, currentLanguageOption, changeLanguage } = useAppLanguage();
  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.id;
  const [unreadChat, setUnreadChat] = useState(0);

  const desktopNavItems = [
    { to: '/', label: t.navHome, icon: Home },
    { to: '/schedule', label: t.navSchedule, icon: CalendarDays },
    { to: '/catalog', label: t.navCatalog, icon: Compass },
    { to: '/community', label: t.navCommunity, icon: Users },
    { to: '/chat', label: t.navChat, icon: MessageCircle },
  ];

  const mobileNavItems = [
    { to: '/', label: t.navHome, icon: Home },
    { to: '/catalog', label: t.navCatalog, icon: Compass },
    { to: '/community', label: t.navCommunity, icon: Users },
    { to: '/chat', label: t.navChat, icon: MessageCircle },
    { to: '/profile', label: t.navProfile, icon: UserIcon },
  ];

  const cycleLanguage = () => {
    const idx = APP_LANGUAGES.findIndex((l) => l.code === lang);
    const next = APP_LANGUAGES[(idx + 1) % APP_LANGUAGES.length];
    changeLanguage(next.code);
  };

  useEffect(() => {
    if (!user) {
      setUnreadChat(0);
      return;
    }
    let active = true;
    const checkUnread = async () => {
      try {
        const token =
          localStorage.getItem('zonestream_session_token_v1') ||
          localStorage.getItem('donghive_session_token_v1') ||
          '';
        if (!token) return;
        const res = await fetch('/api/social/conversations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (active && json.ok) {
          setUnreadChat(Number(json.totalUnread) || 0);
        }
      } catch {
        // Ignore transient poll error
      }
    };
    checkUnread();
    const timer = setInterval(checkUnread, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.uid, location.pathname]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const hasVipBadge = Boolean(user && (user.isVerified || isPremium || user.role === 'founder'));
  const showMobileTopSearchBar =
    !hideBottomNav &&
    location.pathname !== '/' &&
    !location.pathname.startsWith('/chat');

  return (
    <div className="relative min-h-screen bg-[#F5F7FB] text-slate-900 dark:bg-[#090A0E] dark:text-[#F4F5F7] flex flex-col overflow-x-clip transition-colors duration-200">
      {/* Subtle Ambient Top Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.08),_transparent_68%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(232,74,24,0.14),_transparent_68%)] z-0"
      />

      {/* Desktop Top Navigation Bar */}
      <header className="hidden lg:flex sticky top-0 z-40 items-center justify-between gap-3 xl:gap-6 px-4 xl:px-8 h-16 bg-white/90 dark:bg-[#090A0E]/85 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] transition-colors">
        <Link
          to="/"
          className="flex items-center gap-2 xl:gap-2.5 text-base xl:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <img
            src="/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif"
            alt="ZoneStream Logo"
            className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl object-cover ring-2 ring-[#E84A18]/80 shadow-lg shadow-[#E84A18]/25"
          />
          <span>ZoneStream</span>
        </Link>

        <nav className="flex items-center gap-3 xl:gap-5 2xl:gap-7 text-[13px] xl:text-sm font-medium shrink-0">
          {desktopNavItems.map((item) => {
            const active = isActive(item.to);
            const showUnread = item.to === '/chat' && unreadChat > 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1.5 transition-colors relative inline-flex items-center gap-1.5 ${
                  active
                    ? 'text-[#E84A18] font-bold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-[#9CA3AF] dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {showUnread && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-[#0B141A] text-[10px] font-extrabold flex items-center justify-center font-mono-tabular">
                    {unreadChat > 99 ? '99+' : unreadChat}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[19px] h-0.5 bg-[#E84A18] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 xl:gap-2.5 shrink-0">
          <HeaderSearch
            className="w-40 xl:w-60 2xl:w-72"
            placeholder="Cari Anime, Donghua..."
            enableGlobalShortcut
            compact
            dropdownClassName="right-0 left-auto w-[350px] xl:w-[400px]"
          />

          <button
            type="button"
            onClick={cycleLanguage}
            title={`Bahasa: ${currentLanguageOption.label} (Klik untuk ganti)`}
            className="h-10 px-2 xl:px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#13151C] dark:hover:bg-[#1B1E28] border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-gray-200 inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            <CountryFlagBadge countryCode={currentLanguageOption.countryCode} size="xs" />
            <span className="uppercase">{currentLanguageOption.code}</span>
          </button>

          <Link
            to="/library"
            aria-label="Watchlist & Riwayat"
            title="Watchlist & Riwayat"
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
              isActive('/library')
                ? 'bg-[#E84A18]/15 border-[#E84A18]/40 text-[#E84A18]'
                : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-[#13151C] dark:hover:bg-[#1B1E28] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-gray-300'
            }`}
          >
            <Bookmark className="w-4 h-4" />
          </Link>
          <TelegramCsButton />
          <ThemeToggle compact />

          <Link
            to="/profile"
            className="flex items-center gap-2 py-1.5 px-2 xl:px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#13151C] dark:hover:bg-[#1B1E28] border border-slate-200 dark:border-white/[0.08] transition-colors whitespace-nowrap shrink-0"
          >
            <AvatarDecoration
              src={user?.photoUrl}
              alt={user?.name || 'Akun'}
              decorationId={user?.activeBorder}
              size="xs"
            />
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1 xl:gap-1.5">
              <span className="max-w-[68px] xl:max-w-[115px] truncate">
                {user ? user.name : 'Masuk Akun'}
              </span>
              {hasVipBadge && (
                <VerifiedBadge
                  size="sm"
                  isFounder={user?.role === 'founder'}
                  badgeLabel={user?.activeBadge}
                />
              )}
              {user && <CountryFlagBadge countryCode={user.countryCode} size="xs" />}
              {hasVipBadge && user?.statusEmoji && (
                <StatusEmojiBadge statusEmoji={user.statusEmoji} size="xs" />
              )}
            </span>
          </Link>
        </div>
      </header>

      {/* Mobile / Tablet Compact Top Search Header (non-sticky to preserve mobile viewport) */}
      {showMobileTopSearchBar && (
        <header className="lg:hidden relative z-30 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-6 pt-3 pb-1">
          <Link
            to="/"
            aria-label="Beranda ZoneStream"
            className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl overflow-hidden ring-1 ring-[#E84A18]/60"
          >
            <img
              src="/assets/aistudio/sara_seo_pfp_6f6b2a74.jfif"
              alt="ZoneStream"
              className="w-10 h-10 object-cover"
            />
          </Link>
          <HeaderSearch
            className="flex-1 min-w-0"
            placeholder="Cari judul anime / donghua..."
            dropdownClassName="-left-12 -right-12 sm:left-0 sm:right-0"
          />
          <ThemeToggle compact />
        </header>
      )}

      {/* Main Content Container */}
      <main
        className={`relative z-10 flex-1 w-full max-w-7xl mx-auto ${
          hideBottomNav ? 'pb-8' : 'pb-24 lg:pb-12'
        }`}
      >
        {children}
      </main>

      {/* Mobile / Tablet Fixed Bottom Navigation */}
      {!hideBottomNav && (
        <nav
          aria-label="Navigasi utama"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F1117]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.06] transition-colors"
        >
          <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto">
            {mobileNavItems.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              const showUnread = item.to === '/chat' && unreadChat > 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -top-px h-10 rounded-b-full bg-gradient-to-b from-[#E84A18]/20 to-transparent pointer-events-none"
                    />
                  )}
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        active ? 'text-[#E84A18]' : 'text-slate-500 dark:text-[#6E7480]'
                      }`}
                    />
                    {showUnread && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#25D366] text-[#0B141A] text-[9px] font-extrabold flex items-center justify-center font-mono-tabular">
                        {unreadChat > 9 ? '9+' : unreadChat}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium mt-1 tracking-tight ${
                      active ? 'text-[#E84A18]' : 'text-slate-500 dark:text-[#6E7480]'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
