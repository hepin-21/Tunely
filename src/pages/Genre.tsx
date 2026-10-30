import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { audius, GENRES, type TrendingTime } from '../api/audius'
import { ErrorState, RowSkeletons } from '../components/Cards'
import { Hero } from '../components/Hero'
import { MusicIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { belongsInGenre } from '../lib/features'
import { songs, totalDuration } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const TIMES: { key: TrendingTime; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'allTime', label: 'All time' },
]

/** Top tracks for a genre (with time filters) or a mood. */
export function GenrePage({ mood }: { mood?: boolean }) {
  const name = decodeURIComponent(useParams().name ?? '')
  const [time, setTime] = useState<TrendingTime>('week')
  const color = GENRES.find((g) => g.name === name)?.color ?? '#7c3aed'

  const { data, loading, error, reload } = useAsync(
    () => (mood ? audius.byMood(name, 50) : audius.trending({ genre: name, time, limit: 50 }).then((ts) => ts.filter(belongsInGenre(name)))),
    [name, time, mood],
  )

  return (
    <div className="page page--hero">
      <Hero
        tint={color}
        art={
          <div className="genre-art" style={{ background: color }}>
            <MusicIcon size={64} />
          </div>
        }
        kind={mood ? 'Mood' : 'Genre'}
        title={name}
        meta={data ? `${songs(data.length)} · ${totalDuration(data)}` : undefined}
        tracks={data ?? []}
      />
      {!mood && (
        <div className="tabs">
          {TIMES.map((t) => (
            <button key={t.key} className={`chip ${time === t.key ? 'is-on' : ''}`} onClick={() => setTime(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <RowSkeletons />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : data!.length ? (
        <TrackList tracks={data!} showPlays />
      ) : (
        <p className="muted">Nothing here yet. Try another time range.</p>
      )}
    </div>
  )
}
