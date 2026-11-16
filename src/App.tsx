import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdsterraGlobalManager } from './components/AdsterraAds';
import { PageTransition } from './components/PageTransition';
import { HomePage } from './pages/HomePage';
import { SchedulePage } from './pages/SchedulePage';
import { CatalogPage } from './pages/CatalogPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { DetailPage } from './pages/DetailPage';
import { WatchPage } from './pages/WatchPage';
import { CommunityPage } from './pages/CommunityPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { ChatPage } from './pages/ChatPage';
import { LeaderboardPage } from './pages/LeaderboardPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AdsterraGlobalManager />
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
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
