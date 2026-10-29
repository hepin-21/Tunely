import { audius, type Track } from '../api/audius'
import { singerForArtist, singersIn } from '../api/singers'
import { cachedSingerSongs, getYouTubeKey, searchYouTube, singerSongs } from '../api/youtube'
import { fetchCollection } from './collections'

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
    if (t.genre) genres.set(t.genre, (genres.get(t.genre) ?? 0) + weight)
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

/** Tracks that go well after `track`: same artist plus what is trending in its genre. */
export async function similarTo(track: Track, exclude: Set<string>, limit = 15): Promise<Track[]> {
  // Regional songs (Hindi, Punjabi, …) continue with the same language, not the global genre chart
  if (track.collection) {
    const [pool, byArtist] = await Promise.all([
      settle(fetchCollection(track.collection)),
      settle(audius.artistTracks(track.artistId, 10)),
    ])
    const regional = shuffle(dedupe(pool.slice(0, 80), exclude))
    // Only the artist's songs in a regional language; a cover artist's English covers shouldn't sneak in
    const artistPool = shuffle(dedupe(byArtist.filter((t) => t.collection), exclude)).slice(0, 3)
    return dedupe(interleave([regional.slice(0, limit), artistPool]), exclude).slice(0, limit)
  }

  // YouTube songs continue on YouTube: the singer's playlist if we have it (free, cached),
  // otherwise one cached YouTube search for the artist. Audius is the last resort.
  if (track.source === 'youtube') {
    const singer = singerForArtist(track.artist)
    if (singer) {
      const own = dedupe(cachedSingerSongs(singer.slug), exclude)
      if (own.length) return shuffle(own).slice(0, limit)
      // Played all of theirs: continue with singers of the same style (Garba after Garba),
      // using their best-known songs. Cached playlists first; otherwise load one (cached a week).
      const peers = shuffle(singersIn(singer.group).filter((s) => s.slug !== singer.slug))
      const cachedPeers = peers.map((s) => dedupe(cachedSingerSongs(s.slug).slice(0, 15), exclude)).filter((l) => l.length)
      if (cachedPeers.length) return shuffle(interleave(cachedPeers)).slice(0, limit)
      if (getYouTubeKey() && peers.length) {
        const peerSongs = dedupe((await settle(singerSongs(peers[0]))).slice(0, 15), exclude)
        if (peerSongs.length) return shuffle(peerSongs).slice(0, limit)
      }
    }
    if (getYouTubeKey()) {
      const related = dedupe(await settle(searchYouTube(track.artist)), exclude)
      if (related.length) return shuffle(related).slice(0, limit)
    }
    const [byName, trending] = await Promise.all([
      settle(audius.searchTracks(track.artist, 30)),
      settle(audius.trending({ limit: 30 })),
    ])
    return dedupe(interleave([shuffle(byName), shuffle(trending)]), exclude).slice(0, limit)
  }

  const [byArtist, byGenre, byGenreMonth] = await Promise.all([
    settle(audius.artistTracks(track.artistId, 10)),
    track.genre ? settle(audius.trending({ genre: track.genre, time: 'week', limit: 30 })) : Promise.resolve([]),
    track.genre ? settle(audius.trending({ genre: track.genre, time: 'month', limit: 30 })) : Promise.resolve([]),
  ])
  // Favor genre variety with a sprinkle of the same artist
  const genrePool = shuffle(dedupe([...byGenre, ...byGenreMonth], exclude))
  const artistPool = shuffle(dedupe(byArtist, exclude)).slice(0, 3)
  return dedupe(interleave([genrePool.slice(0, limit), artistPool]), exclude).slice(0, limit)
}

/** Artists you might like, ranked by how much you play them. */
export function topArtistsFrom(profile: TasteProfile, n = 6) {
  return profile.artists.slice(0, n).map(([id, , name]) => ({ id, name }))
}
