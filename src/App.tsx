import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ArtistPage } from './pages/Artist'
import { BrowsePage } from './pages/Browse'
import { CollectionPage } from './pages/Collection'
import { GenrePage } from './pages/Genre'
import { HomePage } from './pages/Home'
import { LibraryPage, LikedPage, MyPlaylistPage } from './pages/Library'
import { NotFound } from './pages/NotFound'
import { PlaylistPage } from './pages/Playlist'
import { SearchPage } from './pages/Search'
import { SingerPage } from './pages/Singer'
import { LibraryProvider } from './store/library'
import { PlayerProvider } from './store/player'
import { UIProvider } from './store/ui'

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LibraryProvider>
        <PlayerProvider>
          <UIProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="browse" element={<BrowsePage />} />
                <Route path="genre/:name" element={<GenrePage />} />
                <Route path="mood/:name" element={<GenrePage mood />} />
                <Route path="india/:slug" element={<CollectionPage />} />
                <Route path="singer/:slug" element={<SingerPage />} />
                <Route path="artist/:id" element={<ArtistPage />} />
                <Route path="playlist/:id" element={<PlaylistPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="liked" element={<LikedPage />} />
                <Route path="my/:id" element={<MyPlaylistPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </UIProvider>
        </PlayerProvider>
      </LibraryProvider>
    </BrowserRouter>
  )
}
