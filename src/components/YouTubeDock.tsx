import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useYouTubeKey, youtubeWatchUrl } from '../api/youtube'
import { youtubeMedia } from '../lib/youtubePlayer'
import { usePlayer } from '../store/player'
import { useUI } from '../store/ui'
import { ChevronDownIcon } from './Icons'

// Editor preview panes (VS Code's Simple Browser and other Electron webviews) can't
// reliably play embedded YouTube, while real browsers can
const IN_EDITOR_PREVIEW = /\bElectron\//.test(navigator.userAgent)
const EDITOR_PREVIEW_HINT = `You're in an editor's preview browser, which often can't play YouTube. Open ${location.origin} in Chrome or Edge.`

/**
 * Home of the YouTube iframe. It's mounted once and never moved in the DOM
 * (moving an iframe reloads it); instead it's positioned over Now Playing's
 * artwork area when that's open, or floats above the player bar otherwise.
 * YouTube's terms require the player to stay visible while it plays.
 */
export function YouTubeDock() {
  const host = useRef<HTMLDivElement>(null)
  const { current, error, isLoading } = usePlayer()
  const { videoSlot, nowPlayingOpen, setNowPlayingOpen } = useUI()
  const key = useYouTubeKey()
  const [rect, setRect] = useState<CSSProperties | null>(null)
  const active = current?.source === 'youtube'

  useEffect(() => {
    if (host.current) youtubeMedia.attach(host.current)
  }, [])

  // Get the player ready early when YouTube is in use, so the first song starts quickly
  useEffect(() => {
    if (key || active) youtubeMedia.warmUp()
  }, [key, active])

  // Follow the slot every frame while it's shown (it animates in with Now Playing)
  useLayoutEffect(() => {
    if (!videoSlot || !nowPlayingOpen) {
      setRect(null)
      return
    }
    let frame = 0
    let last = ''
    const follow = () => {
      const r = videoSlot.getBoundingClientRect()
      const next = `${r.left},${r.top},${r.width},${r.height}`
      if (next !== last) {
        last = next
        setRect(r.width && r.height ? { left: r.left, top: r.top, width: r.width, height: r.height } : null)
      }
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [videoSlot, nowPlayingOpen])

  const slotted = active && !!rect
  const problem = active ? (error ?? (IN_EDITOR_PREVIEW ? EDITOR_PREVIEW_HINT : null)) : null
  return (
    <div
      className={`yt-dock ${active ? 'is-active' : ''} ${slotted ? 'is-slotted' : ''} ${problem ? 'has-problem' : ''}`}
      style={slotted ? rect! : undefined}
      aria-hidden={!active}
    >
      {active && !slotted && (
        <div className="yt-dock__bar">
          <span className="yt-dock__label">{isLoading ? 'Loading from YouTube…' : '▶ YouTube'}</span>
          <a className="yt-dock__open" href={youtubeWatchUrl(current!)} target="_blank" rel="noreferrer">
            Open on YouTube ↗
          </a>
          <button className="icon-btn" onClick={() => setNowPlayingOpen(true)} aria-label="Open now playing">
            <ChevronDownIcon size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      )}
      {problem && !slotted && <div className="yt-dock__problem" role="alert">{problem}</div>}
      <div className="yt-dock__video" ref={host} />
    </div>
  )
}
