import { useParams } from 'react-router-dom'
import { audius } from '../api/audius'
import { Artwork } from '../components/Artwork'
import { ErrorState, RowSkeletons } from '../components/Cards'
import { Hero } from '../components/Hero'
import { TrackList } from '../components/TrackRow'
import { songs, totalDuration } from '../lib/format'
import { useAsync } from '../lib/useAsync'

export function PlaylistPage() {
  const id = useParams().id ?? ''
  const info = useAsync(() => audius.playlist(id), [id])
  const tracks = useAsync(() => audius.playlistTracks(id), [id])
  const p = info.data

  if (info.error) return <div className="page"><ErrorState message="Playlist not found." onRetry={info.reload} /></div>

  return (
    <div className="page page--hero">
      <Hero
        art={<Artwork src={p?.artwork} alt={p?.name ?? ''} seed={id} />}
        kind="Playlist"
        title={p?.name ?? 'Loading…'}
        description={p?.description}
        meta={
          tracks.data && (
            <>
              {p?.owner && <strong>{p.owner}</strong>} · {songs(tracks.data.length)} · {totalDuration(tracks.data)}
            </>
          )
        }
        tracks={tracks.data ?? []}
      />
      {tracks.loading ? (
        <RowSkeletons />
      ) : tracks.error ? (
        <ErrorState onRetry={tracks.reload} />
      ) : tracks.data!.length ? (
        <TrackList tracks={tracks.data!} />
      ) : (
        <p className="muted">This playlist has no free tracks available.</p>
      )}
    </div>
  )
}
