import type { Track } from '../api/audius'
import { keywordMatcher } from '../api/regional'
import { tokens } from './text'

// What a song "is" for recommendations: genre, style, artist, mood, language, tempo and version.
//
// Audius labels are picked by uploaders and are often wrong for regional music: a Hindi sad
// song filed under "Metal", a Bollywood mashup under "Hip-Hop/Rap", a party mix as "Peaceful".
// YouTube has no labels at all. So a label is only believed when the song's own words (title
// and tags) back it up, and the style (romantic, sad, party…) is read from those words directly.

export type Version = 'original' | 'lofi' | 'remix' | 'mashup' | 'cover' | 'acoustic' | 'instrumental'
export type Style = 'romantic' | 'sad' | 'party' | 'chill' | 'rap' | 'devotional' | 'sufi' | 'classic' | 'folk' | 'instrumental'

export interface SongFeatures {
  /** The Audius genre, or '' when the uploader's label isn't believable */
  genre: string
  /** Broad genre family, from a believable genre or else from the title and tags */
  family: string
  styles: Set<Style>
  /** Normalized artist name (the same singer can come from Audius and YouTube) */
  artist: string
  /** The Audius mood, or null when the title and tags contradict it */
  mood: string | null
  /** 0 = calm … 1 = intense */
  energy: number
  language: string | undefined
  bpm: number | null
  version: Version
  source: 'audius' | 'youtube'
  /** 0 = a rip, keyword-stuffed or generic compilation upload … 1 = a clean song upload */
  quality: number
}

const FAMILIES: Record<string, string> = {
  Electronic: 'electronic', House: 'electronic', 'Deep House': 'electronic', 'Tech House': 'electronic',
  'Progressive House': 'electronic', 'Future House': 'electronic', 'Tropical House': 'electronic', Techno: 'electronic',
  Trance: 'electronic', Electro: 'electronic', Disco: 'electronic', Hardstyle: 'electronic', Moombahton: 'electronic',
  Dubstep: 'bass', 'Drum & Bass': 'bass', 'Future Bass': 'bass', Jungle: 'bass', 'Glitch Hop': 'bass', 'Jersey Club': 'bass',
  'Hip-Hop/Rap': 'hiphop', Trap: 'hiphop', 'R&B/Soul': 'soul', Funk: 'soul', Blues: 'soul', Jazz: 'jazz',
  Pop: 'pop', Hyperpop: 'pop', Dancehall: 'world', Latin: 'world', World: 'world', Reggae: 'world',
  Rock: 'rock', Alternative: 'rock', Metal: 'rock', Punk: 'rock', Experimental: 'rock',
  'Lo-Fi': 'chill', Ambient: 'chill', Downtempo: 'chill', Vaporwave: 'chill',
  Acoustic: 'acoustic', Folk: 'acoustic', Country: 'acoustic',
  Classical: 'classical', Soundtrack: 'soundtrack', Devotional: 'devotional',
}

const DEVOTIONAL_WORDS = [
  'bhajan', 'kirtan', 'aarti', 'mantra', 'chalisa', 'gurbani', 'shabad', 'bhakti', 'devotional', 'krishna', 'shiva',
  'shiv', 'mahadev', 'hanuman', 'ganesh', 'radhe', 'radha', 'jai shri', 'sai baba', 'worship', 'gospel', 'hymn',
]

// Words that back up a genre family. Most specific first: a "Bollywood remix" is dance music.
const FAMILY_WORDS: [string, string[]][] = [
  ['devotional', DEVOTIONAL_WORDS],
  ['hiphop', ['rap', 'rapper', 'hip hop', 'hiphop', 'trap', 'drill', 'gully', 'freestyle', 'cypher']],
  ['bass', ['dubstep', 'dnb', 'drum and bass', 'bass', 'phonk', 'slaphouse', 'riddim']],
  ['electronic', ['edm', 'electronic', 'house', 'techno', 'trance', 'electro', 'remix', 'dj', 'club']],
  ['rock', ['rock', 'metal', 'punk', 'grunge']],
  ['chill', ['lofi', 'lo-fi', 'lo fi', 'chill', 'chillout', 'ambient', 'slowed', 'reverb', 'downtempo']],
  ['classical', ['classical', 'raag', 'raga', 'orchestra', 'symphony', 'sitar']],
  ['acoustic', ['acoustic', 'unplugged', 'folk', 'fingerstyle']],
  ['soul', ['rnb', 'r&b', 'soul', 'funk', 'blues']],
  ['jazz', ['jazz']],
  ['world', ['reggae', 'reggaeton', 'afro', 'latin', 'dancehall']],
  ['soundtrack', ['bollywood', 'tollywood', 'kollywood', 'film', 'movie', 'ost', 'soundtrack']],
]

const STYLE_WORDS: [Style, string[]][] = [
  ['devotional', DEVOTIONAL_WORDS],
  ['sufi', ['sufi', 'qawwali', 'ghazal', 'nusrat', 'rahat fateh', 'maula', 'khwaja']],
  ['chill', ['lofi', 'lo-fi', 'lo fi', 'slowed', 'reverb', 'chill', 'chillout', 'sleep', 'study', 'relax', 'calm']],
  ['rap', ['rap', 'rapper', 'hip hop', 'hiphop', 'drill', 'trap', 'gully', 'freestyle', 'cypher', 'diss']],
  ['party', ['party', 'dance', 'club', 'dj', 'remix', 'bhangra', 'edm', 'banger', 'dhol', 'nonstop']],
  ['sad', ['sad', 'broken', 'bewafa', 'dard', 'judaai', 'judai', 'tanha', 'alone', 'heartbreak', 'breakup', 'emotional', 'rona', 'dukh', 'tears', 'heart touching']],
  ['romantic', ['love', 'ishq', 'pyar', 'pyaar', 'romantic', 'romance', 'mohabbat', 'sanam', 'valentine', 'wedding', 'shaadi', 'jaan']],
  ['classic', ['90s', '80s', '70s', 'old is gold', 'retro', 'evergreen', 'kishore kumar', 'rafi', 'lata mangeshkar', 'mukesh']],
  ['folk', ['folk', 'garba', 'dandiya', 'raas', 'lok geet', 'bhavai', 'lavani', 'baul']],
  ['instrumental', ['instrumental', 'piano', 'flute', 'violin', 'sitar', 'karaoke', 'bgm', 'fingerstyle']],
]

const STYLE_ENERGY: Record<Style, number> = {
  chill: 0.15, sad: 0.25, devotional: 0.25, instrumental: 0.3, romantic: 0.35, sufi: 0.4, classic: 0.4,
  rap: 0.7, folk: 0.7, party: 0.85,
}

// Audius moods on a calm → intense scale, and the style each one implies
const MOOD_ENERGY: Record<string, number> = {
  Peaceful: 0.1, Tender: 0.2, Melancholy: 0.25, Sentimental: 0.25, Yearning: 0.3, Romantic: 0.3, Easygoing: 0.35,
  Sensual: 0.35, Sophisticated: 0.4, Cool: 0.45, Brooding: 0.45, Serious: 0.5, Stirring: 0.6, Gritty: 0.65,
  Upbeat: 0.7, Empowering: 0.7, Excited: 0.8, Defiant: 0.8, Energizing: 0.85, Fiery: 0.85, Rowdy: 0.9, Aggressive: 0.95,
}
const MOOD_STYLE: Record<string, Style> = {
  Romantic: 'romantic', Sensual: 'romantic', Tender: 'romantic', Melancholy: 'sad', Sentimental: 'sad', Yearning: 'sad',
  Brooding: 'sad', Peaceful: 'chill', Energizing: 'party', Excited: 'party', Rowdy: 'party', Upbeat: 'party',
}

const FAMILY_ENERGY: Record<string, number> = {
  electronic: 0.75, bass: 0.85, hiphop: 0.65, soul: 0.45, jazz: 0.4, pop: 0.6, rock: 0.7, chill: 0.2,
  acoustic: 0.3, classical: 0.25, world: 0.6, devotional: 0.25, soundtrack: 0.5,
}

// What a regional collection says about its songs
const LANGUAGE_OF: Record<string, string> = { 'hindi-lofi': 'hindi', retro: 'hindi', 'desi-hiphop': 'hindi', sufi: 'hindi' }
const COLLECTION_STYLE: Record<string, Style> = { 'hindi-lofi': 'chill', 'desi-hiphop': 'rap', sufi: 'sufi', devotional: 'devotional', retro: 'classic' }
// Genres whose label (once believed) says something about the style
const GENRE_STYLE: Record<string, Style> = { 'Hip-Hop/Rap': 'rap', Trap: 'rap', 'Lo-Fi': 'chill', Devotional: 'devotional', Folk: 'folk' }

/**
 * Matches keywords as whole words in the title, and inside tags, which uploaders
 * often run together ("sadsongs", "lovemashup2025").
 */
function wordMatcher(keywords: string[]) {
  const inTitle = keywordMatcher(keywords)
  const squashed = keywords.map((k) => k.replace(/[\s-]+/g, ''))
  return (title: string, tags: string[]) =>
    inTitle(title) || tags.some((tag) => squashed.some((k) => (k.length >= 4 ? tag.includes(k) : tag.startsWith(k))))
}
const FAMILY_MATCHERS = FAMILY_WORDS.map(([family, words]) => [family, wordMatcher(words)] as const)
const STYLE_MATCHERS = STYLE_WORDS.map(([style, words]) => [style, wordMatcher(words)] as const)

// Titles made only of these words name a compilation, not a song ("Wedding Songs", "90s Hindi Love Songs")
const GENERIC = new Set([
  'songs', 'song', 'hindi', 'bollywood', 'punjabi', 'tamil', 'telugu', 'gujarati', 'english', 'mix', 'mashup', 'wedding',
  'sad', 'romantic', 'love', 'new', 'latest', 'best', 'top', 'hits', 'hit', 'super', 'superhit', 'jukebox', 'nonstop',
  'non', 'stop', 'collection', 'playlist', 'chillout', 'chill', 'lofi', 'lo', 'fi', 'remix', 'party', 'dance', 'music',
  'mp3', 'dj', 'video', 'audio', 'old', 'evergreen', 'all', 'of', 'the', 'and', 'vol', 'volume', 'part', 'slowed',
  'reverb', 'vibes', 'feel', 'romance', 'full', 'lyrics', 'lyric', 'lyrical', 'official', 'hd',
])

/** Title words without numbers and stray letters ("90’S" → nothing, "Mashup 2024" → "mashup"). */
const titleWords = (title: string) => tokens(title).filter((w) => w.length > 1 && !/^\d+$/.test(w))

/** Nothing in the title names a song: "Bollywood Love Hindi Songs Best Hindi Love 2024". */
const isGenericTitle = (words: string[]) => words.every((w) => GENERIC.has(w))

function versionOf(words: string[]): Version {
  const set = new Set(words)
  const has = (...w: string[]) => w.some((x) => set.has(x))
  // Mashups, medleys and compilations: many songs in one upload. "Songs"/"hits" alone isn't enough,
  // since real songs carry it as SEO ("DEATH ROUTE (Sidhu Moosewala) Latest Punjabi Songs 2018")
  const named = words.filter((w) => !GENERIC.has(w)).length
  if (has('mashup', 'medley', 'nonstop', 'jukebox') || (has('non') && has('stop')) || (has('songs', 'hits') && named <= 2)) {
    return 'mashup'
  }
  if (has('instrumental', 'karaoke', 'bgm', 'piano', 'flute', 'fingerstyle')) return 'instrumental'
  if (has('slowed', 'reverb', 'lofi', 'lo')) return 'lofi'
  if (has('remix', 'dj', 'boosted', 'sped', 'edit', 'bootleg', 'phonk')) return 'remix'
  if (has('acoustic', 'unplugged')) return 'acoustic'
  if (has('cover', 'female', 'male', 'reprise')) return 'cover'
  return 'original'
}

const RIP = /_\d{3}\b|\(\s*\.\w{2,4}\s*\)|\bmp3\b|\bdownload\b|\b(?:320|128)\s?kbps\b/i // "We Rollin_320(.se)", "… Download Mp3"
const SEO = /\b(?:new|latest)\b.*\bsongs?\b|\b(?:new|latest)\s+(?:19|20)\d\d\b/i // "New Song 2025 New Hindi Song …"
const TRACK_NUMBER = /^\s*\d{1,2}[\s.)_-]+\D/ // "09 Bollywood …", ripped from an album

/**
 * Below this an upload is a generic compilation or pure keyword spam, not a song worth listing or
 * queueing. Real songs with messy titles (rips, SEO words) stay above it and just rank lower.
 */
export const MIN_QUALITY = 0.35

/** How much an upload looks like a clean song rather than a compilation, a rip or keyword spam. */
export function uploadQuality(t: Track): number {
  const words = titleWords(t.title)
  let q = 1
  if (isGenericTitle(words)) q -= 0.7
  else if (versionOf(words) === 'mashup') q -= 0.2
  if (RIP.test(t.title)) q -= 0.2
  if (SEO.test(t.title)) q -= 0.2
  // The same keyword stuffed in three times ("Mashup 2024 Bollywood Mashup 2024 New Song Mashup")
  const counts = new Map<string, number>()
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  if ([...counts.values()].some((n) => n >= 3)) q -= 0.2
  if (TRACK_NUMBER.test(t.title)) q -= 0.1
  if (t.title.length > 60) q -= 0.1
  if (t.plays < 20 && t.likes === 0) q -= 0.1
  return Math.max(0, q)
}

export const artistKey = (t: Track) => tokens(t.artist).join(' ')

const cache = new WeakMap<Track, SongFeatures>()

export function featuresOf(t: Track): SongFeatures {
  const hit = cache.get(t)
  if (hit) return hit
  const title = t.title.toLowerCase()
  const tags = (t.tags ?? '').toLowerCase().split(',').map((s) => s.trim().replace(/[\s-]+/g, '')).filter(Boolean)
  const version = versionOf(titleWords(t.title))
  const language = t.collection ? (LANGUAGE_OF[t.collection] ?? t.collection) : undefined

  // Genre: believed when the words back it up. Regional uploads need that backing; English ones
  // are believed unless their words point to another family.
  const found = FAMILY_MATCHERS.filter(([, match]) => match(title, tags)).map(([family]) => family)
  const own = FAMILIES[t.genre] ?? ''
  const genreOk = !!own && (found.includes(own) || (!language && !found.length))
  const family = genreOk ? own : (found[0] ?? (version === 'lofi' ? 'chill' : ''))

  // Style: from the words, the collection and a believable genre; the mood only fills in when the words say nothing
  const styles = new Set<Style>(STYLE_MATCHERS.filter(([, match]) => match(title, tags)).map(([style]) => style))
  const wordEnergy = styles.size ? [...styles].reduce((sum, s) => sum + STYLE_ENERGY[s], 0) / styles.size : null
  const moodStyle = t.mood ? MOOD_STYLE[t.mood] : undefined
  const moodEnergy = t.mood ? MOOD_ENERGY[t.mood] : undefined
  // A "Peaceful" party mashup: the uploader's mood contradicts what the song says about itself
  const moodOk =
    moodEnergy != null && (wordEnergy == null || (moodStyle != null && styles.has(moodStyle)) || Math.abs(moodEnergy - wordEnergy) < 0.4)
  if (!styles.size && moodOk && moodStyle) styles.add(moodStyle)
  if (t.collection && COLLECTION_STYLE[t.collection]) styles.add(COLLECTION_STYLE[t.collection])
  if (genreOk && GENRE_STYLE[t.genre]) styles.add(GENRE_STYLE[t.genre])

  const bpm = t.bpm ?? null
  let energy = moodOk ? moodEnergy! : (wordEnergy ?? FAMILY_ENERGY[family] ?? 0.5)
  if (bpm) energy = energy * 0.7 + Math.min(1, Math.max(0, (bpm - 60) / 100)) * 0.3
  if (version === 'lofi') energy = Math.min(energy, 0.3)

  const f: SongFeatures = {
    genre: genreOk ? t.genre : '',
    family,
    styles,
    artist: artistKey(t),
    mood: moodOk ? t.mood : null,
    energy,
    language,
    bpm,
    version,
    source: t.source ?? 'audius',
    quality: uploadQuality(t),
  }
  cache.set(t, f)
  return f
}

/** The genre to show for a track, or '' when the uploader's label isn't believable. */
export const trustedGenre = (t: Track) => featuresOf(t).genre

/** For genre charts: drops regional uploads whose label isn't backed up (Hindi songs in the Metal chart). */
export const belongsInGenre = (genre: string) => (t: Track) => !featuresOf(t).language || trustedGenre(t) === genre

/** How close two tempos feel, allowing half/double time (a 70 BPM ballad sits fine next to 140 BPM trap). */
function tempoMatch(a: number | null, b: number | null, energyGap: number) {
  if (!a || !b) return 1 - energyGap
  const gap = Math.min(Math.abs(a - b), Math.abs(a * 2 - b), Math.abs(a - b * 2))
  return Math.max(0, 1 - gap / 30)
}

function versionMatch(a: Version, b: Version) {
  if (a === b) return 1
  // Someone on a lo-fi run wants more lo-fi; an original fits next to covers and acoustic takes
  if ([a, b].some((v) => v === 'lofi' || v === 'instrumental' || v === 'mashup')) return 0.1
  return a === 'original' || b === 'original' ? 0.6 : 0.4
}

function overlap<T>(a: Set<T>, b: Set<T>) {
  let shared = 0
  for (const x of a) if (b.has(x)) shared++
  return shared / (a.size + b.size - shared)
}

/** Content similarity of `b` to `a`, from 0 (nothing alike) to 1. */
export function similarity(a: SongFeatures, b: SongFeatures): number {
  const language = a.language ? (a.language === b.language ? 1 : 0) : b.language ? 0.2 : 1
  // Unknown (not believable) genres count as neutral rather than as a match or a clash
  const genre = a.genre && a.genre === b.genre ? 1 : a.family && a.family === b.family ? 0.7 : !a.family || !b.family ? 0.3 : 0
  const style = a.styles.size && b.styles.size ? overlap(a.styles, b.styles) : 0.3
  const energyGap = Math.abs(a.energy - b.energy)
  const mood = a.mood && a.mood === b.mood ? 1 : 1 - energyGap
  const artist = a.artist && a.artist === b.artist ? 1 : 0
  return (
    language * 0.22 +
    genre * 0.12 +
    style * 0.15 +
    mood * 0.12 +
    tempoMatch(a.bpm, b.bpm, energyGap) * 0.1 +
    versionMatch(a.version, b.version) * 0.12 +
    artist * 0.1 +
    (a.source === b.source ? 1 : 0) * 0.07
  )
}
