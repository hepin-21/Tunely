import { useEffect, useState } from 'react'
import { cleanTitle, dedupeKey, tokens } from '../lib/text'
import type { Track } from './audius'
import { detectLanguage } from './regional'
import type { Singer } from './singers'

// YouTube Data API v3. A search costs 100 of the free 10,000 daily quota units
// (~100 searches/day), so results are cached and only fetched once typing settles.

const API = 'https://www.googleapis.com/youtube/v3'
const KEY_STORAGE = 'tunely.youtubeKey'
const KEY_EVENT = 'tunely:youtube-key'
const CACHE_STORAGE = 'tunely.youtubeCache'
const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_MAX = 80

export type YouTubeErrorKind = 'quota' | 'key' | 'network'

export class YouTubeError extends Error {
  kind: YouTubeErrorKind
  constructor(kind: YouTubeErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/** Key from the build (VITE_YOUTUBE_API_KEY) wins; otherwise one pasted into the app. */
export function getYouTubeKey(): string {
  const fromEnv = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  if (fromEnv) return fromEnv
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export const youtubeKeyFromBuild = () => !!import.meta.env.VITE_YOUTUBE_API_KEY

export function setYouTubeKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(KEY_EVENT))
}

/** Current key, re-rendering when it's changed anywhere in the app. */
export function useYouTubeKey() {
  const [key, setKey] = useState(getYouTubeKey)
  useEffect(() => {
    const update = () => setKey(getYouTubeKey())
    window.addEventListener(KEY_EVENT, update)
    return () => window.removeEventListener(KEY_EVENT, update)
  }, [])
  return key
}

export function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export function youtubeWatchUrl(track: Track) {
  return `https://www.youtube.com/watch?v=${track.youtubeId}`
}

export function youtubeChannelUrl(track: Track) {
  return `https://www.youtube.com/channel/${track.artistId}`
}

// ---------- cache ----------

type CacheEntry = { at: number; tracks: Track[] }

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_STORAGE) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(query: string, tracks: Track[]) {
  const cache = readCache()
  cache[query] = { at: Date.now(), tracks }
  const keep = Object.entries(cache)
    .filter(([, e]) => Date.now() - e.at < CACHE_TTL)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX)
  try {
    localStorage.setItem(CACHE_STORAGE, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    /* storage full: skip caching */
  }
}

// ---------- API ----------

async function call<T>(path: string, params: Record<string, string>, keyOverride?: string): Promise<T> {
  const key = keyOverride ?? getYouTubeKey()
  if (!key) throw new YouTubeError('key', 'No YouTube API key set')
  const url = new URL(`${API}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', key)

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new YouTubeError('network', "Couldn't reach YouTube")
  }
  if (res.ok) return res.json()

  const body = await res.json().catch(() => ({}))
  const reason: string = body?.error?.errors?.[0]?.reason ?? ''
  if (/quota|rateLimit/i.test(reason)) throw new YouTubeError('quota', "YouTube's daily search limit has been reached")
  if (res.status === 400 || res.status === 403) {
    throw new YouTubeError('key', body?.error?.message ?? 'The YouTube API key was rejected')
  }
  throw new YouTubeError('network', `YouTube error (${res.status})`)
}

/** Checks a key with the cheapest possible request (1 quota unit). Throws YouTubeError if it doesn't work. */
export async function testYouTubeKey(key: string) {
  await call('videos', { part: 'id', id: 'jNQXAC9IVRw' }, key.trim())
}

/** "PT1H2M3S" → 3723 */
function parseDuration(iso: string) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? '')
  if (!m) return 0
  const [, d, h, min, s] = m.map((x) => Number(x) || 0)
  return d * 86400 + h * 3600 + min * 60 + s
}

/** Titles come HTML-escaped ("Don&#39;t") */
function decodeEntities(s: string) {
  const el = document.createElement('textarea')
  el.innerHTML = s
  return el.value
}

function toTrack(v: any): Track {
  const sn = v.snippet ?? {}
  const th = sn.thumbnails ?? {}
  const title = cleanTitle(decodeEntities(sn.title ?? ''))
  const channel = decodeEntities(sn.channelTitle ?? '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '')
  return {
    id: `yt:${v.id}`,
    youtubeId: v.id,
    source: 'youtube',
    title,
    artist: channel || 'YouTube',
    artistId: sn.channelId ?? '',
    // 16:9 thumbnails without letterboxing crop cleanly to a square
    artwork: th.medium?.url ?? th.high?.url ?? null,
    artworkLarge: th.maxres?.url ?? th.high?.url ?? th.medium?.url ?? null,
    duration: parseDuration(v.contentDetails?.duration),
    genre: '',
    mood: null,
    plays: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    tags: (sn.tags ?? []).join(',').slice(0, 200) || undefined,
    collection: detectLanguage(title, (sn.tags ?? []).join(' '), channel),
  }
}

/** One search (100 quota units) plus a details lookup (1 unit): embeddable music videos with durations and views. */
async function searchVideos(query: string, maxResults: number): Promise<Track[]> {
  const search = await call<any>('search', {
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    videoCategoryId: '10', // Music
    videoEmbeddable: 'true', // playable inside the app
    videoSyndicated: 'true', // playable outside youtube.com
  })
  const ids: string[] = (search.items ?? [])
    .filter((i: any) => i.snippet?.liveBroadcastContent === 'none')
    .map((i: any) => i.id?.videoId)
    .filter(Boolean)
  if (!ids.length) return []

  // Search results lack durations and view counts; this lookup costs just 1 unit
  const details = await call<any>('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') })
  return (details.items ?? []).map(toTrack)
}

/** Embeddable music videos for `query`, full songs only (no shorts or live streams). */
export async function searchYouTube(query: string): Promise<Track[]> {
  const q = query.trim().toLowerCase()
  const hit = readCache()[q]
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.tracks

  const seen = new Set<string>()
  const tracks = (await searchVideos(query, 20))
    .filter((t) => t.duration >= 60 && t.duration <= 3 * 3600)
    // Re-uploads of the same video ("KALYANI … OFFICIAL MUSIC VIDEO" x4) collapse into the most viewed
    .sort((a, b) => b.plays - a.plays)
    .filter((t) => {
      const key = dedupeKey(t.title) || t.id
      return !seen.has(key) && seen.add(key)
    })
  writeCache(q, tracks)
  return tracks
}

// ---------- singer playlists ----------

const SINGER_CACHE_PREFIX = 'tunely.singer.v2.'
const SINGER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

/** Words that only describe the upload, not the song ("Tera Zikr | Official Video" = "Tera Zikr (Lyrics)") */
const UPLOAD_WORDS = new Set([
  'official', 'video', 'audio', 'lyric', 'lyrics', 'lyrical', 'full', 'song', 'songs', 'music', 'hd', '4k', 'new',
  'latest', 'with', 'ft', 'feat', 'by', 'from', 'the', 'movie', 'film', 'visualizer', 'vertical',
])

const CONNECTOR_WORDS = new Set(['by', 'ft', 'feat', 'featuring', 'with', 'x'])
const LIVE_WORDS = /\b(live|concert|tour|performance)\b/i
/** Recordings of live streams ("🔴LIVE DAY 7", "Live Stream"), which aren't songs */
const LIVE_STREAM = /🔴|\blive\s*(stream|streaming|day)\b/i

/**
 * The song's name from a YouTube title: the first part (split on " | ", " - ", ":" or a
 * bracket) that isn't just the singer's name, without trailing upload words.
 * "Darshan Raval - Tu Mileya | Lijo George" → "Tu Mileya";
 * "Mahiye Jinna Sohna Official Lyrical Video | Darshan Raval" → "Mahiye Jinna Sohna"
 */
function songName(title: string, nameWords: string[]) {
  const parts = title.split(/\s+[|\-–—:]\s+|\s*\|\s*|\s*[([{]|[)\]}]\s*/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const words = part
      .replace(/#[\p{L}\p{M}\p{N}_]+/gu, ' ') // hashtags
      .replace(/^['"‘’“”]+|['"‘’“”]+$/g, '')
      .split(/\s+/)
      .filter((w) => {
        const lw = tokens(w).join('')
        return lw && !nameWords.includes(lw) && !CONNECTOR_WORDS.has(lw)
      })
    while (words.length && tokens(words[words.length - 1]).every((w) => UPLOAD_WORDS.has(w) || /^\d+k$/.test(w))) words.pop()
    const name = words.join(' ').replace(/^['"‘’“”,]+|['"‘’“”,]+$/g, '').trim()
    if (tokens(name).length) return name
  }
  return title.replace(/#[\p{L}\p{M}\p{N}_]+/gu, '').trim() || title
}

/**
 * A singer's songs from YouTube, one entry per song: different uploads of the same
 * song (official video, lyric video, audio) collapse into the most-viewed one.
 * Cached for a week, so each singer costs ~101 quota units per week.
 */
export async function singerSongs(singer: Singer): Promise<Track[]> {
  const { slug, name, aliases = [], query = '', maxMinutes = 12 } = singer
  const cacheKey = SINGER_CACHE_PREFIX + slug
  try {
    const hit = JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as CacheEntry | null
    if (hit && Date.now() - hit.at < SINGER_CACHE_TTL) return hit.tracks
  } catch {
    /* ignore */
  }

  // Each spelling of the name as words; single letters are skipped so "A.R. Rahman" matches "AR Rahman"
  const spellings = [name, ...aliases].map((n) => tokens(n).filter((w) => w.length >= 2))
  const nameWords = [...new Set(spellings.flat())]
  const raw = await searchVideos(`${name} ${query}`.trim(), 50)
  const isTheirs = (t: Track) => {
    const words = new Set([...tokens(t.title), ...tokens(t.artist)])
    return spellings.some((sp) => sp.every((w) => words.has(w)))
  }
  // Studio versions beat live recordings of the same song; otherwise the most viewed wins
  const rank = (t: Track) => (LIVE_WORDS.test(t.title) ? 0 : 1e12) + t.plays

  const best = new Map<string, Track>()
  for (const t of raw) {
    // Songs only: no shorts, live-stream recordings or hour-long jukeboxes (Garba singers allow long nonstop sets)
    if (t.duration < 90 || t.duration > maxMinutes * 60 || LIVE_STREAM.test(t.title) || !isTheirs(t)) continue
    const song = songName(t.title, nameWords)
    const key = tokens(song).join(' ') || t.id
    const prev = best.get(key)
    // Show it like a music app: song name by the singer (the link still opens the uploading channel)
    if (!prev || rank(t) > rank(prev)) best.set(key, { ...t, title: song, artist: name })
  }
  const tracks = [...best.values()].sort((a, b) => b.plays - a.plays)
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), tracks }))
  } catch {
    /* storage full: skip caching */
  }
  return tracks
}

/** Songs already cached for a singer (no network), e.g. to show their photo on cards. */
export function cachedSingerSongs(slug: string): Track[] {
  try {
    return (JSON.parse(localStorage.getItem(SINGER_CACHE_PREFIX + slug) ?? 'null') as CacheEntry | null)?.tracks ?? []
  } catch {
    return []
  }
}
