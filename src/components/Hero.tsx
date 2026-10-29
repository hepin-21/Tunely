import type { ReactNode } from 'react'
import type { Track } from '../api/audius'
import { usePlayer } from '../store/player'
import { PauseIcon, PlayIcon, ShuffleIcon } from './Icons'

interface Props {
  art: ReactNode
  kind: string
  title: string
  meta?: ReactNode
  description?: string
  tracks: Track[]
  actions?: ReactNode
  tint?: string
}

/** Big page header used by artist, playlist, genre and library pages. */
export function Hero({ art, kind, title, meta, description, tracks, actions, tint }: Props) {
  const { playQueue, current, isPlaying, toggle, shuffle, toggleShuffle } = usePlayer()
  const playingThis = !!current && tracks.some((t) => t.id === current.id)

  return (
    <>
      <header className="hero" style={tint ? { ['--tint' as string]: tint } : undefined}>
        <div className="hero__art">{art}</div>
        <div className="hero__text">
          <span className="hero__kind">{kind}</span>
          <h1 className="hero__title">{title}</h1>
          {description && <p className="hero__desc">{description}</p>}
          {meta && <div className="hero__meta">{meta}</div>}
        </div>
      </header>
      <div className="hero__actions">
        <button
          className="play-btn play-btn--big"
          disabled={!tracks.length}
          onClick={() => (playingThis ? toggle() : playQueue(tracks, 0))}
          aria-label={playingThis && isPlaying ? 'Pause' : 'Play all'}
        >
          {playingThis && isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>
        <button className={`icon-btn ${shuffle ? 'is-on' : ''}`} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}>
          <ShuffleIcon size={24} />
        </button>
        {actions}
      </div>
    </>
  )
}
