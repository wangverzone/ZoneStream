import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BackgroundProvider } from './context/BackgroundContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdsterraGlobalManager } from './components/AdsterraAds';
import { BackgroundCustomizerModal } from './components/BackgroundCustomizerModal';
import { PageTransition } from './components/PageTransition';
import { HomePage } from './pages/HomePage';

const SchedulePage = lazy(() =>
  import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage }))
);
const CatalogPage = lazy(() =>
  import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage }))
);
const LibraryPage = lazy(() =>
  import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const EditProfilePage = lazy(() =>
  import('./pages/EditProfilePage').then((m) => ({ default: m.EditProfilePage }))
);
const DetailPage = lazy(() =>
  import('./pages/DetailPage').then((m) => ({ default: m.DetailPage }))
);
const WatchPage = lazy(() =>
  import('./pages/WatchPage').then((m) => ({ default: m.WatchPage }))
);
const CommunityPage = lazy(() =>
  import('./pages/CommunityPage').then((m) => ({ default: m.CommunityPage }))
);
const PublicProfilePage = lazy(() =>
  import('./pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage }))
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then((m) => ({ default: m.ChatPage }))
);
const LeaderboardPage = lazy(() =>
  import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F5F7FB] dark:bg-[#090A0E] text-slate-600 dark:text-gray-300">
      <div className="w-10 h-10 rounded-2xl border-2 border-[#E84A18]/25 border-t-[#E84A18] animate-spin" />
      <p className="text-xs font-bold tracking-wide text-slate-500 dark:text-gray-400">
        Memuat ZoneStream...
      </p>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BackgroundProvider>
        <AuthProvider>
          <BrowserRouter>
            <AdsterraGlobalManager />
            <BackgroundCustomizerModal />
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
                <Route path="/schedule" element={<PageTransition><SchedulePage /></PageTransition>} />
                <Route path="/catalog" element={<PageTransition><CatalogPage /></PageTransition>} />
                <Route path="/library" element={<PageTransition><LibraryPage /></PageTransition>} />
                <Route path="/community" element={<PageTransition><CommunityPage /></PageTransition>} />
                <Route path="/leaderboard" element={<PageTransition><LeaderboardPage /></PageTransition>} />
                <Route path="/ranking" element={<PageTransition><LeaderboardPage /></PageTransition>} />
                <Route path="/clan/join/:inviteCode" element={<PageTransition><LeaderboardPage /></PageTransition>} />
                <Route path="/users" element={<PageTransition><CommunityPage /></PageTransition>} />
                <Route path="/u/:uid" element={<PageTransition><PublicProfilePage /></PageTransition>} />
                <Route path="/user/:uid" element={<PageTransition><PublicProfilePage /></PageTransition>} />
                <Route path="/chat" element={<PageTransition><ChatPage /></PageTransition>} />
                <Route path="/chat/:peerUid" element={<PageTransition><ChatPage /></PageTransition>} />
                <Route path="/login" element={<PageTransition><ProfilePage /></PageTransition>} />
                <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
                <Route path="/profile/edit" element={<PageTransition><EditProfilePage /></PageTransition>} />
                <Route path="/detail/:type/:id" element={<PageTransition><DetailPage /></PageTransition>} />
                <Route path="/watch/:type/:episodeId" element={<PageTransition><WatchPage /></PageTransition>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </BackgroundProvider>
    </ThemeProvider>
  );
}
