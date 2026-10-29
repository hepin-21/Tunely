// Popular singers with their own playlist page (/singer/:slug). Their official songs
// come from YouTube (needs a key); covers and remixes come from Audius.

export type SingerGroup = 'bollywood' | 'punjabi' | 'indie' | 'garba' | 'classic'

export interface Singer {
  slug: string
  name: string
  color: string
  /** Shown under the name */
  tagline: string
  group: SingerGroup
  /** Other spellings used in YouTube titles ("Gadhvi" / "Gadhavi", Gujarati script) */
  aliases?: string[]
  /** Extra words for the YouTube search, e.g. "garba" */
  query?: string
  /** Longest upload to keep, in minutes (Garba nonstop sets run long) */
  maxMinutes?: number
}

export const SINGER_GROUPS: { group: SingerGroup; title: string; subtitle: string }[] = [
  { group: 'bollywood', title: 'Popular singers', subtitle: 'Full playlists of their songs' },
  { group: 'garba', title: 'Garba & Dandiya', subtitle: 'Gujarati garba, raas and nonstop Navratri sets' },
  { group: 'punjabi', title: 'Punjabi singers', subtitle: 'Bhangra, pop and hip-hop' },
  { group: 'indie', title: 'Indie artists', subtitle: 'Acoustic and singer-songwriters' },
  { group: 'classic', title: 'Golden era', subtitle: 'Timeless classics' },
]

const GARBA = { group: 'garba' as const, maxMinutes: 90 }

export const SINGERS: Singer[] = [
  { slug: 'darshan-raval', name: 'Darshan Raval', color: '#e11d48', tagline: 'Romantic Hindi & Gujarati', group: 'bollywood' },
  { slug: 'arijit-singh', name: 'Arijit Singh', color: '#7c3aed', tagline: 'Bollywood romance & soul', group: 'bollywood' },
  { slug: 'shreya-ghoshal', name: 'Shreya Ghoshal', color: '#db2777', tagline: 'Melodies across languages', group: 'bollywood' },
  { slug: 'jubin-nautiyal', name: 'Jubin Nautiyal', color: '#0891b2', tagline: 'Soft Bollywood hits', group: 'bollywood' },
  { slug: 'atif-aslam', name: 'Atif Aslam', color: '#4f46e5', tagline: 'Timeless love songs', group: 'bollywood' },
  { slug: 'vishal-mishra', name: 'Vishal Mishra', color: '#0d9488', tagline: 'Heartfelt Hindi songs', group: 'bollywood' },
  { slug: 'armaan-malik', name: 'Armaan Malik', color: '#2563eb', tagline: 'Pop & Bollywood', group: 'bollywood' },
  { slug: 'b-praak', name: 'B Praak', color: '#9333ea', tagline: 'Emotional Punjabi & Hindi', group: 'bollywood' },
  { slug: 'neha-kakkar', name: 'Neha Kakkar', color: '#ea580c', tagline: 'Party & dance hits', group: 'bollywood' },
  { slug: 'sonu-nigam', name: 'Sonu Nigam', color: '#b45309', tagline: 'Classic Bollywood', group: 'bollywood' },
  { slug: 'kk', name: 'KK', color: '#475569', tagline: 'Evergreen 2000s hits', group: 'bollywood' },
  { slug: 'mohit-chauhan', name: 'Mohit Chauhan', color: '#65a30d', tagline: 'Soulful & folk', group: 'bollywood' },
  { slug: 'badshah', name: 'Badshah', color: '#c026d3', tagline: 'Desi hip-hop & party', group: 'bollywood' },

  { slug: 'falguni-pathak', name: 'Falguni Pathak', color: '#d946ef', tagline: 'Queen of Dandiya', query: 'garba dandiya', aliases: ['ફાલ્ગુની પાઠક'], ...GARBA },
  { slug: 'kinjal-dave', name: 'Kinjal Dave', color: '#f43f5e', tagline: 'Gujarati garba superstar', aliases: ['કિંજલ દવે'], ...GARBA },
  { slug: 'geeta-rabari', name: 'Geeta Rabari', color: '#f97316', tagline: 'Kutchi folk & garba', aliases: ['ગીતા રબારી', 'Gita Rabari'], ...GARBA },
  { slug: 'aishwarya-majmudar', name: 'Aishwarya Majmudar', color: '#ec4899', tagline: 'Garba & Gujarati pop', aliases: ['ઐશ્વર્યા મજમુદાર', 'Aishwarya Majmundar'], ...GARBA },
  { slug: 'kirtidan-gadhvi', name: 'Kirtidan Gadhvi', color: '#ca8a04', tagline: 'Lok dayro & garba', aliases: ['કિર્તીદાન ગઢવી', 'કીર્તિદાન ગઢવી', 'Kirtidan Gadhavi'], ...GARBA },
  { slug: 'osman-mir', name: 'Osman Mir', color: '#0e7490', tagline: 'Gujarati folk & garba', aliases: ['ઓસમાણ મીર'], ...GARBA },
  { slug: 'aditya-gadhvi', name: 'Aditya Gadhvi', color: '#16a34a', tagline: 'Khalasi & Gujarati folk', aliases: ['આદિત્ય ગઢવી', 'Aditya Gadhavi'], ...GARBA },
  { slug: 'parthiv-gohil', name: 'Parthiv Gohil', color: '#7c2d12', tagline: 'Navratri garba nights', query: 'garba', aliases: ['પાર્થિવ ગોહિલ'], ...GARBA },
  { slug: 'atul-purohit', name: 'Atul Purohit', color: '#a21caf', tagline: 'Traditional garba king', query: 'garba', aliases: ['અતુલ પુરોહિત'], ...GARBA },
  { slug: 'bhoomi-trivedi', name: 'Bhoomi Trivedi', color: '#be123c', tagline: 'Garba & Bollywood', query: 'garba', aliases: ['ભૂમિ ત્રિવેદી'], ...GARBA },
  { slug: 'kajal-maheriya', name: 'Kajal Maheriya', color: '#c2410c', tagline: 'Gujarati folk & garba', aliases: ['કાજલ મહેરિયા'], ...GARBA },
  { slug: 'jigardan-gadhavi', name: 'Jigardan Gadhavi', color: '#1d4ed8', tagline: 'Gujarati romance', aliases: ['જીગરદાન ગઢવી', 'Jigardan Gadhvi', 'Jigrra'], ...GARBA },

  { slug: 'diljit-dosanjh', name: 'Diljit Dosanjh', color: '#c2410c', tagline: 'Punjabi superstar', group: 'punjabi' },
  { slug: 'ap-dhillon', name: 'AP Dhillon', color: '#1d4ed8', tagline: 'Punjabi pop', group: 'punjabi' },
  { slug: 'karan-aujla', name: 'Karan Aujla', color: '#a16207', tagline: 'Punjabi hip-hop', group: 'punjabi' },
  { slug: 'sidhu-moose-wala', name: 'Sidhu Moose Wala', color: '#3f3f46', tagline: 'Punjabi legend', group: 'punjabi' },

  { slug: 'anuv-jain', name: 'Anuv Jain', color: '#0f766e', tagline: 'Indie & acoustic', group: 'indie' },
  { slug: 'prateek-kuhad', name: 'Prateek Kuhad', color: '#15803d', tagline: 'Indie singer-songwriter', group: 'indie' },

  { slug: 'kishore-kumar', name: 'Kishore Kumar', color: '#92400e', tagline: 'Golden era classics', group: 'classic' },
  { slug: 'lata-mangeshkar', name: 'Lata Mangeshkar', color: '#be185d', tagline: 'Nightingale of India', group: 'classic' },
  { slug: 'ar-rahman', name: 'A.R. Rahman', color: '#059669', tagline: 'Iconic composer & singer', aliases: ['AR Rahman'], group: 'classic' },
]

export function findSinger(slug: string) {
  return SINGERS.find((s) => s.slug === slug)
}

export function singersIn(group: SingerGroup) {
  return SINGERS.filter((s) => s.group === group)
}

/** The singer a track is credited to (singer playlists set the artist to the singer's name). */
export function singerForArtist(artist: string) {
  const a = artist.toLowerCase()
  return SINGERS.find((s) => s.name.toLowerCase() === a || s.aliases?.some((x) => x.toLowerCase() === a))
}

/** Searches like "garba" or "navratri" bring up these groups of singers */
export const GROUP_KEYWORDS: Record<string, SingerGroup> = {
  garba: 'garba',
  dandiya: 'garba',
  navratri: 'garba',
  raas: 'garba',
  gujarati: 'garba',
  punjabi: 'punjabi',
  bhangra: 'punjabi',
  indie: 'indie',
  retro: 'classic',
  classics: 'classic',
}

export function initials(name: string) {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
