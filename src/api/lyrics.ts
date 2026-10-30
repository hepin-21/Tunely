import { featuresOf } from '../lib/features'
import { sameSong, songWords, tokens } from '../lib/text'
import type { Track } from './audius'

// Lyrics from LRCLIB (lrclib.net), a free, open lyrics database with no key or account.
// Many entries are time-synced, so the current line can be highlighted as the song plays.
// Uploads are messy (covers, slowed versions, music videos with intros), so a match only
// keeps its timing when it fits this exact upload; otherwise the words are shown unsynced.

const API = 'https://lrclib.net/api'
const CACHE_KEY = 'tunely.lyrics'
const CACHE_MAX = 60
const FOUND_TTL = 7 * 24 * 60 * 60 * 1000
const MISSING_TTL = 24 * 60 * 60 * 1000

export interface LyricLine {
  time: number
  text: string
}

export interface Lyrics {
  /** Timed lines that fit this upload, or null when only unsynced words are available */
  lines: LyricLine[] | null
  plain: string | null
  /** An instrumental version: there are no words */
  instrumental: boolean
  /** True when the words come from a version whose timing differs from this upload */
  otherVersion: boolean
  title: string
  artist: string
}

interface Result {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

// Words in upload titles that aren't part of the song's name ("… Latest Punjabi Song (MP3 320K)")
const UPLOAD_WORDS = new Set(['hindi', 'punjabi', 'bollywood', 'tamil', 'telugu', 'gujarati', 'english', 'desi', 'ft', 'feat', 'prod', 'x', 'vs'])

/** Words that name the song (and often its singer) in an upload title. */
function nameWords(title: string) {
  return [...songWords(title)].filter((w) => !UPLOAD_WORDS.has(w) && !/\d/.test(w) && w.length > 1)
}

/** "[01:02.50] line" → timed lines; a line can carry several timestamps (repeated choruses). */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const [, m, s] of stamps) lines.push({ time: Number(m) * 60 + Number(s), text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

// ---------- cache ----------

type Entry = { at: number; lyrics: Lyrics | null }

function readCache(): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(id: string, lyrics: Lyrics | null) {
  const cache = readCache()
  cache[id] = { at: Date.now(), lyrics }
  const keep = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    /* storage full: skip caching */
  }
}

// ---------- lookup ----------

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function search(q: string): Promise<Result[]> {
  // The free service answers "busy, retry after 1s" when asked several times quickly (skipping songs)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`)
    const retryAfter = Number(res.headers.get('retry-after'))
    if ((res.status === 503 || res.status === 429) && attempt < 2 && retryAfter > 0 && retryAfter <= 5) {
      await wait(retryAfter * 1000)
      continue
    }
    const body = await res.json().catch(() => null)
    // Errors aren't "no lyrics": throw so the miss isn't cached
    if (!res.ok || !Array.isArray(body)) throw new Error("Couldn't reach the lyrics service")
    return body
  }
}

/** How well a result fits the track, or -1 when it's a different song. */
function fit(r: Result, track: Track, ours: string[]) {
  const theirs = new Set(nameWords(r.trackName))
  const known = new Set([...ours, ...tokens(track.artist)])
  const byArtist = tokens(r.artistName).some((w) => w.length > 2 && known.has(w)) ? 2 : 0
  // Same song: the same words, or its name inside our title. A short name inside a long title
  // ("Titli" in "Titli Lyrics Satinder Sartaj …") also needs the artist to match, or "Godiya"
  // would match "Godiya Me Sutala Ae Jaan 6 Mahina Ke Laika Niyan"
  const inside = theirs.size > 0 && [...theirs].every((w) => known.has(w)) && (byArtist > 0 || theirs.size / ours.length >= 0.5)
  if (!theirs.size || !(inside || sameSong(theirs, new Set(ours)))) return -1
  // "tum hi ho" in "arijit singh tum hi ho", but not "tum hi tum ho"
  const inOrder = ours.join(' ').includes(nameWords(r.trackName).join(' ')) ? 2 : 0
  const gap = Math.abs(r.duration - track.duration)
  return inOrder + byArtist + (r.syncedLyrics ? 0.5 : 0) + (gap <= 4 ? 1 : 0) - Math.min(1, gap / 60)
}

function toLyrics(r: Result, track: Track): Lyrics {
  const base = { instrumental: r.instrumental, title: r.trackName, artist: r.artistName }
  const synced = r.syncedLyrics ? parseLrc(r.syncedLyrics) : null
  const plain = r.plainLyrics ?? (synced ? synced.map((l) => l.text).join('\n') : null)
  const ratio = r.duration ? track.duration / r.duration : 0
  if (synced?.length && Math.abs(track.duration - r.duration) <= 4) return { ...base, lines: synced, plain, otherVersion: false }
  // Slowed + reverb is the same recording played slower, so the timing stretches evenly
  if (synced?.length && featuresOf(track).version === 'lofi' && ratio >= 1.03 && ratio <= 1.4) {
    return { ...base, lines: synced.map((l) => ({ ...l, time: l.time * ratio })), plain, otherVersion: false }
  }
  return { ...base, lines: null, plain, otherVersion: !!synced?.length }
}

/** Lyrics for a track, or null when none were found. Throws when the service can't be reached. */
export async function fetchLyrics(track: Track): Promise<Lyrics | null> {
  const hit = readCache()[track.id]
  if (hit && Date.now() - hit.at < (hit.lyrics ? FOUND_TTL : MISSING_TTL)) return hit.lyrics

  const { version } = featuresOf(track)
  if (version === 'instrumental') {
    return { lines: null, plain: null, instrumental: true, otherVersion: false, title: track.title, artist: track.artist }
  }
  // Mashups and hour-long mixes are many songs, with no single set of lyrics
  const ours = nameWords(track.title)
  if (!ours.length || version === 'mashup' || track.duration > 15 * 60) return null

  // The full name first (often "Singer - Song"); if that finds nothing, just the start of the title,
  // which is usually the song's name, and let the artist pick the right one
  let results = await search(ours.slice(0, 6).join(' '))
  if (!results.length && ours.length > 1) results = await search(ours.slice(0, ours[0].length >= 4 ? 1 : 2).join(' '))

  const best = results
    .filter((r) => r.plainLyrics || r.syncedLyrics || r.instrumental)
    .map((r) => ({ r, score: fit(r, track, ours) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)[0]
  const lyrics = best ? toLyrics(best.r, track) : null
  writeCache(track.id, lyrics)
  return lyrics
}

/** Index of the line being sung at `time` (-1 before the first line). */
export function activeLine(lines: LyricLine[], time: number) {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  // Switch a moment early so the highlight lands as the line starts
  const t = time + 0.25
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}
