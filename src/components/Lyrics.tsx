import { useEffect, useRef } from 'react'
import { activeLine, type Lyrics } from '../api/lyrics'
import { usePlayer, useProgress } from '../store/player'

export interface LyricsState {
  data: Lyrics | null | undefined
  loading: boolean
  error: Error | null
  reload: () => void
}

/** Full lyrics: synced lines follow the song (tap one to jump there); otherwise the plain words. */
export function LyricsView({ state }: { state: LyricsState }) {
  const { time } = useProgress()
  const { seek, isPlaying, toggle } = usePlayer()
  const box = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([])
  // After you scroll yourself, stop following the song for a few seconds
  const userScrolled = useRef(0)
  const lyrics = state.data
  const lines = lyrics?.lines ?? null
  const current = lines ? activeLine(lines, time) : -1

  useEffect(() => {
    const el = lineRefs.current[current]
    const container = box.current
    if (!el || !container || Date.now() - userScrolled.current < 4000) return
    container.scrollTo({ top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [current])

  if (state.loading) {
    return (
      <div className="lyrics lyrics--loading" aria-label="Loading lyrics">
        {[70, 55, 80, 40, 65].map((w, i) => (
          <span key={i} className="skeleton lyrics__skeleton" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }
  if (state.error) {
    return (
      <div className="lyrics lyrics--empty">
        <p>Couldn't load lyrics right now.</p>
        <button className="link-more" onClick={state.reload}>Try again</button>
      </div>
    )
  }
  if (!lyrics) {
    return (
      <div className="lyrics lyrics--empty">
        <p>No lyrics found for this song.</p>
        <p className="muted small">Lyrics come from LRCLIB, a free community database. Covers and remixes are often missing.</p>
      </div>
    )
  }
  if (lyrics.instrumental) {
    return (
      <div className="lyrics lyrics--empty">
        <p className="lyrics__note">♪ Instrumental</p>
        <p className="muted small">No words, just music. Enjoy it.</p>
      </div>
    )
  }

  const credit = (
    <p className="lyrics__credit muted small">
      {lyrics.title} · {lyrics.artist} · Lyrics from LRCLIB
    </p>
  )

  if (!lines) {
    return (
      <div className="lyrics" ref={box}>
        {lyrics.otherVersion && <p className="notice small">Timing isn't available for this version, so the words aren't synced.</p>}
        <div className="lyrics__plain">
          {(lyrics.plain ?? '').split('\n').map((line, i) => (
            <p key={i} className={line.trim() ? '' : 'lyrics__gap'}>{line || ' '}</p>
          ))}
        </div>
        {credit}
      </div>
    )
  }

  const markScroll = () => (userScrolled.current = Date.now())
  return (
    <div className="lyrics lyrics--synced" ref={box} onWheel={markScroll} onTouchMove={markScroll}>
      {lines.map((line, i) => (
        <button
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el
          }}
          className={`lyrics__line ${i === current ? 'is-active' : i < current ? 'is-past' : ''}`}
          onClick={() => {
            userScrolled.current = 0
            seek(line.time)
            if (!isPlaying) toggle()
          }}
        >
          {line.text || '♪'}
        </button>
      ))}
      {credit}
    </div>
  )
}

/** The line being sung right now, shown under the waves on the "Playing" view. */
export function NowLine({ lyrics, onOpen }: { lyrics: Lyrics | null | undefined; onOpen: () => void }) {
  const { time } = useProgress()
  const lines = lyrics?.lines
  if (!lines?.length) return null
  const i = activeLine(lines, time)
  const text = i >= 0 ? lines[i].text : ''
  const next = lines[i + 1]?.text
  return (
    <button className="np__line" onClick={onOpen} aria-label="Show lyrics">
      <span key={i} className="np__line-now">{text || '♪'}</span>
      {next && <span className="np__line-next">{next}</span>}
    </button>
  )
}
