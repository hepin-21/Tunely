// Text helpers for messy user-uploaded titles: cleaning for display, keys for
// spotting duplicate uploads, and tokens for search relevance.

const SITE_TAGS =
  /\b(?:www\.)?(?:bdmuzik24|mymp3song|pagalworld|pagalnew|mr-?jatt|djpunjab|bestwap|songspk|wapking|downloadming|webmusic|djmaza|raag|pendujatt|hindiwap|masstamilan|naasongs|y2mate|savefrom)(?:\.[a-z]{2,4})?\b/gi
const DOMAIN = /\b(?:www\.)?[a-z0-9-]+\.(?:com|in|net|org|info|co|cc|me|io)\b/gi
const BITRATE = /\(\s*\d{2,3}\s?k(?:bps)?\s*\)|\b\d{2,3}\s?kbps\b/gi // "128 Kbps", "(256k)"
const BRACKET_NOISE =
  /[([]\s*(?:official(?:\s+(?:music|lyric(?:al)?))?\s+(?:video|audio)|full\s+(?:video|song|audio)|lyric(?:s|al)?(?:\s+video)?|audio|hd|4k|hq|video\s+song|mp3)\s*[)\]]/gi

/** Turns "Pal___%5BSlowed_And_Reverb%5D_-_Arijit_Singh" into "Pal [Slowed And Reverb] - Arijit Singh". */
export function cleanTitle(raw: string): string {
  let t = raw ?? ''
  if (/%[0-9a-f]{2}/i.test(t)) {
    try {
      t = decodeURIComponent(t)
    } catch {
      t = t.replace(/%5B/gi, '[').replace(/%5D/gi, ']').replace(/%20/g, ' ')
    }
  }
  t = t.replace(/\.(mp3|m4a|wav|flac)$/i, '')
  // Underscores used as spaces (common in uploads from download sites)
  const underscores = (t.match(/_/g) ?? []).length
  if (underscores >= 2 || (underscores && !t.includes(' '))) t = t.replace(/_+/g, ' ')
  t = t
    .replace(SITE_TAGS, '')
    .replace(DOMAIN, '')
    .replace(BITRATE, '')
    .replace(BRACKET_NOISE, '')
    .replace(/[([]\s*[)\]]/g, '') // brackets left empty
    .replace(/\s*[|-]\s*([|-]\s*)+/g, ' - ') // "- -", "| |" runs
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|\-–:]+|[\s|\-–:]+$/g, '')
  // Drop "| Official Video", "| Lyrical Video" style segments that say nothing about the song
  t = t
    .split(/\s*\|\s*/)
    .filter((seg, i) => i === 0 || !tokens(seg).every((w) => UPLOAD_SEGMENT_WORDS.has(w)))
    .join(' | ')
  return t || (raw ?? '').trim()
}

const UPLOAD_SEGMENT_WORDS = new Set([
  'official', 'music', 'video', 'audio', 'lyric', 'lyrics', 'lyrical', 'full', 'song', 'hd', '4k', 'hq',
  'visualizer', 'new', 'latest', 'with', 'english', 'hindi', 'subtitles', 'sub',
])

// Words that say nothing about which song it is
const NOISE = new Set([
  'official', 'video', 'audio', 'lyrics', 'lyric', 'lyrical', 'full', 'song', 'songs', 'hd', 'hq', '4k', 'mp3', 'new',
  'latest', 'the', 'a', 'an', 'and', 'of', 'ft', 'feat', 'featuring', 'with', 'by', 'from', 'movie', 'film',
])

// Common short words in Hindi/English titles: fine for matching, too vague to search on alone
const STOPWORDS = new Set([
  ...NOISE, 'ka', 'ki', 'ke', 'ko', 'hai', 'hain', 'kya', 'ho', 'hi', 'na', 'se', 'me', 'mein', 'to', 'tu', 'de', 'ye',
  'yeh', 'wo', 'woh', 'main', 'mai', 'hum', 'tum', 'tera', 'teri', 'tere', 'mera', 'meri', 'mere', 'tujhe', 'mujhe',
  'tujh', 'mujh', 'i', 'you', 'me', 'my', 'is', 'in', 'on', 'it', 'for',
])

/** Lowercase word tokens; keeps letters of every script (Hindi, Tamil, …) and digits. */
export function tokens(text: string): string[] {
  return (text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter(Boolean)
}

/** Query words that identify the song (noise like "official video" removed). */
export function queryTokens(query: string): string[] {
  const all = tokens(query)
  const meaningful = all.filter((t) => !NOISE.has(t))
  return meaningful.length ? meaningful : all
}

/** Words worth searching on by themselves when the full query finds too little. */
export function significantTokens(query: string): string[] {
  return queryTokens(query).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

// Words describing a version of a song rather than which song it is
export const VERSION_WORDS = new Set([
  'slowed', 'reverb', 'lofi', 'lo', 'fi', 'remix', 'cover', '8d', 'instrumental', 'version', 'acoustic', 'unplugged',
  'mashup', 'female', 'male', 'karaoke', 'sped', 'up', 'bass', 'boosted', 'dj', 'mix', 'reprise',
])

/** Words naming the song itself: no version words, upload noise, years or the uploader's name. */
export function songWords(title: string, artist = ''): Set<string> {
  const own = new Set(tokens(artist))
  return new Set(tokens(title).filter((t) => !NOISE.has(t) && !VERSION_WORDS.has(t) && !own.has(t) && !/^(19|20)\d\d$/.test(t)))
}

/**
 * True when two titles are the same song in another upload or version:
 * "Tum Hi Ho (Slowed + Reverb)", "Arijit Singh - Tum Hi Ho" and "Tum Hi Ho | Cover" all match.
 * Takes the output of songWords().
 */
export function sameSong(a: Set<string>, b: Set<string>) {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  if (!small.size) return false
  let shared = 0
  for (const w of small) if (big.has(w)) shared++
  // One title inside the other ("Kesariya" in "Kesariya Brahmastra"); a single word only counts against a short title
  if (shared === small.size && (small.size >= 2 || big.size <= 2)) return true
  return shared / (a.size + b.size - shared) >= 0.75
}

/**
 * Same key for re-uploads of one song ("Pal [Slowed And Reverb]" by three accounts),
 * different keys for real versions (slowed, lofi, remix, cover, 8d…), which stay in their words.
 */
export function dedupeKey(title: string): string {
  return tokens(cleanTitle(title))
    .filter((t) => !NOISE.has(t) && !/^(19|20)\d\d$/.test(t))
    .join(' ')
}
