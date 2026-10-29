import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Track } from '../api/audius'

// Everything lives in localStorage: no account, no server, no tracking.
export interface UserPlaylist {
  id: string
  name: string
  tracks: Track[]
  createdAt: number
}

interface LibraryState {
  liked: Track[]
  recent: Track[]
  playlists: UserPlaylist[]
  isLiked: (id: string) => boolean
  toggleLike: (track: Track) => void
  addRecent: (track: Track) => void
  clearRecent: () => void
  createPlaylist: (name: string, firstTrack?: Track) => UserPlaylist
  deletePlaylist: (id: string) => void
  renamePlaylist: (id: string, name: string) => void
  addToPlaylist: (playlistId: string, track: Track) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
}

const LibraryContext = createContext<LibraryState | null>(null)

function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [key, value])
  return [value, setValue] as const
}

const MAX_RECENT = 60

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = usePersistent<Track[]>('tunely.liked', [])
  const [recent, setRecent] = usePersistent<Track[]>('tunely.recent', [])
  const [playlists, setPlaylists] = usePersistent<UserPlaylist[]>('tunely.playlists', [])

  const likedIds = useMemo(() => new Set(liked.map((t) => t.id)), [liked])

  const isLiked = useCallback((id: string) => likedIds.has(id), [likedIds])

  const toggleLike = useCallback(
    (track: Track) =>
      setLiked((prev) => (prev.some((t) => t.id === track.id) ? prev.filter((t) => t.id !== track.id) : [track, ...prev])),
    [setLiked],
  )

  const addRecent = useCallback(
    (track: Track) => setRecent((prev) => [track, ...prev.filter((t) => t.id !== track.id)].slice(0, MAX_RECENT)),
    [setRecent],
  )

  const clearRecent = useCallback(() => setRecent([]), [setRecent])

  const createPlaylist = useCallback(
    (name: string, firstTrack?: Track) => {
      const playlist: UserPlaylist = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        name: name.trim() || 'My playlist',
        tracks: firstTrack ? [firstTrack] : [],
        createdAt: Date.now(),
      }
      setPlaylists((prev) => [playlist, ...prev])
      return playlist
    },
    [setPlaylists],
  )

  const deletePlaylist = useCallback((id: string) => setPlaylists((prev) => prev.filter((p) => p.id !== id)), [setPlaylists])

  const renamePlaylist = useCallback(
    (id: string, name: string) => setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p))),
    [setPlaylists],
  )

  const addToPlaylist = useCallback(
    (playlistId: string, track: Track) =>
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId && !p.tracks.some((t) => t.id === track.id) ? { ...p, tracks: [...p.tracks, track] } : p,
        ),
      ),
    [setPlaylists],
  )

  const removeFromPlaylist = useCallback(
    (playlistId: string, trackId: string) =>
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p)),
      ),
    [setPlaylists],
  )

  const value = useMemo(
    () => ({
      liked,
      recent,
      playlists,
      isLiked,
      toggleLike,
      addRecent,
      clearRecent,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      removeFromPlaylist,
    }),
    [liked, recent, playlists, isLiked, toggleLike, addRecent, clearRecent, createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
