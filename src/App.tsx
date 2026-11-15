import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdsterraGlobalManager } from './components/AdsterraAds';
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AdsterraGlobalManager />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/users" element={<CommunityPage />} />
            <Route path="/u/:uid" element={<PublicProfilePage />} />
            <Route path="/user/:uid" element={<PublicProfilePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:peerUid" element={<ChatPage />} />
            <Route path="/login" element={<ProfilePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/detail/:type/:id" element={<DetailPage />} />
            <Route path="/watch/:type/:episodeId" element={<WatchPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
