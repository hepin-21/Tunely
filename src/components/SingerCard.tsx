import { Link } from 'react-router-dom'
import { initials, type Singer } from '../api/singers'
import { cachedSingerSongs } from '../api/youtube'
import { Artwork } from './Artwork'

/** Round singer tile; shows a song cover once their playlist has been loaded, initials before that. */
export function SingerCard({ singer }: { singer: Singer }) {
  const cover = cachedSingerSongs(singer.slug)[0]?.artwork
  return (
    <Link className="card card--artist" to={`/singer/${singer.slug}`}>
      <div className="card__cover">
        {cover ? (
          <Artwork src={cover} alt="" seed={singer.slug} round />
        ) : (
          <div className="artwork artwork--round singer-initials" style={{ background: singer.color }}>
            {initials(singer.name)}
          </div>
        )}
      </div>
      <div className="card__title">{singer.name}</div>
      <div className="card__sub">{singer.tagline}</div>
    </Link>
  )
}
