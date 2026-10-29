import { useParams } from 'react-router-dom'
import { findSinger, initials, SINGERS, singersIn } from '../api/singers'
import { singerSongs, useYouTubeKey, YouTubeError } from '../api/youtube'
import { Artwork } from '../components/Artwork'
import { ErrorState, RowSkeletons, Shelf } from '../components/Cards'
import { Hero } from '../components/Hero'
import { SingerCard } from '../components/SingerCard'
import { TrackList } from '../components/TrackRow'
import { YouTubeKeyForm } from '../components/YouTubeSettings'
import { songs, totalDuration } from '../lib/format'
import { searchSongs } from '../lib/search'
import { useAsync } from '../lib/useAsync'
import { NotFound } from './NotFound'

/** A singer's playlist: official songs from YouTube, plus covers and remixes from Audius. */
export function SingerPage() {
  const slug = useParams().slug ?? ''
  const singer = findSinger(slug)
  const key = useYouTubeKey()

  const official = useAsync(
    () => (singer && key ? singerSongs(singer) : Promise.resolve(null)),
    [slug, key],
  )
  const covers = useAsync(
    () => (singer ? searchSongs(singer.name).then((r) => r.tracks.slice(0, 15)) : Promise.resolve([])),
    [slug],
  )

  if (!singer) return <NotFound />

  const tracks = official.data ?? []
  const playable = tracks.length ? tracks : (covers.data ?? [])
  const cover = tracks[0]?.artworkLarge ?? tracks[0]?.artwork
  const ytError = official.error instanceof YouTubeError ? official.error : null

  return (
    <div className="page page--hero">
      <Hero
        tint={singer.color}
        art={
          cover ? (
            <Artwork src={cover} alt={singer.name} seed={singer.slug} round />
          ) : (
            <div className="artwork artwork--round singer-initials singer-initials--hero" style={{ background: singer.color }}>
              {initials(singer.name)}
            </div>
          )
        }
        kind="Singer playlist"
        title={singer.name}
        description={singer.tagline}
        meta={
          tracks.length
            ? `${songs(tracks.length)} · ${totalDuration(tracks)} · official releases from YouTube`
            : covers.data?.length
              ? `${songs(covers.data.length)} · covers & remixes`
              : undefined
        }
        tracks={playable}
      />

      {key ? (
        <section className="section">
          <h2 className="yt-heading">Songs</h2>
          {official.loading ? (
            <RowSkeletons n={10} />
          ) : ytError?.kind === 'quota' ? (
            <p className="notice">YouTube's free daily limit is used up, so official songs can't load until tomorrow.</p>
          ) : official.error ? (
            <ErrorState message={`Couldn't load songs from YouTube. ${official.error.message}`} onRetry={official.reload} />
          ) : tracks.length ? (
            <TrackList tracks={tracks} showPlays />
          ) : (
            <p className="muted">No playable songs found on YouTube for {singer.name}.</p>
          )}
        </section>
      ) : (
        <section className="yt-setup">
          <div>
            <h3>{singer.name}'s official songs are on YouTube</h3>
            <p className="muted small">
              Add a free YouTube API key to load the full playlist here. Until then you can listen to covers and remixes
              from Audius below.
            </p>
          </div>
          <YouTubeKeyForm />
        </section>
      )}

      <section className="section">
        <h2>{key ? 'Covers & remixes on Audius' : `${singer.name} songs on Audius`}</h2>
        {covers.loading ? (
          <RowSkeletons n={5} />
        ) : covers.data?.length ? (
          <TrackList tracks={covers.data} showPlays />
        ) : (
          <p className="muted">Nothing on Audius for {singer.name} yet.</p>
        )}
      </section>

      <Shelf title="More singers">
        {[...singersIn(singer.group), ...SINGERS.filter((s) => s.group !== singer.group)]
          .filter((s) => s.slug !== slug)
          .map((s) => (
          <SingerCard key={s.slug} singer={s} />
        ))}
      </Shelf>
    </div>
  )
}
