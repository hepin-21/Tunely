import { audius, type Track } from '../api/audius'
import { dedupeKey, queryTokens, significantTokens, tokens, VERSION_WORDS } from './text'

// Audius search returns at most ~30 tracks and needs every word to match, so a
// full song name ("kya fitoor door raha") often finds nothing. We fall back to
// shorter pieces of the query, then rank everything ourselves.

export interface SongSearch {
  tracks: Track[] // ranked, de-duplicated, full-length songs
  top: Track | null // best match, shown big
  shortClips: Track[] // under a minute (ringtones, previews), hidden by default
  duplicates: number // extra uploads of the same song that were merged away
  closestOnly: boolean // nothing matched the full query; these are partial matches
}

const MIN_DURATION = 60
const ENOUGH_RESULTS = 12
const WANTS_CLIPS = /\b(ringtone|tone|bgm|clip|intro|status|shorts?)\b/i

function merge(lists: Track[][]): Track[] {
  const seen = new Set<string>()
  return lists.flat().filter((t) => !seen.has(t.id) && seen.add(t.id))
}

/** Shorter searches to try: pairs of neighbouring words, then the most distinctive single words. */
function fallbackQueries(query: string): string[] {
  const words = queryTokens(query)
  const significant = new Set(significantTokens(query))
  const pairs: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    if (significant.has(words[i]) || significant.has(words[i + 1])) pairs.push(`${words[i]} ${words[i + 1]}`)
  }
  const singles = [...significant].sort((a, b) => b.length - a.length)
  const full = words.join(' ')
  return [...new Set([...pairs.slice(0, 3), ...singles.slice(0, 3)])].filter((q) => q !== full)
}

interface Scored {
  track: Track
  coverage: number // share of query words found in title or artist
  coreHit: boolean // matched at least one word naming the song (not just "slowed"/"remix")
  strongHit: boolean // title has a long, distinctive query word like "fitoor"
  score: number
}

interface QueryInfo {
  words: string[]
  phrase: string
  core: string[] // words that name the song: not version words, and not common words like "tera" if there's anything better
  strong: string[] // distinctive words (5+ letters, not stopwords or version words)
  partial: string // last word, which may still be half-typed ("arij" → "arijit")
}

function scoreTrack(track: Track, q: QueryInfo): Scored {
  const title = tokens(track.title)
  const artist = tokens(track.artist)
  // Whole-word matches, except the last word may be a prefix while the user is still typing
  const has = (words: string[], w: string) =>
    words.some((x) => x === w || (w === q.partial && w.length >= 3 && x.startsWith(w)))

  let inTitle = 0
  let inArtist = 0
  let inEither = 0
  for (const w of q.words) {
    const a = has(title, w)
    const b = has(artist, w)
    if (a) inTitle++
    if (b) inArtist++
    if (a || b) inEither++
  }
  const n = Math.max(1, q.words.length)
  const coverage = inEither / n
  const exactPhrase = q.phrase.length > 2 && title.join(' ').includes(q.phrase) ? 2 : 0
  const relevance = coverage * 4 + (inTitle / n) * 2 + inArtist / n + exactPhrase
  // Popularity only breaks ties between similarly relevant songs
  const popularity = Math.log10(track.plays + 1) * 0.5 + Math.log10(track.likes + 1) * 0.3
  return {
    track,
    coverage,
    coreHit: !q.core.length || q.core.some((w) => has(title, w) || has(artist, w)),
    strongHit: q.strong.some((w) => has(title, w)),
    score: relevance + popularity,
  }
}

// Rank by how much of the query matched first (in steps, so 3/3 beats 2/3), then by score
const byRelevance = (a: Scored, b: Scored) =>
  Math.round(b.coverage * 10) - Math.round(a.coverage * 10) || b.score - a.score

/** True when every meaningful word of the query is in the track's title or artist. */
export function matchesAllWords(track: Track, query: string) {
  const qt = queryTokens(query)
  const words = [...tokens(track.title), ...tokens(track.artist)]
  const last = qt[qt.length - 1]
  return qt.length > 0 && qt.every((w) => words.some((x) => x === w || (w === last && w.length >= 3 && x.startsWith(w))))
}

/**
 * Keeps artists/playlists whose name actually contains a meaningful query word
 * (Audius matches these very loosely, e.g. "tum hi ho" returns unrelated artists).
 */
export function matchingByName<T>(items: T[], name: (item: T) => string, query: string): T[] {
  const qt = queryTokens(query)
  const words = significantTokens(query).length ? significantTokens(query) : qt
  const last = qt[qt.length - 1]
  const matches = (item: T) => {
    const nameTokens = tokens(name(item))
    const joined = nameTokens.join('')
    return words.filter(
      (w) => nameTokens.some((x) => x === w || (w === last && w.length >= 3 && x.startsWith(w))) || (w.length >= 4 && joined.includes(w)),
    ).length
  }
  // Names matching more of the query come first ("Arijit Singh" before "Paal Singh")
  return items
    .map((item, i) => ({ item, i, n: matches(item) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.item)
}

export async function searchSongs(query: string): Promise<SongSearch> {
  const qt = queryTokens(query)
  const phrase = qt.join(' ')

  const exact = await audius.searchTracks(query, 100)
  const exactIds = new Set(exact.map((t) => t.id))
  const longExact = exact.filter((t) => t.duration >= MIN_DURATION)

  let pool = exact
  if (longExact.length < ENOUGH_RESULTS && qt.length > 1) {
    const more = await Promise.all(fallbackQueries(query).map((q) => audius.searchTracks(q, 100).catch(() => [] as Track[])))
    pool = merge([exact, ...more])
  }

  const songWords = qt.filter((w) => !VERSION_WORDS.has(w))
  const significant = new Set(significantTokens(query))
  const distinctiveSongWords = songWords.filter((w) => significant.has(w))
  const info: QueryInfo = {
    words: qt,
    phrase,
    core: distinctiveSongWords.length ? distinctiveSongWords : songWords,
    strong: distinctiveSongWords.filter((w) => w.length >= 5),
    partial: qt[qt.length - 1] ?? '',
  }
  const all = pool.map((t) => scoreTrack(t, info))

  // Partial matches must cover a fair share of the words (or "door" alone would match half the
  // catalog), or contain a distinctive word like "fitoor". Either way they must name the song:
  // "pal slowed reverb" shouldn't return every slowed+reverb track.
  const minCoverage = qt.length >= 3 ? 0.4 : qt.length === 2 ? 0.5 : 0.01
  let scored = all.filter((s) => s.coreHit && (s.coverage >= minCoverage || s.strongHit))
  // Audius sometimes matches on tags/descriptions we can't see; keep those only if nothing else matched
  if (!scored.length) scored = all.filter((s) => exactIds.has(s.track.id))
  scored.sort(byRelevance)

  // Keep the best-scoring copy of each song; spam re-uploads collapse into one
  const byKey = new Map<string, Scored>()
  for (const s of scored) {
    const key = dedupeKey(s.track.title) || s.track.id
    if (!byKey.has(key)) byKey.set(key, s)
  }
  const unique = [...byKey.values()]
  const duplicates = scored.length - unique.length

  const keepClips = WANTS_CLIPS.test(query)
  const full = unique.filter((s) => keepClips || s.track.duration >= MIN_DURATION)
  const shortClips = keepClips ? [] : unique.filter((s) => s.track.duration < MIN_DURATION).map((s) => s.track)

  const best = full[0]
  return {
    tracks: full.map((s) => s.track),
    top: best && best.coverage >= 0.99 ? best.track : null,
    shortClips,
    duplicates,
    closestOnly: full.length > 0 && best.coverage < 0.99,
  }
}
