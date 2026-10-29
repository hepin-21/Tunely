import { Link } from 'react-router-dom'
import type { Track } from '../api/audius'
import { youtubeChannelUrl } from '../api/youtube'

/** Artist page for Audius tracks; the YouTube channel (new tab) for YouTube tracks. */
export function ArtistLink({ track, className }: { track: Track; className?: string }) {
  if (track.source === 'youtube') {
    return (
      <a className={className} href={youtubeChannelUrl(track)} target="_blank" rel="noreferrer">
        {track.artist}
      </a>
    )
  }
  return (
    <Link className={className} to={`/artist/${track.artistId}`}>
      {track.artist}
    </Link>
  )
}

export function YouTubeBadge({ track }: { track: Track }) {
  return track.source === 'youtube' ? <span className="yt-badge" title="Plays from YouTube">YouTube</span> : null
}
