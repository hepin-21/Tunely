import { Link } from 'react-router-dom'
import type { Track } from '../api/audius'
import { trustedGenre } from '../lib/features'
import { formatCount, formatTime } from '../lib/format'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUI } from '../store/ui'
import { YouTubeBadge } from './ArtistLink'
import { Artwork } from './Artwork'
import { HeartIcon, MoreIcon, PauseIcon, PlayIcon } from './Icons'

interface Props {
  track: Track
  index: number
  context: Track[]
  showPlays?: boolean
  playlistId?: string
  /** Play the song followed by recommendations instead of the rest of the list (search results) */
  radio?: boolean
}

export function Equalizer() {
  return (
    <span className="eq" aria-label="Now playing">
      <i />
      <i />
      <i />
    </span>
  )
}

export function TrackRow({ track, index, context, showPlays, playlistId, radio }: Props) {
  const { current, isPlaying, playTrack, startRadio, toggle } = usePlayer()
  const { isLiked, toggleLike } = useLibrary()
  const { openMenu, showToast } = useUI()
  const active = current?.id === track.id
  const liked = isLiked(track.id)
  const genre = trustedGenre(track)

  const onPlay = () => (active ? toggle() : radio ? startRadio(track) : playTrack(track, context))

  return (
    <div className={`track-row ${active ? 'is-active' : ''}`} onDoubleClick={onPlay}>
      <button className="track-row__index" onClick={onPlay} aria-label={active && isPlaying ? 'Pause' : `Play ${track.title}`}>
        <span className="track-row__num">{active && isPlaying ? <Equalizer /> : index + 1}</span>
        <span className="track-row__play">{active && isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
      </button>
      <button className="track-row__main" onClick={onPlay}>
        <Artwork src={track.artwork} alt="" seed={track.id} className="track-row__art" />
        <span className="track-row__text">
          <span className="track-row__title">{track.title}</span>
          <span className="track-row__artist">
            <YouTubeBadge track={track} />
            {track.artist}
          </span>
        </span>
      </button>
      {genre ? (
        <Link className="track-row__genre" to={`/genre/${encodeURIComponent(genre)}`}>
          {genre}
        </Link>
      ) : (
        <span className="track-row__genre" />
      )}
      {showPlays && <span className="track-row__plays">{formatCount(track.plays)} plays</span>}
      <button
        className={`icon-btn track-row__like ${liked ? 'is-on' : ''}`}
        onClick={() => {
          toggleLike(track)
          showToast(liked ? 'Removed from Liked Songs' : 'Added to Liked Songs')
        }}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <HeartIcon size={18} filled={liked} />
      </button>
      <span className="track-row__time">{formatTime(track.duration)}</span>
      <button className="icon-btn" onClick={(e) => openMenu(track, e.currentTarget, playlistId)} aria-label="More options">
        <MoreIcon size={18} />
      </button>
    </div>
  )
}

export function TrackList({
  tracks,
  showPlays,
  playlistId,
  radio,
}: {
  tracks: Track[]
  showPlays?: boolean
  playlistId?: string
  radio?: boolean
}) {
  return (
    <div className="track-list">
      {tracks.map((t, i) => (
        <TrackRow key={t.id} track={t} index={i} context={tracks} showPlays={showPlays} playlistId={playlistId} radio={radio} />
      ))}
    </div>
  )
}
