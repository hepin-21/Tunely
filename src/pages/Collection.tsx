import { Link, useParams } from 'react-router-dom'
import { findRegional, REGIONAL } from '../api/regional'
import { ErrorState, RowSkeletons } from '../components/Cards'
import { Hero } from '../components/Hero'
import { MusicIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { fetchCollection } from '../lib/collections'
import { songs, totalDuration } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { NotFound } from './NotFound'

/** Hindi, Punjabi, Tamil, … collection page. */
export function CollectionPage() {
  const slug = useParams().slug ?? ''
  const c = findRegional(slug)
  const { data, loading, error, reload } = useAsync(() => fetchCollection(slug).then((ts) => ts.slice(0, 80)), [slug])

  if (!c) return <NotFound />

  return (
    <div className="page page--hero">
      <Hero
        tint={c.color}
        art={
          <div className="genre-art" style={{ background: c.color }}>
            <MusicIcon size={64} />
          </div>
        }
        kind="Indian music"
        title={c.name}
        description={c.description}
        meta={data?.length ? `${songs(data.length)} · ${totalDuration(data)}` : undefined}
        tracks={data ?? []}
      />
      {loading ? (
        <RowSkeletons />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : data!.length ? (
        <TrackList tracks={data!} showPlays />
      ) : (
        <ErrorState message="Couldn't find songs for this collection right now." onRetry={reload} />
      )}
      <section className="section">
        <h2>More Indian music</h2>
        <div className="chips">
          {REGIONAL.filter((r) => r.slug !== slug).map((r) => (
            <Link key={r.slug} className="chip chip--color" style={{ ['--c' as string]: r.color }} to={`/india/${r.slug}`}>
              {r.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
