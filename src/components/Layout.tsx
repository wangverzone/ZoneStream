import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  Clock,
  Compass,
  Home,
  Layers,
  MessageCircle,
  Settings,
  ShieldAlert,
  Trophy,
  User as UserIcon,
  Users,
  X,
  Gift,
  Sparkles,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { BackdropToggle } from './BackdropToggle';
import { GlobalBackdropLayer } from './GlobalBackdropLayer';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';
import { TelegramCsButton } from './TelegramCsButton';
import { VerifiedBadge } from './VerifiedBadge';
import { StatusEmojiBadge } from './VipEmojis';
import { AvatarDecoration } from './AvatarDecoration';
import { CountryFlagBadge } from './CountryFlag';
import { HeaderSearch } from './HeaderSearch';
import { NotificationBell } from './NotificationBell';
import { DailyRewardModal } from './DailyRewardModal';
import { APP_LANGUAGES, UI_TRANSLATIONS, useAppLanguage } from '../utils/language';
import { playSoundEffect } from '../utils/soundEffects';

export function Layout({
  children,
  hideBottomNav = false,
}: {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}) {
  const location = useLocation();
  const { user, isPremium, authError, clearAuthError } = useAuth();
  const { lang, currentLanguageOption, changeLanguage } = useAppLanguage();
  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.id;
  const [unreadChat, setUnreadChat] = useState(0);
  const [showQuickGearMenu, setShowQuickGearMenu] = useState(false);
  const prevUnreadChatRef = useRef<{ uid: string; count: number } | null>(null);

  const desktopNavItems = [
    { to: '/', label: t.navHome, icon: Home },
    { to: '/schedule', label: t.navSchedule, icon: CalendarDays },
    { to: '/catalog', label: t.navCatalog, icon: Compass },
    { to: '/community', label: t.navCommunity, icon: Users },
    { to: '/chat', label: t.navChat, icon: MessageCircle },
  ];

  const mobileNavItems = [
    { to: '/', label: 'Home', icon: Home, isAvatar: false },
    { to: '/schedule', label: 'Jadwal', icon: CalendarDays, isAvatar: false },
    { to: '/library', label: 'Riwayat', icon: Clock, isAvatar: false },
    { to: '/catalog', label: 'Katalog', icon: Layers, isAvatar: false },
    { to: '/profile', label: 'Profil', icon: UserIcon, isAvatar: true },
  ];

  const cycleLanguage = () => {
    const idx = APP_LANGUAGES.findIndex((l) => l.code === lang);
    const next = APP_LANGUAGES[(idx + 1) % APP_LANGUAGES.length];
    changeLanguage(next.code);
  };

  useEffect(() => {
    setShowQuickGearMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setUnreadChat(0);
      prevUnreadChatRef.current = null;
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
          const nextUnread = Number(json.totalUnread) || 0;
          const prev = prevUnreadChatRef.current;
          if (
            prev &&
            prev.uid === user.uid &&
            nextUnread > prev.count &&
            !location.pathname.startsWith('/chat')
          ) {
            playSoundEffect('chat');
          }
          prevUnreadChatRef.current = { uid: user.uid, count: nextUnread };
          setUnreadChat(nextUnread);
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
    !location.pathname.startsWith('/chat') &&
    !location.pathname.startsWith('/profile');

  return (
    <div className="relative min-h-screen bg-[#0D0E12] text-[#F4F5F7] flex flex-col overflow-x-clip transition-colors duration-200">
      <GlobalBackdropLayer />
      <OfflineIndicator />

      {/* Real-time Ban Alert Banner */}
      {!user && authError && authError.toLowerCase().includes('dibanned') && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-md px-4 py-3 rounded-2xl bg-rose-950/95 border border-rose-500/60 text-rose-100 shadow-2xl backdrop-blur-md flex items-center gap-3"
        >
          <span className="w-8 h-8 rounded-xl bg-rose-500/25 border border-rose-400/50 text-rose-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <p className="text-xs sm:text-sm font-bold leading-snug flex-1">{authError}</p>
          <button
            type="button"
            onClick={clearAuthError}
            aria-label="Tutup peringatan"
            className="text-rose-300 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop Top Navigation Bar */}
      <header className="hidden lg:flex sticky top-0 z-40 items-center justify-between gap-3 xl:gap-6 px-4 xl:px-8 h-16 bg-[#0D0E12]/90 backdrop-blur-xl border-b border-white/[0.06] transition-colors">
        <Link
          to="/"
          className="flex items-center gap-2 xl:gap-2.5 text-base xl:text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <img
            src="/assets/aistudio/1089871178568589499_751994dc.jfif"
            alt="ZoneStream Logo"
            className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl object-cover ring-2 ring-[#2E90FA]/80 shadow-lg"
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
                  active ? 'text-[#2E90FA] font-bold' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {showUnread && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center font-mono-tabular">
                    {unreadChat > 99 ? '99+' : unreadChat}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[19px] h-0.5 bg-[#2E90FA] rounded-full" />
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
            className="h-10 px-2 xl:px-2.5 rounded-xl bg-[#161820] hover:bg-[#1E212B] border border-white/[0.08] text-xs font-bold text-gray-200 inline-flex items-center gap-1.5 transition-colors shrink-0"
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
                ? 'bg-[#2E90FA]/15 border-[#2E90FA]/40 text-[#2E90FA]'
                : 'bg-[#161820] hover:bg-[#1E212B] border-white/[0.08] text-gray-300'
            }`}
          >
            <Bookmark className="w-4 h-4" />
          </Link>
          <NotificationBell />
          <PWAInstallButton variant="compact" />
          <TelegramCsButton />
          <BackdropToggle compact />
          <ThemeToggle compact />

          <Link
            to="/profile"
            className="flex items-center gap-2 py-1.5 px-2 xl:px-3 rounded-xl bg-[#161820] hover:bg-[#1E212B] border border-white/[0.08] transition-colors whitespace-nowrap shrink-0"
          >
            <AvatarDecoration
              src={user?.photoUrl}
              alt={user?.name || 'Akun'}
              decorationId={user?.activeBorder}
              level={user?.level}
              isFounder={user?.role === 'founder'}
              size="xs"
            />
            <span className="text-xs font-bold text-white flex items-center gap-1 xl:gap-1.5">
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

      {/* Mobile Compact Header on Secondary Pages */}
      {showMobileTopSearchBar && (
        <header className="lg:hidden relative z-30 flex items-center gap-2.5 px-3.5 pt-3 pb-1">
          <Link
            to="/"
            aria-label="Beranda ZoneStream"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl overflow-hidden border border-white/10 bg-[#161820]"
          >
            <img
              src="/assets/aistudio/1089871178568589499_751994dc.jfif"
              alt="ZoneStream"
              className="w-full h-full object-cover"
            />
          </Link>
          <HeaderSearch
            className="flex-1 min-w-0"
            placeholder="Cari Anime Di Sini..."
            dropdownClassName="-left-10 -right-10 sm:left-0 sm:right-0"
          />
          <NotificationBell compact />
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

      {/* Floating White Gear FAB (Matches Reference Screenshot) */}
      {!hideBottomNav && !location.pathname.startsWith('/chat') && (
        <>
          <button
            type="button"
            onClick={() => setShowQuickGearMenu((prev) => !prev)}
            aria-label="Menu Cepat & Pengaturan"
            className="lg:hidden fixed right-4 bottom-20 z-40 w-13 h-13 rounded-full bg-white text-[#0E1015] shadow-[0_10px_30px_rgba(0,0,0,0.65)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <Settings
              className={`w-6 h-6 stroke-[2.2] transition-transform duration-300 ${
                showQuickGearMenu ? 'rotate-90' : ''
              }`}
            />
            {unreadChat > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-[#0D0E12]">
                {unreadChat > 9 ? '9+' : unreadChat}
              </span>
            )}
          </button>

          {showQuickGearMenu && (
            <div
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-3 pb-20"
              onClick={() => setShowQuickGearMenu(false)}
            >
              <div
                className="w-full max-w-md rounded-3xl bg-[#161820] border border-white/10 p-4 shadow-2xl space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <span className="text-sm font-extrabold text-white">Menu Pintasan & Pengaturan</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickGearMenu(false)}
                    className="w-8 h-8 rounded-full bg-white/[0.07] text-gray-300 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <Link
                    to="/chat"
                    onClick={() => setShowQuickGearMenu(false)}
                    className="p-2.5 rounded-2xl bg-[#1E212B] hover:bg-[#262A36] border border-white/[0.07] flex flex-col items-center gap-1.5 text-center relative"
                  >
                    <MessageCircle className="w-4 h-4 text-sky-400" />
                    <span className="text-[10px] font-bold text-white">Pesan</span>
                    {unreadChat > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                        {unreadChat}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/profile?tab=settings&section=features"
                    onClick={() => setShowQuickGearMenu(false)}
                    className="p-2.5 rounded-2xl bg-[#1E212B] hover:bg-[#262A36] border border-white/[0.07] flex flex-col items-center gap-1.5 text-center"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold text-white">Aktivitas</span>
                  </Link>
                  <Link
                    to="/leaderboard"
                    onClick={() => setShowQuickGearMenu(false)}
                    className="p-2.5 rounded-2xl bg-[#1E212B] hover:bg-[#262A36] border border-white/[0.07] flex flex-col items-center gap-1.5 text-center"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold text-white">Top Rank</span>
                  </Link>
                  <Link
                    to="/community"
                    onClick={() => setShowQuickGearMenu(false)}
                    className="p-2.5 rounded-2xl bg-[#1E212B] hover:bg-[#262A36] border border-white/[0.07] flex flex-col items-center gap-1.5 text-center"
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-bold text-white">Komunitas</span>
                  </Link>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <ThemeToggle compact />
                    <BackdropToggle compact />
                    <TelegramCsButton />
                    <PWAInstallButton variant="compact" />
                  </div>
                  <button
                    type="button"
                    onClick={cycleLanguage}
                    className="h-9 px-3 rounded-xl bg-[#1E212B] border border-white/[0.08] text-xs font-bold text-white inline-flex items-center gap-1.5"
                  >
                    <CountryFlagBadge countryCode={currentLanguageOption.countryCode} size="xs" />
                    <span className="uppercase">{currentLanguageOption.code}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mobile / Tablet Fixed Bottom Navigation (Clean 5-Icon Bar Matching Screenshot) */}
      {!hideBottomNav && (
        <nav
          aria-label="Navigasi utama"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0E12]/98 backdrop-blur-xl border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-2">
            {mobileNavItems.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-col items-center justify-center min-h-[48px] h-full active:scale-95 transition-all"
                >
                  {item.isAvatar ? (
                    <div
                      className={`w-7 h-7 rounded-full overflow-hidden p-[1.5px] transition-all ${
                        active ? 'ring-2 ring-white' : 'ring-1 ring-white/35 opacity-85'
                      }`}
                    >
                      <img
                        src={user?.photoUrl || '/assets/aistudio/1089871178568589499_751994dc.jfif'}
                        alt={user?.name || 'Profil'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  ) : active ? (
                    <>
                      <span className="px-4 py-1 rounded-full bg-[#2E303E] text-white flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-bold text-white mt-0.5 leading-none">
                        {item.label}
                      </span>
                    </>
                  ) : (
                    <Icon className="w-5 h-5 text-gray-300/85 hover:text-white transition-colors" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <DailyRewardModal />
    </div>
  );
}
