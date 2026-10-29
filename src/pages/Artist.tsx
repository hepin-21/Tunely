import { useParams } from 'react-router-dom'
import { audius } from '../api/audius'
import { Artwork } from '../components/Artwork'
import { CardSkeletons, ErrorState, RowSkeletons, Shelf, TrackCard } from '../components/Cards'
import { Hero } from '../components/Hero'
import { VerifiedIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { formatCount } from '../lib/format'
import { useAsync } from '../lib/useAsync'

function topGenre(genres: string[]) {
  const counts = new Map<string, number>()
  genres.filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

function SimilarInGenre({ genre, artistId }: { genre: string; artistId: string }) {
  const { data, loading } = useAsync(
    () => audius.trending({ genre, time: 'month', limit: 30 }).then((ts) => ts.filter((t) => t.artistId !== artistId).slice(0, 16)),
    [genre, artistId],
  )
  if (!loading && !data?.length) return null
  return (
    <Shelf title="Fans also like" subtitle={`Popular in ${genre}`}>
      {loading ? <CardSkeletons /> : data!.map((t) => <TrackCard key={t.id} track={t} context={data!} />)}
    </Shelf>
  )
}

export function ArtistPage() {
  const id = useParams().id ?? ''
  const artist = useAsync(() => audius.artist(id), [id])
  const tracks = useAsync(() => audius.artistTracks(id, 50), [id])

  if (artist.error) return <div className="page"><ErrorState message="Artist not found." onRetry={artist.reload} /></div>
  const a = artist.data
  const genre = tracks.data && topGenre(tracks.data.map((t) => t.genre))

  return (
    <div className="page page--hero">
      {a ? (
        <Hero
          art={<Artwork src={a.picture} alt={a.name} seed={a.id} round />}
          kind={a.verified ? 'Verified artist' : 'Artist'}
          title={a.name}
          description={a.bio}
          meta={
            <>
              {a.verified && <VerifiedIcon size={16} className="verified" />} {formatCount(a.followers)} followers · {a.trackCount} tracks
            </>
          }
          tracks={tracks.data ?? []}
        />
      ) : (
        <div className="hero hero--loading">
          <div className="hero__art skeleton skeleton--round" />
          <div className="hero__text">
            <div className="skeleton skeleton--line" style={{ width: '40%', height: 32 }} />
          </div>
        </div>
      )}
      <section className="section">
        <h2>Popular</h2>
        {tracks.loading ? (
          <RowSkeletons />
        ) : tracks.error ? (
          <ErrorState onRetry={tracks.reload} />
        ) : tracks.data!.length ? (
          <TrackList tracks={tracks.data!} showPlays />
        ) : (
          <p className="muted">This artist has no free tracks available.</p>
        )}
      </section>
      {genre && <SimilarInGenre genre={genre} artistId={id} />}
    </div>
  )
}
