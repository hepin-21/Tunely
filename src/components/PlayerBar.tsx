import { useRef, useState, type PointerEvent } from 'react'
import { formatTime } from '../lib/format'
import { useLibrary } from '../store/library'
import { usePlayer, useProgress } from '../store/player'
import { useUI } from '../store/ui'
import { ArtistLink } from './ArtistLink'
import { Artwork } from './Artwork'
import {
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons'

/** Draggable slider used for both seeking and volume. */
export function Slider({
  value,
  max,
  buffered,
  onChange,
  label,
  className = '',
}: {
  value: number
  max: number
  buffered?: number
  onChange: (v: number) => void
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const shown = drag ?? value
  const pct = max > 0 ? Math.min(100, (shown / max) * 100) : 0
  const bufPct = max > 0 && buffered ? Math.min(100, (buffered / max) * 100) : 0

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * max
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(valueAt(e.clientX))
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => drag !== null && setDrag(valueAt(e.clientX))
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return
    onChange(valueAt(e.clientX))
    setDrag(null)
  }

  return (
    <div
      ref={ref}
      className={`slider ${drag !== null ? 'is-dragging' : ''} ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      onKeyDown={(e) => {
        const step = max / 20
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          onChange(Math.min(max, value + step))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          onChange(Math.max(0, value - step))
        }
      }}
    >
      <div className="slider__track">
        <div className="slider__buffer" style={{ width: `${bufPct}%` }} />
        <div className="slider__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="slider__thumb" style={{ left: `${pct}%` }} />
    </div>
  )
}

export function SeekBar({ compact }: { compact?: boolean }) {
  const { time, duration, buffered } = useProgress()
  const { seek } = usePlayer()
  return (
    <div className={`seek ${compact ? 'seek--compact' : ''}`}>
      <span className="seek__time">{formatTime(time)}</span>
      <Slider value={time} max={duration} buffered={buffered} onChange={seek} label="Seek" />
      <span className="seek__time">{formatTime(duration)}</span>
    </div>
  )
}

export function TransportControls({ large }: { large?: boolean }) {
  const { isPlaying, isLoading, toggle, next, prev, shuffle, toggleShuffle, repeat, cycleRepeat } = usePlayer()
  const s = large ? 28 : 20
  return (
    <div className={`transport ${large ? 'transport--large' : ''}`}>
      <button className={`icon-btn ${shuffle ? 'is-on' : ''}`} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}>
        <ShuffleIcon size={large ? 22 : 18} />
      </button>
      <button className="icon-btn" onClick={prev} aria-label="Previous">
        <PrevIcon size={s} />
      </button>
      <button className={`play-btn ${isLoading ? 'is-loading' : ''}`} onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <PauseIcon size={large ? 30 : 20} /> : <PlayIcon size={large ? 30 : 20} />}
      </button>
      <button className="icon-btn" onClick={next} aria-label="Next">
        <NextIcon size={s} />
      </button>
      <button className={`icon-btn ${repeat !== 'off' ? 'is-on' : ''}`} onClick={cycleRepeat} aria-label={`Repeat: ${repeat}`}>
        {repeat === 'one' ? <RepeatOneIcon size={large ? 22 : 18} /> : <RepeatIcon size={large ? 22 : 18} />}
      </button>
    </div>
  )
}

export function LikeButton({ size = 20 }: { size?: number }) {
  const { current } = usePlayer()
  const { isLiked, toggleLike } = useLibrary()
  const { showToast } = useUI()
  if (!current) return null
  const liked = isLiked(current.id)
  return (
    <button
      className={`icon-btn ${liked ? 'is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        toggleLike(current)
        showToast(liked ? 'Removed from Liked Songs' : 'Added to Liked Songs')
      }}
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      <HeartIcon size={size} filled={liked} />
    </button>
  )
}

function MiniProgress() {
  const { time, duration } = useProgress()
  return <div className="mini__progress" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
}

export function PlayerBar() {
  const { current, isPlaying, toggle, volume, muted, setVolume, toggleMute, error } = usePlayer()
  const { setNowPlayingOpen } = useUI()
  if (!current) return null

  return (
    <>
      {/* Desktop / tablet bar */}
      <footer className="player-bar">
        <div className="player-bar__now">
          <button className="player-bar__art" onClick={() => setNowPlayingOpen(true)} aria-label="Open now playing">
            <Artwork src={current.artwork} alt="" seed={current.id} />
          </button>
          <div className="player-bar__text">
            <button className="player-bar__title" onClick={() => setNowPlayingOpen(true)}>{current.title}</button>
            <ArtistLink className="player-bar__artist" track={current} />
          </div>
          <LikeButton size={18} />
        </div>
        <div className="player-bar__center">
          <TransportControls />
          <SeekBar compact />
          {error && <div className="player-bar__error">{error}</div>}
        </div>
        <div className="player-bar__side">
          <button className="icon-btn" onClick={() => setNowPlayingOpen(true)} aria-label="Queue">
            <QueueIcon size={18} />
          </button>
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            <VolumeIcon size={18} level={muted ? 0 : volume} />
          </button>
          <Slider value={muted ? 0 : volume} max={1} onChange={setVolume} label="Volume" className="volume" />
        </div>
      </footer>

      {/* Mobile mini player */}
      <div className="mini" onClick={() => setNowPlayingOpen(true)} role="button" tabIndex={0} aria-label="Open now playing">
        <Artwork src={current.artwork} alt="" seed={current.id} className="mini__art" />
        <div className="mini__text">
          <div className="mini__title">{current.title}</div>
          <div className="mini__artist">{error ?? current.artist}</div>
        </div>
        <LikeButton />
        <button
          className="icon-btn mini__play"
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <MiniProgress />
      </div>
    </>
  )
}
