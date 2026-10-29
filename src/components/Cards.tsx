import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Artist, Playlist, Track } from '../api/audius'
import { formatCount } from '../lib/format'
import { usePlayer } from '../store/player'
import { ArtistLink } from './ArtistLink'
import { Artwork } from './Artwork'
import { PauseIcon, PlayIcon } from './Icons'

export function TrackCard({ track, context }: { track: Track; context: Track[] }) {
  const { current, isPlaying, playTrack, toggle } = usePlayer()
  const active = current?.id === track.id
  return (
    <div className={`card ${active ? 'is-active' : ''}`}>
      <button className="card__cover" onClick={() => (active ? toggle() : playTrack(track, context))} aria-label={`Play ${track.title}`}>
        <Artwork src={track.artwork} alt="" seed={track.id} />
        <span className="card__play">{active && isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}</span>
      </button>
      <div className="card__title" title={track.title}>{track.title}</div>
      <ArtistLink className="card__sub" track={track} />
    </div>
  )
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link className="card card--artist" to={`/artist/${artist.id}`}>
      <div className="card__cover">
        <Artwork src={artist.picture} alt="" seed={artist.id} round />
      </div>
      <div className="card__title">{artist.name}</div>
      <div className="card__sub">{formatCount(artist.followers)} followers</div>
    </Link>
  )
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link className="card" to={`/playlist/${playlist.id}`}>
      <div className="card__cover">
        <Artwork src={playlist.artwork} alt="" seed={playlist.id} />
      </div>
      <div className="card__title" title={playlist.name}>{playlist.name}</div>
      <div className="card__sub">{playlist.owner ? `By ${playlist.owner}` : `${playlist.trackCount} tracks`}</div>
    </Link>
  )
}

export function Shelf({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="shelf">
      <header className="shelf__head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="shelf__row">{children}</div>
    </section>
  )
}

export function CardSkeletons({ n = 6, round }: { n?: number; round?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div className="card" key={i} aria-hidden>
          <div className={`card__cover skeleton ${round ? 'skeleton--round' : ''}`} />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line short" />
        </div>
      ))}
    </>
  )
}

export function RowSkeletons({ n = 8 }: { n?: number }) {
  return (
    <div className="track-list" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div className="track-row track-row--skeleton" key={i}>
          <div className="skeleton track-row__art" />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line short" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <p>{message ?? "Couldn't load music right now. Check your connection."}</p>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
