// Indian music collections. Audius has no "language" field, so each collection is
// a set of searches plus keywords that a track must mention to count as a match.

export interface RegionalCollection {
  slug: string
  name: string
  description: string
  color: string
  queries: string[]
  keywords: string[]
  /** Words that rule a track out, e.g. Tagalog, where "hindi" means "not" */
  exclude?: string[]
}

// "hindi" is a very common Tagalog word, so Filipino songs would otherwise pass as Hindi
const TAGALOG_WORDS = [
  'ikaw', 'ako', 'lang', 'mahal kita', 'sana', 'pag-ibig', 'puso', 'tayo', 'naman', 'kayo', 'hindi na', 'hindi ko',
  'hindi mo', 'opm', 'tagalog', 'pinoy', 'filipino', 'pilipinas',
]

// Common words in romanized Hindi song titles, plus artists and film-music terms
const HINDI_WORDS = [
  'hindi', 'bollywood', 'hindustani', 'desi', 'arijit', 'atif aslam', 'shreya ghoshal', 'jubin', 'neha kakkar',
  'sonu nigam', 'kumar sanu', 'udit narayan', 'alka yagnik', 'kishore kumar', 'lata', 'rafi', 'mohit chauhan',
  'badshah', 'honey singh', 'pritam', 'vishal', 'dil', 'pyar', 'pyaar', 'ishq', 'mohabbat', 'sanam', 'tera', 'teri',
  'mera', 'meri', 'tujhe', 'mujhe', 'tumhe', 'jaana', 'sajna', 'yaara', 'yaar', 'zindagi', 'aashiqui', 'kesariya',
  'raabta', 'channa', 'mahi', 'dilbar', 'saiyaan', 'humsafar', 'khwab', 'deewani', 'mastani', 'jaan', 'dhadkan',
  'kabhi', 'judaai', 'tum hi ho', 'bekhayali', 'shayad', 'muskurahat',
]

const PUNJABI_WORDS = ['punjabi', 'bhangra', 'sidhu', 'moose wala', 'diljit', 'jatt', 'jutt', 'punjab', 'karan aujla', 'ap dhillon', 'gurdas maan', 'babbu maan']
const TAMIL_WORDS = ['tamil', 'kollywood', 'anirudh', 'ilaiyaraaja', 'kaavaalaa', 'vaathi']
const TELUGU_WORDS = ['telugu', 'tollywood', 'srivalli', 'pushpa', 'thaman']

export const REGIONAL: RegionalCollection[] = [
  {
    slug: 'hindi',
    name: 'Hindi & Bollywood',
    description: 'Bollywood covers, remixes, mashups and independent Hindi songs',
    color: '#e11d48',
    queries: ['bollywood', 'hindi songs', 'hindi', 'arijit singh', 'bollywood remix', 'hindi romantic'],
    keywords: HINDI_WORDS,
    exclude: TAGALOG_WORDS,
  },
  {
    slug: 'hindi-lofi',
    name: 'Hindi Lo-Fi',
    description: 'Slowed, reverb and lo-fi versions of Hindi favourites',
    color: '#0d9488',
    queries: ['hindi lofi', 'bollywood lofi', 'lofi hindi songs', 'hindi slowed reverb'],
    keywords: HINDI_WORDS,
    exclude: TAGALOG_WORDS,
  },
  {
    slug: 'retro',
    name: '90s & Retro Hindi',
    description: 'Old-school Hindi melodies and 90s nostalgia',
    color: '#b45309',
    queries: ['90s hindi songs', 'old hindi songs', 'kishore kumar', 'lata mangeshkar', 'mohammed rafi', 'retro bollywood'],
    keywords: [...HINDI_WORDS, '90s', 'retro', 'old songs'],
    exclude: TAGALOG_WORDS,
  },
  {
    slug: 'punjabi',
    name: 'Punjabi',
    description: 'Bhangra beats and Punjabi hits',
    color: '#ea580c',
    queries: ['punjabi', 'bhangra', 'punjabi songs', 'sidhu moose wala', 'diljit'],
    keywords: PUNJABI_WORDS,
  },
  {
    slug: 'desi-hiphop',
    name: 'Desi Hip-Hop',
    description: 'Hindi rap and gully beats',
    color: '#4f46e5',
    queries: ['hindi rap', 'desi hip hop', 'desi rap', 'gully rap', 'divine rap', 'raftaar'],
    keywords: [...HINDI_WORDS, 'gully', 'divine', 'raftaar', 'emiway', 'mc stan', 'krsna'],
    exclude: TAGALOG_WORDS,
  },
  {
    slug: 'sufi',
    name: 'Sufi & Qawwali',
    description: 'Soulful Sufi, qawwali and ghazals',
    color: '#0f766e',
    queries: ['sufi', 'qawwali', 'ghazal', 'nusrat fateh ali khan', 'rahat fateh ali khan'],
    keywords: ['sufi', 'qawwali', 'ghazal', 'nusrat', 'rahat', 'fateh ali', 'maula', 'khwaja', 'allah hoo'],
  },
  {
    slug: 'devotional',
    name: 'Bhakti & Devotional',
    description: 'Bhajans, kirtan, mantras and aartis',
    color: '#d97706',
    queries: ['bhajan', 'kirtan', 'krishna', 'shiva mantra', 'hanuman chalisa', 'gurbani'],
    keywords: [
      'bhajan', 'kirtan', 'krishna', 'shiva', 'shiv', 'mahadev', 'hanuman', 'chalisa', 'aarti', 'gurbani', 'shabad',
      'ganesh', 'radhe', 'radha', 'bhakti', 'devotional', 'jai shri', 'sita ram', 'om namah', 'gayatri', 'durga',
    ],
  },
  {
    slug: 'tamil',
    name: 'Tamil',
    description: 'Kollywood hits, Tamil lo-fi and indie',
    color: '#7c3aed',
    queries: ['tamil', 'tamil songs', 'anirudh', 'tamil lofi'],
    keywords: TAMIL_WORDS,
  },
  {
    slug: 'telugu',
    name: 'Telugu',
    description: 'Tollywood vibes and Telugu indie',
    color: '#2563eb',
    queries: ['telugu', 'telugu songs', 'tollywood'],
    keywords: TELUGU_WORDS,
  },
]

export function findRegional(slug: string) {
  return REGIONAL.find((c) => c.slug === slug)
}

/** Builds a whole-word matcher, so "tum" matches "Tum Hi Ho" but not "tumble". */
export function keywordMatcher(keywords: string[]) {
  const escaped = keywords.map((k) => k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(?:^|[^\\p{L}])(?:${escaped.join('|')})(?:[^\\p{L}]|$)`, 'iu')
  return (text: string) => re.test(text)
}

// Language detection for any track (search results too), so autoplay can stay in that language.
// Order matters: more specific languages are checked before Hindi.
const isTagalog = keywordMatcher(TAGALOG_WORDS)
const isHindi = keywordMatcher(HINDI_WORDS)
const DETECTORS: [string, (text: string) => boolean][] = [
  ['punjabi', keywordMatcher(PUNJABI_WORDS)],
  ['tamil', keywordMatcher(TAMIL_WORDS)],
  ['telugu', keywordMatcher(TELUGU_WORDS)],
  ['hindi', (text) => isHindi(text) && !isTagalog(text)],
]

/** Raw phone recordings and downloader leftovers, e.g. "AUD-20220121-WA0012", "y2mate.com - …" */
export function isJunkTitle(title: string) {
  return /^(aud|vid|rec|audio|voice|ptt)[-_ ]?\d{6,}/i.test(title) || /y2mate|savefrom|\.mp3$/i.test(title)
}

// Devanagari / Gurmukhi / Tamil / Telugu script in the title is a strong signal too
const SCRIPTS: [string, RegExp][] = [
  ['punjabi', /\p{Script=Gurmukhi}/u],
  ['tamil', /\p{Script=Tamil}/u],
  ['telugu', /\p{Script=Telugu}/u],
  ['hindi', /\p{Script=Devanagari}/u],
]

export function detectLanguage(title: string, tags: string, artist: string): string | undefined {
  for (const [slug, re] of SCRIPTS) if (re.test(title)) return slug
  const text = `${title} ${tags} ${artist}`
  return DETECTORS.find(([, match]) => match(text))?.[0]
}
