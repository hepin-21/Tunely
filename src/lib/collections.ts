import { audius, type Track } from '../api/audius'
import { findRegional } from '../api/regional'
import { MIN_QUALITY, uploadQuality } from './features'
import { dedupeKey } from './text'

const TTL = 10 * 60 * 1000
const cache = new Map<string, { at: number; tracks: Promise<Track[]> }>()

/**
 * All tracks for a regional collection, most played first. Runs the collection's
 * searches in parallel and caches the result, since Home, the collection page and
 * autoplay all ask for the same data.
 */
export function fetchCollection(slug: string): Promise<Track[]> {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.at < TTL) return hit.tracks

  const c = findRegional(slug)
  if (!c) return Promise.resolve([])

  const tracks = Promise.all(c.queries.map((q) => audius.searchMatching(q, c.keywords, c.exclude, 50).catch(() => [] as Track[]))).then(
    (lists) => {
      // Sort first so the most-played copy of a re-uploaded song is the one kept
      const seen = new Set<string>()
      return lists
        .flat()
        // Generic compilations and keyword spam ("Bollywood Love Hindi Songs Best Hindi Love 2024") aren't songs
        .filter((t) => uploadQuality(t) >= MIN_QUALITY)
        .sort((a, b) => b.plays - a.plays)
        .filter((t) => {
          const key = dedupeKey(t.title) || t.id
          return !seen.has(key) && seen.add(key)
        })
        .map((t) => ({ ...t, collection: slug }))
    },
  )
  cache.set(slug, { at: Date.now(), tracks })
  // Don't cache failures
  tracks.then((list) => list.length || cache.delete(slug), () => cache.delete(slug))
  return tracks
}
