import { audius, type Track } from '../api/audius'
import { isJunkTitle } from '../api/regional'
import { singerForArtist, singersIn } from '../api/singers'
import { cachedSingerSongs, getYouTubeKey, searchYouTube, singerSongs } from '../api/youtube'
import { fetchCollection } from './collections'
import { artistKey, featuresOf, MIN_QUALITY, similarity, trustedGenre } from './features'
import { listening, type ListenStats } from './history'
import { sameSong, songWords } from './text'

// Collections that blend well with each other
const RELATED: Record<string, string[]> = {
  hindi: ['hindi-lofi', 'retro'],
  'hindi-lofi': ['hindi', 'retro'],
  retro: ['hindi', 'hindi-lofi'],
  'desi-hiphop': ['hindi', 'punjabi'],
  punjabi: ['hindi', 'desi-hiphop'],
  sufi: ['hindi', 'retro'],
  devotional: ['sufi'],
  tamil: ['telugu'],
  telugu: ['tamil'],
}

// A small on-device recommender: it scores genres and artists from what you
// liked and played, then pulls fresh tracks from those genres and artists.

export interface TasteProfile {
  genres: [string, number][]
  artists: [string, number, string][] // id, score, name
  collections: [string, number][] // regional collections like 'hindi', 'punjabi'
  hasHistory: boolean
}

export function buildTasteProfile(liked: Track[], recent: Track[]): TasteProfile {
  const genres = new Map<string, number>()
  const artists = new Map<string, { score: number; name: string }>()
  const collections = new Map<string, number>()

  const add = (t: Track, weight: number) => {
    // Only believable genres: a Hindi song mislabelled "Metal" shouldn't put Metal on your Home page
    const genre = trustedGenre(t)
    if (genre) genres.set(genre, (genres.get(genre) ?? 0) + weight)
    if (t.collection) collections.set(t.collection, (collections.get(t.collection) ?? 0) + weight)
    // Only Audius artists, since their tracks are what we can fetch for suggestions
    if (t.artistId && t.source !== 'youtube') {
      const a = artists.get(t.artistId) ?? { score: 0, name: t.artist }
      a.score += weight
      artists.set(t.artistId, a)
    }
  }
  liked.forEach((t) => add(t, 3))
  // Recent plays count more the more recent they are
  recent.forEach((t, i) => add(t, Math.max(0.3, 1.5 - i * 0.05)))

  return {
    genres: [...genres.entries()].sort((a, b) => b[1] - a[1]),
    artists: [...artists.entries()].sort((a, b) => b[1].score - a[1].score).map(([id, a]) => [id, a.score, a.name]),
    collections: [...collections.entries()].sort((a, b) => b[1] - a[1]),
    hasHistory: liked.length + recent.length > 0,
  }
}

function interleave(lists: Track[][]): Track[] {
  const out: Track[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}

function dedupe(tracks: Track[], exclude: Set<string>) {
  const seen = new Set(exclude)
  return tracks.filter((t) => !seen.has(t.id) && seen.add(t.id))
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const settle = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[])

/** "Made for you" mix built from the taste profile. */
export async function suggestForYou(profile: TasteProfile, exclude: Set<string>, limit = 24): Promise<Track[]> {
  if (!profile.hasHistory) return []
  const topCollections = profile.collections.slice(0, 2).map(([c]) => c)
  // Someone who mostly plays Hindi music shouldn't get a mix dominated by English genre charts
  const regionalShare = (profile.collections[0]?.[1] ?? 0) / Math.max(1, profile.genres.reduce((s, [, n]) => s + n, 0))
  const mostlyRegional = regionalShare > 0.5
  // Mostly-regional listeners get related regional collections instead of global genre charts
  const collections = mostlyRegional
    ? [...new Set([...topCollections, ...(RELATED[topCollections[0]] ?? [])])].slice(0, 3)
    : topCollections
  const topGenres = mostlyRegional ? [] : profile.genres.slice(0, 3).map(([g]) => g)
  const topArtists = profile.artists.slice(0, 3).map(([id]) => id)
  const times = ['week', 'month', 'allTime'] as const

  const lists = await Promise.all([
    ...collections.map((c) => settle(fetchCollection(c)).then((ts) => shuffle(ts.slice(0, 60)))),
    ...topGenres.map((genre, i) => settle(audius.trending({ genre, time: times[i % times.length], limit: 25 }))),
    ...topArtists.map((id) =>
      settle(audius.artistTracks(id, 15)).then((ts) => shuffle(mostlyRegional ? ts.filter((t) => t.collection) : ts)),
    ),
  ])
  return dedupe(interleave(lists), exclude).slice(0, limit)
}

// ---------- Up next ----------
// Decides what plays after a song, like a radio station seeded by it (YouTube Mix, Spotify radio):
// 1. Features of the current song: genre, artist, mood, language, tempo (lib/features)
// 2. Your listening history: plays, likes, repeats and skips (lib/history)
// 3. Content-based candidates: the same artist, language, genre and mood
// 4. Collaborative candidates: songs other listeners keep in the same Audius playlists,
//    and artists that this artist's fans also follow
// 5. Every candidate gets one score from all of the above
// 6. The best ones, spread across artists, become the queue; the player plays them in turn

export interface UpNextInput {
  seed: Track
  /** Songs played before the seed in this session, oldest first; the radio drifts with them */
  session: Track[]
  /** Songs that must not come back in any version: the queue and recent plays */
  avoid: Track[]
  liked: Track[]
  recent: Track[]
  playlists: { tracks: Track[] }[]
  limit?: number
}

export interface UpNext {
  track: Track
  score: number
  /** Why it was picked, shown in the queue */
  reason: string
}

interface Candidate {
  track: Track
  /** Weighted share of the seed's playlists (made by other listeners) that also contain it */
  co: number
  /** By an artist that fans of the seed's artist also follow */
  fan: boolean
  /** In one of your own playlists together with the seed */
  mine: boolean
}

interface Scored extends UpNext {
  artist: string
  words: Set<string>
  familiar: boolean
}

const TIMEOUT = 6000
const MAX_MINUTES = 15
const PLAYLIST_SAMPLE = 3

/** A source that fails or hangs adds nothing, so one slow node can't stall the music. */
function within<T>(p: Promise<T[]>, ms = TIMEOUT): Promise<T[]> {
  return Promise.race([settle(p), new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms))])
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** YouTube songs continue on YouTube: the singer's playlist and singers of the same style, else one cached search. */
async function youtubePool(track: Track): Promise<Track[]> {
  const lists: Track[][] = []
  const singer = singerForArtist(track.artist)
  if (singer) {
    lists.push(cachedSingerSongs(singer.slug))
    // Garba after Garba: cached playlists are free; otherwise load one peer's (cached a week)
    const peers = shuffle(singersIn(singer.group).filter((s) => s.slug !== singer.slug))
    const cachedPeers = peers.map((s) => cachedSingerSongs(s.slug).slice(0, 15)).filter((l) => l.length)
    lists.push(...cachedPeers)
    if (!cachedPeers.length && peers.length && getYouTubeKey()) lists.push((await within(singerSongs(peers[0]), 8000)).slice(0, 15))
  }
  if (!lists.some((l) => l.length) && getYouTubeKey()) lists.push(await within(searchYouTube(track.artist), 8000))
  return lists.flat()
}

/** Content-based candidates: same artist, same language, then genre and mood (only labels that are believable). */
function contentPool(seed: Track): Promise<Track[]>[] {
  const { genre, mood } = featuresOf(seed)
  const youtube = seed.source === 'youtube'
  const jobs = [youtube ? youtubePool(seed) : within(audius.artistTracks(seed.artistId, 15))]
  if (seed.collection) {
    // Regional songs continue in the same language, with a little of a neighbouring collection
    jobs.push(within(fetchCollection(seed.collection)).then((ts) => ts.slice(0, 120)))
    const near = RELATED[seed.collection]?.[0]
    if (near) jobs.push(within(fetchCollection(near)).then((ts) => ts.slice(0, 30)))
  } else if (youtube) {
    jobs.push(within(audius.searchTracks(seed.artist, 30)), within(audius.trending({ limit: 30 })))
  } else {
    if (genre) {
      jobs.push(
        within(audius.trending({ genre, time: 'week', limit: 40 })),
        within(audius.trending({ genre, time: 'month', limit: 40 })),
      )
    }
    if (mood) jobs.push(within(audius.byMood(mood, 40)))
    if (!genre && !mood) jobs.push(within(audius.trending({ limit: 40 })))
  }
  return jobs
}

/** Collaborative candidates: what other listeners keep next to this song, and what its artist's fans follow. */
async function collaborativePool(seed: Track): Promise<{ lists: Track[][]; fans: Track[] }> {
  // YouTube songs aren't in Audius playlists or follow graphs
  if (seed.source === 'youtube') return { lists: [], fans: [] }
  const [lists, fans] = await Promise.all([
    Promise.all(shuffle(seed.playlistIds ?? []).slice(0, PLAYLIST_SAMPLE).map((id) => within(audius.playlistTracks(String(id))))),
    within(audius.relatedArtists(seed.artistId, 8)).then((artists) =>
      Promise.all(shuffle(artists).slice(0, 3).map((a) => within(audius.artistTracks(a.id, 8)))),
    ),
  ])
  return { lists: lists.filter((l) => l.length > 1), fans: fans.flat() }
}

/** How much you like each artist and genre: -1 (you keep skipping them) to 1 (you play them all the time). */
function tasteFrom(stats: Readonly<Record<string, ListenStats>>, liked: Track[]) {
  const artist = new Map<string, number>()
  const genre = new Map<string, number>()
  const add = (a: string, g: string, v: number) => {
    if (a) artist.set(a, (artist.get(a) ?? 0) + v)
    if (g) genre.set(g, (genre.get(g) ?? 0) + v * 0.5)
  }
  for (const s of Object.values(stats)) add(s.artist, s.genre, s.completes + s.repeats * 1.5 + s.plays * 0.2 - s.skips * 1.2)
  for (const t of liked) add(artistKey(t), trustedGenre(t), 3)
  const squash = (m: Map<string, number>) => new Map([...m].map(([k, v]) => [k, Math.tanh(v / 6)]))
  return { artist: squash(artist), genre: squash(genre) }
}

/** Best first, but at most two per artist, not the same artist back to back, and never two versions of one song. */
function pickVaried(ranked: Scored[], seedArtist: string, limit: number): UpNext[] {
  const out: Scored[] = []
  const perArtist = new Map<string, number>()
  let familiar = 0
  // Strict pass first; if that leaves the queue short, relax the artist rules
  for (const strict of [true, false]) {
    for (const s of ranked) {
      if (out.length >= limit) break
      if (out.includes(s) || out.some((o) => sameSong(o.words, s.words))) continue
      const n = perArtist.get(s.artist) ?? 0
      const prev = out.length ? out[out.length - 1].artist : seedArtist
      // A couple of known favourites per batch, like a radio mixes in songs you know
      if (strict && (n >= 2 || s.artist === prev || (s.familiar && familiar >= 2))) continue
      out.push(s)
      perArtist.set(s.artist, n + 1)
      if (s.familiar) familiar++
    }
  }
  return out.map(({ track, score, reason }) => ({ track, score, reason }))
}

/** The next songs to play after `seed`, best first. */
export async function upNext({ seed, session, avoid, liked, recent, playlists, limit = 10 }: UpNextInput): Promise<UpNext[]> {
  const seedF = featuresOf(seed)
  const sessionF = session.slice(-5).map(featuresOf)
  const [content, collab] = await Promise.all([Promise.all(contentPool(seed)), collaborativePool(seed)])

  // Every candidate once, remembering which sources suggested it
  const candidates = new Map<string, Candidate>()
  const add = (t: Track) => {
    let c = candidates.get(t.id)
    if (!c) candidates.set(t.id, (c = { track: t, co: 0, fan: false, mine: false }))
    return c
  }
  content.flat().forEach(add)
  // Huge catch-all playlists say less about a song than a focused 20-song one, and a single
  // playlist is weak evidence: being in all PLAYLIST_SAMPLE sampled playlists scores 1
  collab.lists.forEach((list) => {
    const weight = Math.sqrt(Math.min(1, 30 / list.length)) / PLAYLIST_SAMPLE
    list.forEach((t) => (add(t).co += weight))
  })
  collab.fans.forEach((t) => (add(t).fan = true))
  for (const p of playlists) if (p.tracks.some((t) => t.id === seed.id)) p.tracks.forEach((t) => (add(t).mine = true))
  liked.forEach(add)
  recent.forEach(add)

  const stats = listening.stats()
  const taste = tasteFrom(stats, liked)
  const likedIds = new Set(liked.map((t) => t.id))
  const avoidIds = new Set([seed.id, ...avoid.map((t) => t.id)])
  const avoidWords = [seed, ...avoid].map((t) => songWords(t.title, t.artist))
  const maxDuration = seed.duration > MAX_MINUTES * 60 ? Infinity : MAX_MINUTES * 60

  const scored: Scored[] = []
  for (const c of candidates.values()) {
    const t = c.track
    if (avoidIds.has(t.id) || t.duration < 60 || t.duration > maxDuration || isJunkTitle(t.title)) continue
    const f = featuresOf(t)
    // Rips, keyword spam and "Wedding Songs" style compilations aren't songs to queue
    if (f.quality < MIN_QUALITY) continue
    // Stay in the song's language: a Hindi song isn't followed by a Tamil one
    if (seedF.language && f.language && f.language !== seedF.language) continue
    const s = stats[t.id]
    if (s && s.skips >= 2 && s.skips > s.completes) continue
    // Another upload, cover or remix of a song that just played or is already queued
    const words = songWords(t.title, t.artist)
    if (avoidWords.some((w) => sameSong(w, words))) continue

    const sim = similarity(seedF, f)
    // Mostly like the current song, partly like the whole session, so the radio drifts naturally
    const content = sessionF.length ? sim * 0.7 + (sessionF.reduce((sum, x) => sum + similarity(x, f), 0) / sessionF.length) * 0.3 : sim
    const collaborative = Math.max(c.mine ? 1 : 0, Math.min(1, c.co * 1.5), c.fan ? 0.5 : 0)
    const isLiked = likedIds.has(t.id)
    let personal = (taste.artist.get(f.artist) ?? 0) * 0.6 + (taste.genre.get(f.genre) ?? 0) * 0.4
    if (isLiked) personal += 0.4
    if (s) personal += Math.min(0.3, s.repeats * 0.1) - s.skips * 0.3
    const popularity = Math.min(1, Math.log10(t.plays + 1) / 6)
    // Other listeners' picks only count fully when the song also sounds alike
    // (a Hindi guitar cover sits in piano playlists, but piano isn't what should follow it)
    const vouched = collaborative * Math.min(1, content + 0.3)
    // A little randomness so a song doesn't always get the exact same radio
    let score = content * 0.45 + vouched * 0.25 + clamp(personal, -1, 1) * 0.15 + popularity * 0.1 + Math.random() * 0.05
    // A Hindi song is followed by Hindi songs; ones in no known language only if nothing else fits
    if (seedF.language && !f.language) score *= 0.7
    // A song radio plays songs; a 20-song mashup only after a mashup
    if (f.version === 'mashup' && seedF.version !== 'mashup') score *= 0.75
    // Cleaner uploads first when everything else is equal
    score *= 0.7 + 0.3 * f.quality

    const sharedStyle = [...f.styles].find((x) => seedF.styles.has(x))
    const reason = c.mine
      ? `In your playlist with “${seed.title}”`
      : c.co >= 0.3
        ? `Listeners pair it with “${seed.title}”`
        : isLiked
          ? 'From your Liked Songs'
          : f.artist === seedF.artist
            ? `More from ${t.artist}`
            : c.fan
              ? `Fans of ${seed.artist} also like`
              : sharedStyle
                ? `Same ${sharedStyle} vibe as “${seed.title}”`
                : `Similar to “${seed.title}”`
    scored.push({ track: t, score, reason, artist: f.artist, words, familiar: isLiked || (!!s && s.completes + s.repeats >= 2) })
  }

  scored.sort((a, b) => b.score - a.score)
  return pickVaried(scored, seedF.artist, limit)
}

/** Artists you might like, ranked by how much you play them. */
export function topArtistsFrom(profile: TasteProfile, n = 6) {
  return profile.artists.slice(0, n).map(([id, , name]) => ({ id, name }))
}
