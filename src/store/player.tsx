import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { streamUrl, type Track } from '../api/audius'
import { trustedGenre } from '../lib/features'
import { isEarlySkip, listening } from '../lib/history'
import { upNext } from '../lib/recommend'
import { youtubeMedia, type YouTubeMedia } from '../lib/youtubePlayer'
import { useLibrary } from './library'

export type RepeatMode = 'off' | 'all' | 'one'

type Media = HTMLAudioElement | YouTubeMedia

interface PlayerState {
  queue: Track[]
  index: number
  current: Track | null
  isPlaying: boolean
  isLoading: boolean
  shuffle: boolean
  repeat: RepeatMode
  autoplay: boolean
  volume: number
  muted: boolean
  error: string | null
  /** Recommendations are being picked for the queue */
  suggesting: boolean
  /** Why each recommended song in the queue was picked, by track id */
  reasons: Record<string, string>
  playQueue: (tracks: Track[], startIndex?: number) => void
  playTrack: (track: Track, context?: Track[]) => void
  /** Plays `track`, then songs recommended from it (like a radio station) instead of the list it was in */
  startRadio: (track: Track) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  jumpTo: (index: number) => void
  playNext: (track: Track) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleAutoplay: () => void
}

interface ProgressState {
  time: number
  duration: number
  buffered: number
}

const PlayerContext = createContext<PlayerState | null>(null)
// Progress updates several times a second, so it gets its own context to keep re-renders cheap
const ProgressContext = createContext<ProgressState>({ time: 0, duration: 0, buffered: 0 })

const SAVED_KEY = 'tunely.player'

interface Saved {
  queue: Track[]
  index: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  autoplay: boolean
}

function loadSaved(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const saved = useRef(loadSaved()).current
  const { addRecent, recent, liked, playlists } = useLibrary()

  const audioRef = useRef<HTMLAudioElement>(null as unknown as HTMLAudioElement)
  if (!audioRef.current) {
    audioRef.current = new Audio()
    // Only fetch metadata until the user presses play (saves mobile data on startup)
    audioRef.current.preload = 'metadata'
  }
  const audio = audioRef.current
  // Audius tracks play in the <audio> element, YouTube tracks in the embedded player
  const mediaFor = (t: Track | null | undefined): Media => (t?.source === 'youtube' ? youtubeMedia : audio)
  const activeRef = useRef<Media>(mediaFor(saved.queue?.[saved.index ?? 0]))

  const [queue, setQueue] = useState<Track[]>(saved.queue ?? [])
  const [index, setIndex] = useState(saved.index ?? 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [shuffle, setShuffle] = useState(saved.shuffle ?? false)
  const [repeat, setRepeat] = useState<RepeatMode>(saved.repeat ?? 'off')
  const [autoplay, setAutoplay] = useState(saved.autoplay ?? true)
  const [volume, setVolumeState] = useState(saved.volume ?? 0.9)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressState>({ time: 0, duration: 0, buffered: 0 })
  const [suggesting, setSuggesting] = useState(false)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const current = queue[index] ?? null
  const loadedId = useRef<string | null>(null)
  const wantPlay = useRef(false)
  // Bumped whenever a new queue starts, so suggestions for the old one are thrown away
  const queueGen = useRef(0)
  // The in-flight suggestions request, shared so pressing Next during a prefetch waits for it
  const fetchingMore = useRef<{ gen: number; promise: Promise<boolean> } | null>(null)
  const retriedId = useRef<string | null>(null)
  // Seconds heard of the current song, to tell a skip from a song you listened to
  const heard = useRef(0)

  // Keep latest values reachable from audio event handlers
  const live = useRef({ queue, index, repeat, autoplay, recent, liked, playlists })
  live.current = { queue, index, repeat, autoplay, recent, liked, playlists }

  // Persist player state so the app resumes where you left off
  useEffect(() => {
    const data: Saved = { queue: queue.slice(0, 200), index, volume, shuffle, repeat, autoplay }
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }, [queue, index, volume, shuffle, repeat, autoplay])

  useEffect(() => {
    for (const m of [audio, youtubeMedia]) {
      m.volume = volume
      m.muted = muted
    }
  }, [audio, volume, muted])

  // Load the current track into its player whenever it changes
  useEffect(() => {
    if (!current) {
      activeRef.current.removeAttribute('src')
      loadedId.current = null
      return
    }
    if (loadedId.current === current.id) return
    loadedId.current = current.id
    retriedId.current = null
    heard.current = 0
    setError(null)
    setProgress({ time: 0, duration: current.duration, buffered: 0 })
    const media = mediaFor(current)
    if (media !== activeRef.current) {
      // Switching between Audius and YouTube: silence the other player
      activeRef.current.pause()
      activeRef.current.removeAttribute('src')
      activeRef.current = media
      setIsPlaying(false)
    }
    media.src = current.source === 'youtube' ? current.youtubeId! : streamUrl(current.id)
    if (wantPlay.current) {
      setIsLoading(true)
      media.play().catch(() => setIsLoading(false))
      addRecent(current)
      listening.played(current)
    }
  }, [audio, current, addRecent])

  /** Append recommended songs (seeded by the current one) to the queue so music never stops. */
  const extendWithSuggestions = useCallback((): Promise<boolean> => {
    const gen = queueGen.current
    if (fetchingMore.current?.gen === gen) return fetchingMore.current.promise
    const { queue: q, index: i, recent: r, liked: l, playlists: p } = live.current
    const seed = q[i]
    if (!seed) return Promise.resolve(false)
    setSuggesting(true)
    const promise = upNext({
      seed,
      session: q.slice(Math.max(0, i - 5), i),
      avoid: [...q, ...r.slice(0, 30)],
      liked: l,
      recent: r,
      playlists: p,
    })
      .then((picks) => {
        // A new queue started meanwhile
        if (gen !== queueGen.current) return false
        const queued = new Set(live.current.queue.map((t) => t.id))
        const fresh = picks.filter((x) => !queued.has(x.track.id))
        const more = fresh.map((x) => x.track)
        if (more.length) {
          // Update the live copy right away so next() sees the new songs before React re-renders
          live.current.queue = [...live.current.queue, ...more]
          setQueue((prev) => [...prev, ...more])
          setReasons((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((x) => [x.track.id, x.reason])) }))
        }
        return more.length > 0
      })
      .catch(() => false)
      .finally(() => {
        if (fetchingMore.current?.promise !== promise) return
        fetchingMore.current = null
        setSuggesting(false)
      })
    fetchingMore.current = { gen, promise }
    return promise
  }, [])

  /** Forget suggestions meant for the previous queue. */
  const startNewQueue = useCallback(() => {
    queueGen.current++
    fetchingMore.current = null
    setSuggesting(false)
    setReasons({})
  }, [])

  const goTo = useCallback((i: number) => {
    wantPlay.current = true
    setIndex(i)
  }, [])

  /** Moves to the next song; at the end of the queue, recommendations keep the music going. */
  const advance = useCallback(() => {
    const { queue: q, index: i, repeat: r, autoplay: auto } = live.current
    if (i < q.length - 1) return goTo(i + 1)
    if (r === 'all' && q.length) return goTo(0)
    if (auto) {
      const gen = queueGen.current
      extendWithSuggestions().then(() => {
        if (gen === queueGen.current && live.current.index === i && i < live.current.queue.length - 1) goTo(i + 1)
      })
      return
    }
    activeRef.current.pause()
  }, [goTo, extendWithSuggestions])

  /** Next pressed by you: leaving a song early counts as a skip, which recommendations learn from. */
  const next = useCallback(() => {
    const track = live.current.queue[live.current.index]
    const duration = activeRef.current.duration || track?.duration || 0
    if (track && heard.current > 0) {
      if (isEarlySkip(heard.current, duration)) listening.skipped(track)
      else if (duration && heard.current >= duration * 0.8) listening.finished(track)
    }
    advance()
  }, [advance])

  const prev = useCallback(() => {
    const media = activeRef.current
    // Like most players: restart the song if we're more than 3s in
    if (media.currentTime > 3 || live.current.index === 0) {
      const track = live.current.queue[live.current.index]
      // Starting a song over after hearing most of it means you wanted it again
      if (track && heard.current >= (media.duration || track.duration) * 0.5) listening.repeated(track)
      media.currentTime = 0
      return
    }
    goTo(live.current.index - 1)
  }, [goTo])

  // Player events (from whichever player is active; the idle one is ignored)
  useEffect(() => {
    const onTime = (m: Media) => {
      const buffered = m.buffered.length ? m.buffered.end(m.buffered.length - 1) : 0
      heard.current = Math.max(heard.current, m.currentTime)
      setProgress({ time: m.currentTime, duration: m.duration || live.current.queue[live.current.index]?.duration || 0, buffered })
    }
    const onEnded = (m: Media) => {
      const track = live.current.queue[live.current.index]
      if (live.current.repeat === 'one') {
        if (track) listening.repeated(track)
        m.currentTime = 0
        m.play().catch(() => {})
        return
      }
      if (track) listening.finished(track)
      advance()
    }
    const onError = (m: Media) => {
      if (!m.src) return
      const track = live.current.queue[live.current.index]
      // Audius stream links are signed and expire; after a long pause, re-request once and resume
      if (m === audio && track && retriedId.current !== track.id) {
        retriedId.current = track.id
        const at = audio.currentTime
        const resume = !audio.paused || wantPlay.current
        audio.src = streamUrl(track.id)
        audio.addEventListener('loadedmetadata', () => (audio.currentTime = at), { once: true })
        if (resume) audio.play().catch(() => {})
        return
      }
      setIsLoading(false)
      setIsPlaying(false)
      if (m === youtubeMedia && youtubeMedia.playerUnavailable) {
        // Every YouTube song would fail the same way, so stop instead of skipping through them
        setError(youtubeMedia.errorReason)
        return
      }
      const reason = m === audio ? 'This track could not be played.' : (youtubeMedia.errorReason ?? "This YouTube video can't be played here.")
      setError(`${reason} Skipping…`)
      // Skip broken tracks automatically (not counted as your skip)
      setTimeout(() => advance(), 2500)
    }

    const handlers: [string, (m: Media) => void][] = [
      ['play', () => setIsPlaying(true)],
      ['pause', () => setIsPlaying(false)],
      [
        'playing',
        () => {
          setIsLoading(false)
          setError(null)
        },
      ],
      ['waiting', () => setIsLoading(true)],
      [
        'blocked',
        () => {
          setIsLoading(false)
          setIsPlaying(false)
          setError('Your browser blocked YouTube from starting. Tap the video to play it.')
        },
      ],
      ['timeupdate', onTime],
      ['progress', onTime],
      ['loadedmetadata', onTime],
      ['ended', onEnded],
      ['error', onError],
    ]
    const listeners = handlers.map(([type, fn]) => {
      const listener = (e: Event) => {
        if (e.target === activeRef.current) fn(activeRef.current)
      }
      return [type, listener] as const
    })
    for (const m of [audio, youtubeMedia]) for (const [type, l] of listeners) m.addEventListener(type, l)
    return () => {
      for (const m of [audio, youtubeMedia]) for (const [type, l] of listeners) m.removeEventListener(type, l)
    }
  }, [audio, advance])

  // Pre-fetch suggestions when nearing the end of the queue
  useEffect(() => {
    if (autoplay && repeat === 'off' && queue.length > 0 && index >= queue.length - 2 && isPlaying) {
      extendWithSuggestions()
    }
  }, [autoplay, repeat, queue.length, index, isPlaying, extendWithSuggestions])

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (!tracks.length) return
      const start = tracks[startIndex]
      let q = tracks
      let i = startIndex
      if (shuffle) {
        q = [start, ...shuffled(tracks.filter((_, k) => k !== startIndex))]
        i = 0
      }
      wantPlay.current = true
      if (start.id === loadedId.current) {
        listening.repeated(start)
        activeRef.current.currentTime = 0
        activeRef.current.play().catch(() => {})
      }
      startNewQueue()
      setQueue(q)
      setIndex(i)
    },
    [shuffle, startNewQueue],
  )

  const playTrack = useCallback(
    (track: Track, context?: Track[]) => {
      if (context?.length) {
        const i = context.findIndex((t) => t.id === track.id)
        return playQueue(context, Math.max(0, i))
      }
      playQueue([track], 0)
    },
    [playQueue],
  )

  const startRadio = useCallback(
    (track: Track) => {
      playQueue([track], 0)
      // Fill "Up next" right away instead of when the song ends
      live.current.queue = [track]
      live.current.index = 0
      if (live.current.autoplay) extendWithSuggestions()
    },
    [playQueue, extendWithSuggestions],
  )

  const toggle = useCallback(() => {
    if (!live.current.queue.length) return
    const media = activeRef.current
    if (media.paused) {
      wantPlay.current = true
      if (!media.src && current) {
        loadedId.current = null
        setQueue((q) => [...q]) // re-trigger load
        return
      }
      // Show the spinner until 'playing' arrives (YouTube's player can take a while to load)
      setIsLoading(true)
      media.play().catch(() => setIsLoading(false))
      if (current && media.currentTime < 1) addRecent(current)
    } else {
      media.pause()
    }
  }, [current, addRecent])

  const seek = useCallback((seconds: number) => {
    if (Number.isFinite(seconds)) activeRef.current.currentTime = Math.max(0, seconds)
  }, [])

  const playNext = useCallback(
    (track: Track) => {
      if (!live.current.queue.length) return playQueue([track])
      setQueue((q) => {
        const i = live.current.index
        const rest = q.filter((t, k) => k <= i || t.id !== track.id)
        return [...rest.slice(0, i + 1), track, ...rest.slice(i + 1)]
      })
    },
    [playQueue],
  )

  const addToQueue = useCallback(
    (track: Track) => {
      if (!live.current.queue.length) return playQueue([track])
      setQueue((q) => (q.some((t) => t.id === track.id) ? q : [...q, track]))
    },
    [playQueue],
  )

  const removeFromQueue = useCallback((i: number) => {
    if (i === live.current.index) return
    setQueue((q) => q.filter((_, k) => k !== i))
    if (i < live.current.index) setIndex((x) => x - 1)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const on = !s
      if (on) {
        // Shuffle what's upcoming, keep the current song in place
        setQueue((q) => {
          const i = live.current.index
          return [...q.slice(0, i + 1), ...shuffled(q.slice(i + 1))]
        })
      }
      return on
    })
  }, [])

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), [])
  const toggleAutoplay = useCallback(() => setAutoplay((a) => !a), [])
  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)))
    setMuted(false)
  }, [])
  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  // Lock-screen / notification / headphone controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: trustedGenre(current) || 'Tunely',
      artwork: [
        ...(current.artwork ? [{ src: current.artwork, sizes: '480x480', type: 'image/jpeg' }] : []),
        ...(current.artworkLarge ? [{ src: current.artworkLarge, sizes: '1000x1000', type: 'image/jpeg' }] : []),
      ],
    })
    const ms = navigator.mediaSession
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => activeRef.current.play()],
      ['pause', () => activeRef.current.pause()],
      ['previoustrack', () => prev()],
      ['nexttrack', () => next()],
      ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
      ['seekbackward', (d) => seek(activeRef.current.currentTime - (d.seekOffset ?? 10))],
      ['seekforward', (d) => seek(activeRef.current.currentTime + (d.seekOffset ?? 10))],
    ]
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        /* action unsupported on this browser */
      }
    }
  }, [audio, current, next, prev, seek])

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowRight' && e.shiftKey) next()
      else if (e.code === 'ArrowLeft' && e.shiftKey) prev()
      else if (e.code === 'ArrowRight') seek(activeRef.current.currentTime + 5)
      else if (e.code === 'ArrowLeft') seek(activeRef.current.currentTime - 5)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [audio, toggle, next, prev, seek])

  // Page title reflects what's playing
  useEffect(() => {
    document.title = current && isPlaying ? `${current.title} · ${current.artist}` : 'Tunely - Free Music'
  }, [current, isPlaying])

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      isLoading,
      shuffle,
      repeat,
      autoplay,
      volume,
      muted,
      error,
      suggesting,
      reasons,
      playQueue,
      playTrack,
      startRadio,
      toggle,
      next,
      prev,
      seek,
      jumpTo: goTo,
      playNext,
      addToQueue,
      removeFromQueue,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      toggleAutoplay,
    }),
    [queue, index, current, isPlaying, isLoading, shuffle, repeat, autoplay, volume, muted, error, suggesting, reasons, playQueue, playTrack, startRadio, toggle, next, prev, seek, goTo, playNext, addToQueue, removeFromQueue, setVolume, toggleMute, toggleShuffle, cycleRepeat, toggleAutoplay],
  )

  return (
    <PlayerContext.Provider value={value}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}

export function useProgress() {
  return useContext(ProgressContext)
}
