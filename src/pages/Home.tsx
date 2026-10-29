import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { audius, GENRES, MOODS } from '../api/audius'
import { findRegional, REGIONAL } from '../api/regional'
import { SINGER_GROUPS, singersIn } from '../api/singers'
import { SingerCard } from '../components/SingerCard'
import { fetchCollection } from '../lib/collections'
import { Artwork } from '../components/Artwork'
import { CardSkeletons, ErrorState, PlaylistCard, RowSkeletons, Shelf, TrackCard } from '../components/Cards'
import { PlayIcon, SparkleIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { greeting } from '../lib/format'
import { buildTasteProfile, suggestForYou } from '../lib/recommend'
import { useAsync } from '../lib/useAsync'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'

function QuickPicks() {
  const { recent, liked } = useLibrary()
  const { playTrack, current, isPlaying } = usePlayer()
  const picks = useMemo(() => {
    const seen = new Set<string>()
    return [...recent, ...liked].filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, 6)
  }, [recent, liked])
  if (!picks.length) return null
  return (
    <div className="quick-grid">
      {picks.map((t) => (
        <button key={t.id} className={`quick ${current?.id === t.id ? 'is-active' : ''}`} onClick={() => playTrack(t, picks)}>
          <Artwork src={t.artwork} alt="" seed={t.id} className="quick__art" />
          <span className="quick__title">{t.title}</span>
          <span className="quick__play">{current?.id === t.id && isPlaying ? <span className="eq"><i /><i /><i /></span> : <PlayIcon size={16} />}</span>
        </button>
      ))}
    </div>
  )
}

function MadeForYou() {
  const { liked, recent } = useLibrary()
  // Only recompute when the library meaningfully changes (first ~10 items)
  const key = [...liked.slice(0, 10), ...recent.slice(0, 10)].map((t) => t.id).join(',')
  const profile = useMemo(() => buildTasteProfile(liked, recent), [key])
  const exclude = useMemo(() => new Set(recent.slice(0, 20).map((t) => t.id)), [key])
  const { data, loading } = useAsync(() => suggestForYou(profile, exclude), [profile])

  if (!profile.hasHistory) return null
  const topTaste = findRegional(profile.collections[0]?.[0] ?? '')?.name ?? profile.genres[0]?.[0]
  return (
    <Shelf
      title="Made for you"
      subtitle={topTaste ? `Based on your love for ${topTaste} and more` : 'Based on what you play'}
      action={<span className="badge"><SparkleIcon size={14} /> Personal</span>}
    >
      {loading && !data ? <CardSkeletons /> : data?.map((t) => <TrackCard key={t.id} track={t} context={data} />)}
    </Shelf>
  )
}

function GenreShelf({ genre, title }: { genre: string; title: string }) {
  const { data, loading } = useAsync(() => audius.trending({ genre, limit: 16 }), [genre])
  if (!loading && !data?.length) return null
  return (
    <Shelf title={title} action={<Link className="link-more" to={`/genre/${encodeURIComponent(genre)}`}>Show all</Link>}>
      {loading ? <CardSkeletons /> : data!.map((t) => <TrackCard key={t.id} track={t} context={data!} />)}
    </Shelf>
  )
}

function CollectionShelf({ slug, title, subtitle }: { slug: string; title: string; subtitle?: string }) {
  const { data, loading } = useAsync(() => fetchCollection(slug).then((ts) => ts.slice(0, 20)), [slug])
  if (!loading && !data?.length) return null
  return (
    <Shelf title={title} subtitle={subtitle} action={<Link className="link-more" to={`/india/${slug}`}>Show all</Link>}>
      {loading ? <CardSkeletons /> : data!.map((t) => <TrackCard key={t.id} track={t} context={data!} />)}
    </Shelf>
  )
}

function IndianTiles() {
  return (
    <Shelf title="Indian music" subtitle="Hindi, Punjabi, Tamil, Telugu, devotional and more">
      {REGIONAL.map((c) => (
        <Link key={c.slug} to={`/india/${c.slug}`} className="genre-tile" style={{ background: c.color }}>
          {c.name}
        </Link>
      ))}
    </Shelf>
  )
}

export function HomePage() {
  const { liked, recent } = useLibrary()
  const trending = useAsync(() => audius.trending({ limit: 20 }), [])
  const underground = useAsync(() => audius.underground(16), [])
  const playlists = useAsync(() => audius.trendingPlaylists(12), [])

  const profile = useMemo(() => buildTasteProfile(liked, recent), [liked, recent])
  const favGenres = profile.genres.slice(0, 2).map(([g]) => g)
  const fallbackGenres = ['Lo-Fi', 'Electronic']
  const genreShelves = (favGenres.length ? favGenres : fallbackGenres).slice(0, 2)
  const favRegional = findRegional(profile.collections.find(([c]) => c !== 'hindi')?.[0] ?? '')

  return (
    <div className="page">
      <header className="page-head">
        <h1>{greeting()}</h1>
        <p className="muted">Free music from independent artists. No ads, no sign-up, ever.</p>
      </header>

      <QuickPicks />

      {!profile.hasHistory && (
        <section className="onboard">
          <h2>What do you feel like listening to?</h2>
          <p className="muted">Play or like a few songs and Tunely will start suggesting music just for you.</p>
          <div className="chips">
            {REGIONAL.slice(0, 4).map((c) => (
              <Link key={c.slug} className="chip chip--color" style={{ ['--c' as string]: c.color }} to={`/india/${c.slug}`}>
                {c.name}
              </Link>
            ))}
            {GENRES.slice(0, 10).map((g) => (
              <Link key={g.name} className="chip chip--color" style={{ ['--c' as string]: g.color }} to={`/genre/${encodeURIComponent(g.name)}`}>
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <MadeForYou />

      <CollectionShelf slug="hindi" title="Hindi & Bollywood" subtitle="Popular Hindi songs, covers and remixes" />

      {SINGER_GROUPS.filter((g) => g.group === 'bollywood' || g.group === 'garba').map((g) => (
        <Shelf key={g.group} title={g.title} subtitle={g.subtitle}>
          {singersIn(g.group).map((s) => (
            <SingerCard key={s.slug} singer={s} />
          ))}
        </Shelf>
      ))}

      {favRegional && <CollectionShelf slug={favRegional.slug} title={`Because you like ${favRegional.name}`} />}

      <IndianTiles />

      <section className="section">
        <header className="shelf__head">
          <div>
            <h2>Trending this week</h2>
            <p className="muted">What everyone is playing right now</p>
          </div>
        </header>
        {trending.loading ? (
          <RowSkeletons n={6} />
        ) : trending.error ? (
          <ErrorState onRetry={trending.reload} />
        ) : (
          <TrackList tracks={trending.data!.slice(0, 10)} showPlays />
        )}
      </section>

      {genreShelves.map((g, i) => (
        <GenreShelf key={g} genre={g} title={favGenres.length ? (i === 0 ? `Because you like ${g}` : `More ${g} for you`) : `Popular in ${g}`} />
      ))}

      <Shelf title="Fresh underground" subtitle="Rising artists worth discovering">
        {underground.loading ? <CardSkeletons /> : underground.data?.map((t) => <TrackCard key={t.id} track={t} context={underground.data!} />)}
      </Shelf>

      <Shelf title="Popular playlists" subtitle="Curated by the community">
        {playlists.loading ? <CardSkeletons /> : playlists.data?.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
      </Shelf>

      <section className="section">
        <h2>Moods</h2>
        <div className="chips">
          {MOODS.map((m) => (
            <Link key={m} className="chip" to={`/mood/${encodeURIComponent(m)}`}>
              {m}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
