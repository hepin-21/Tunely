import type { Track } from '../api/audius'
import { artistKey, featuresOf } from './features'

// How you listen to each song: started, finished, skipped early, or played again.
// Liked songs live in the library; together they tell the recommender what you enjoy.
// Kept on this device only, like the rest of the library.

export interface ListenStats {
  plays: number
  completes: number
  skips: number
  repeats: number
  /** When it was last played (ms) */
  last: number
  artist: string
  genre: string
  language?: string
}

type Event = 'plays' | 'completes' | 'skips' | 'repeats'

const KEY = 'tunely.history'
const MAX = 500

let data: Record<string, ListenStats> | null = null

function load(): Record<string, ListenStats> {
  if (data) return data
  try {
    data = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    data = {}
  }
  return data!
}

function save() {
  const all = load()
  const ids = Object.keys(all)
  if (ids.length > MAX) {
    // Forget the songs played longest ago
    ids.sort((a, b) => all[a].last - all[b].last)
    for (const id of ids.slice(0, ids.length - MAX)) delete all[id]
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function record(track: Track, event: Event) {
  const all = load()
  const s = (all[track.id] ??= {
    plays: 0,
    completes: 0,
    skips: 0,
    repeats: 0,
    last: 0,
    artist: artistKey(track),
    // Only a believable genre, so a mislabelled upload doesn't teach the recommender a wrong taste
    genre: featuresOf(track).genre,
    language: featuresOf(track).language,
  })
  s[event]++
  if (event === 'plays') s.last = Date.now()
  save()
}

export const listening = {
  played: (t: Track) => record(t, 'plays'),
  finished: (t: Track) => record(t, 'completes'),
  skipped: (t: Track) => record(t, 'skips'),
  repeated: (t: Track) => record(t, 'repeats'),
  stats: (): Readonly<Record<string, ListenStats>> => load(),
}

/** Skipped early means "not this one": under 30 seconds and under half the song. */
export function isEarlySkip(heard: number, duration: number) {
  return heard < 30 && (!duration || heard < duration * 0.5)
}
