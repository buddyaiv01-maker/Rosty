import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import PublicLayout from "./layouts/PublicLayout";
import Dashboard from "./pages/Dashboard";
import Movies from "./pages/Movies";
import TVShows from "./pages/TVShows";
import ShowDetail from "./pages/ShowDetail";
import Settings from "./pages/Settings";
import HeroBanner from "./pages/HeroBanner";
import Scan from "./pages/Scan";
import Home from "./pages/public/Home";
import BrowseMovies from "./pages/public/BrowseMovies";
import BrowseShows from "./pages/public/BrowseShows";
import Search from "./pages/public/Search";
import MovieDetailPublic from "./pages/public/MovieDetail";
import ShowDetailPublic from "./pages/public/ShowDetail";
import WatchlistPage from "./pages/public/Watchlist";
import AccountSettings from "./pages/public/AccountSettings";
import Player from "./pages/public/Player";
import { AuthGate } from "./pages/auth/AuthGate";
import { ProfileGate } from "./pages/profiles/ProfileGate";
import { AuthProvider } from "./state/AuthContext";
import { LibraryProvider } from "./state/LibraryContext";
import { ProfileProvider } from "./state/ProfileContext";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate>
          <ProfileProvider>
            <ProfileGate>
              <LibraryProvider>
                <Routes>
                  <Route path="/" element={<PublicLayout />}>
                    <Route index element={<Home />} />
                    <Route path="movies" element={<BrowseMovies />} />
                    <Route path="tv-shows" element={<BrowseShows />} />
                    <Route path="search" element={<Search />} />
                    <Route path="movie/:id" element={<MovieDetailPublic />} />
                    <Route path="show/:id" element={<ShowDetailPublic />} />
                    <Route path="watchlist" element={<WatchlistPage />} />
                    <Route path="settings" element={<AccountSettings />} />
                  </Route>
                  <Route path="/watch/:kind/:id" element={<Player />} />

                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="movies" element={<Movies />} />
                    <Route path="tv-shows" element={<TVShows />} />
                    <Route path="tv-shows/:id" element={<ShowDetail />} />
                    <Route path="scan" element={<Scan />} />
                    <Route path="hero-banner" element={<HeroBanner />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </LibraryProvider>
            </ProfileGate>
          </ProfileProvider>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
