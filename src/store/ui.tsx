import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Track } from '../api/audius'

interface MenuState {
  track: Track
  x: number
  y: number
  playlistId?: string // set when opened from one of the user's playlists
}

interface UIState {
  toast: string | null
  showToast: (msg: string) => void
  menu: MenuState | null
  openMenu: (track: Track, anchor: HTMLElement, playlistId?: string) => void
  closeMenu: () => void
  playlistPicker: Track | null
  openPlaylistPicker: (track: Track) => void
  closePlaylistPicker: () => void
  nowPlayingOpen: boolean
  setNowPlayingOpen: (open: boolean) => void
  /** Where the YouTube video should sit (e.g. Now Playing's artwork area); null = floating dock */
  videoSlot: HTMLElement | null
  setVideoSlot: (el: HTMLElement | null) => void
}

const UIContext = createContext<UIState | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [playlistPicker, setPlaylistPicker] = useState<Track | null>(null)
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const [videoSlot, setVideoSlot] = useState<HTMLElement | null>(null)
  const timer = useRef<number>(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  const openMenu = useCallback((track: Track, anchor: HTMLElement, playlistId?: string) => {
    const r = anchor.getBoundingClientRect()
    setMenu({ track, x: r.right, y: r.bottom, playlistId })
  }, [])

  const value = useMemo(
    () => ({
      toast,
      showToast,
      menu,
      openMenu,
      closeMenu: () => setMenu(null),
      playlistPicker,
      openPlaylistPicker: (t: Track) => setPlaylistPicker(t),
      closePlaylistPicker: () => setPlaylistPicker(null),
      nowPlayingOpen,
      setNowPlayingOpen,
      videoSlot,
      setVideoSlot,
    }),
    [toast, showToast, menu, openMenu, playlistPicker, nowPlayingOpen, videoSlot],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
