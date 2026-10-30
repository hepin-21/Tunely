// Audius is an open, artist-run music platform. Its public API needs no key,
// serves full-length tracks, and shows no ads, which is what this app is built on.
import { cleanTitle } from '../lib/text'
import { detectLanguage, isJunkTitle, keywordMatcher } from './regional'

const API = 'https://api.audius.co/v1'
const APP_NAME = 'Tunely'

export interface Track {
  id: string
  title: string
  artist: string
  artistId: string
  artwork: string | null
  artworkLarge: string | null
  duration: number
  genre: string
  mood: string | null
  plays: number
  likes: number
  /** Uploader's tags ("sad,arijit,bollywood"), used to work out the song's style */
  tags?: string
  /** Beats per minute from Audius's audio analysis */
  bpm?: number | null
  /** Ids of Audius playlists (made by other listeners) that contain this track */
  playlistIds?: number[]
  /** Set when the track came from a regional collection (e.g. 'hindi'), so suggestions stay in that language */
  collection?: string
  /** Where it streams from; missing means Audius (tracks saved before YouTube support) */
  source?: 'audius' | 'youtube'
  youtubeId?: string
}

export interface Artist {
  id: string
  name: string
  handle: string
  picture: string | null
  cover: string | null
  bio: string
  followers: number
  trackCount: number
  verified: boolean
}

export interface Playlist {
  id: string
  name: string
  owner: string
  artwork: string | null
  trackCount: number
  description: string
}

export type TrendingTime = 'week' | 'month' | 'year' | 'allTime'

export const GENRES = [
  { name: 'Electronic', color: '#7c3aed' },
  { name: 'Hip-Hop/Rap', color: '#ea580c' },
  { name: 'Pop', color: '#db2777' },
  { name: 'Lo-Fi', color: '#0d9488' },
  { name: 'R&B/Soul', color: '#9333ea' },
  { name: 'Rock', color: '#dc2626' },
  { name: 'Alternative', color: '#4f46e5' },
  { name: 'House', color: '#2563eb' },
  { name: 'Ambient', color: '#0891b2' },
  { name: 'Jazz', color: '#b45309' },
  { name: 'Classical', color: '#a16207' },
  { name: 'Acoustic', color: '#65a30d' },
  { name: 'Latin', color: '#e11d48' },
  { name: 'Dubstep', color: '#16a34a' },
  { name: 'Techno', color: '#475569' },
  { name: 'Trap', color: '#c2410c' },
  { name: 'Drum & Bass', color: '#059669' },
  { name: 'Folk', color: '#92400e' },
  { name: 'Funk', color: '#c026d3' },
  { name: 'Reggae', color: '#15803d' },
  { name: 'Metal', color: '#3f3f46' },
  { name: 'Soundtrack', color: '#1d4ed8' },
  { name: 'World', color: '#0f766e' },
  { name: 'Devotional', color: '#d97706' },
]

export const MOODS = ['Peaceful', 'Energizing', 'Romantic', 'Upbeat', 'Melancholy', 'Easygoing', 'Empowering', 'Cool']

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(API + path)
  url.searchParams.set('app_name', APP_NAME)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  let lastError: unknown
  // One retry: Audius nodes occasionally hiccup
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const json = await res.json()
      return json.data as T
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

// Artwork is replicated across Audius content nodes. We remember mirror hosts
// so images can fall back when one node is slow or down.
const mirrorHosts = new Set<string>(['https://creatornode.audius.co'])
function collectMirrors(art: any) {
  art?.mirrors?.forEach((m: string) => mirrorHosts.add(m))
}
export function artworkMirrors(): string[] {
  return [...mirrorHosts]
}

function isFree(t: any): boolean {
  return t && !t.is_delete && t.is_streamable !== false && !t.is_stream_gated && t.access?.stream !== false
}

function toTrack(t: any): Track {
  collectMirrors(t.artwork)
  return {
    id: t.id,
    title: cleanTitle(t.title ?? ''),
    artist: t.user?.name ?? 'Unknown artist',
    artistId: t.user?.id ?? '',
    artwork: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
    artworkLarge: t.artwork?.['1000x1000'] ?? t.artwork?.['480x480'] ?? null,
    duration: t.duration ?? 0,
    genre: t.genre ?? '',
    mood: t.mood ?? null,
    plays: t.play_count ?? 0,
    likes: t.favorite_count ?? 0,
    tags: (t.tags ?? '').slice(0, 200) || undefined,
    bpm: typeof t.bpm === 'number' && t.bpm > 0 ? Math.round(t.bpm) : null,
    // The most recent few are enough for recommendations and keep saved queues small
    playlistIds: (t.playlists_containing_track ?? []).slice(-12),
    collection: detectLanguage(t.title ?? '', t.tags ?? '', t.user?.name ?? ''),
    source: 'audius',
  }
}

function toTracks(list: any[]): Track[] {
  const seen = new Set<string>()
  return (list ?? []).filter(isFree).map(toTrack).filter((t) => !seen.has(t.id) && seen.add(t.id))
}

function toArtist(u: any): Artist {
  collectMirrors(u.profile_picture)
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    picture: u.profile_picture?.['480x480'] ?? u.profile_picture?.['150x150'] ?? null,
    cover: u.cover_photo?.['2000x'] ?? u.cover_photo?.['640x'] ?? null,
    bio: u.bio ?? '',
    followers: u.follower_count ?? 0,
    trackCount: u.track_count ?? 0,
    verified: !!u.is_verified,
  }
}

function toPlaylist(p: any): Playlist {
  collectMirrors(p.artwork)
  return {
    id: p.id,
    name: cleanTitle(p.playlist_name ?? ''),
    owner: p.user?.name ?? '',
    artwork: p.artwork?.['480x480'] ?? p.artwork?.['150x150'] ?? null,
    trackCount: p.track_count ?? 0,
    description: p.description ?? '',
  }
}

export function streamUrl(trackId: string) {
  return `${API}/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export const audius = {
  trending: (opts: { genre?: string; time?: TrendingTime; limit?: number } = {}) =>
    get<unknown[]>('/tracks/trending', { genre: opts.genre, time: opts.time ?? 'week', limit: opts.limit ?? 30 }).then(
      (d) => toTracks(d as never[]),
    ),

  underground: (limit = 20) => get<unknown[]>('/tracks/trending/underground', { limit }).then((d) => toTracks(d as never[])),

  searchTracks: (query: string, limit = 30) =>
    get<unknown[]>('/tracks/search', { query, limit }).then((d) => toTracks(d as never[])),

  /**
   * Popular tracks for `query` that also mention one of `keywords` in their
   * title, tags, description or artist name. Search alone matches loosely
   * (e.g. "mantra" hits a producer named Mantra), so this keeps results on-topic.
   */
  searchMatching: async (query: string, keywords: string[], exclude: string[] = [], limit = 50) => {
    const raw = await get<any[]>('/tracks/search', { query, limit, sort_method: 'popular' })
    const isOnTopic = keywordMatcher(keywords)
    const isExcluded = exclude.length ? keywordMatcher(exclude) : () => false
    const matches = (raw ?? []).filter((t) => {
      const text = `${t.title} ${t.tags ?? ''} ${t.description ?? ''} ${t.user?.name ?? ''}`
      return t.duration >= 60 && !isJunkTitle(t.title ?? '') && isOnTopic(text) && !isExcluded(text)
    })
    return toTracks(matches)
  },

  byMood: (mood: string, limit = 40) =>
    get<unknown[]>('/tracks/search', { mood, sort_method: 'popular', limit }).then((d) => toTracks(d as never[])),

  searchArtists: (query: string, limit = 12) =>
    get<unknown[]>('/users/search', { query, limit }).then((d) =>
      (d as never[]).map(toArtist).filter((a) => a.trackCount > 0),
    ),

  searchPlaylists: (query: string, limit = 12) =>
    get<unknown[]>('/playlists/search', { query, limit }).then((d) =>
      (d as never[]).map(toPlaylist).filter((p) => p.trackCount > 0),
    ),

  trendingPlaylists: (limit = 12) =>
    get<unknown[]>('/playlists/trending', { limit, time: 'week' }).then((d) => (d as never[]).map(toPlaylist)),

  artist: (id: string) => get<unknown>(`/users/${id}`).then((d) => toArtist(d)),

  /** Artists that fans of this artist also follow */
  relatedArtists: (id: string, limit = 10) =>
    get<unknown[]>(`/users/${id}/related`, { limit }).then((d) => (d as never[]).map(toArtist).filter((a) => a.trackCount > 0)),

  artistTracks: (id: string, limit = 50) =>
    get<unknown[]>(`/users/${id}/tracks`, { limit, sort: 'plays' }).then((d) => toTracks(d as never[])),

  playlist: (id: string) => get<unknown[]>(`/playlists/${id}`).then((d) => toPlaylist((d as never[])[0])),

  playlistTracks: (id: string) => get<unknown[]>(`/playlists/${id}/tracks`).then((d) => toTracks(d as never[])),
}
