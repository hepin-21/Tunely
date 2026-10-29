import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { youtubeChannelUrl } from '../api/youtube'
import { usePlayer } from '../store/player'
import { useUI } from '../store/ui'
import { Artwork } from './Artwork'
import { ChevronDownIcon, CloseIcon, InfinityIcon, MoreIcon, QueueIcon } from './Icons'
import { LikeButton, SeekBar, TransportControls } from './PlayerBar'
import { Equalizer } from './TrackRow'

export function NowPlaying() {
  const { nowPlayingOpen, setNowPlayingOpen, openMenu, setVideoSlot } = useUI()
  const { current, queue, index, jumpTo, removeFromQueue, autoplay, toggleAutoplay, isPlaying } = usePlayer()
  const [tab, setTab] = useState<'art' | 'queue'>('art')
  const navigate = useNavigate()

  useEffect(() => {
    if (!nowPlayingOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNowPlayingOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [nowPlayingOpen, setNowPlayingOpen])

  if (!nowPlayingOpen || !current) return null

  const upcoming = queue.slice(index + 1)
  const isVideo = current.source === 'youtube'
  const goArtist = () => {
    if (isVideo) return void window.open(youtubeChannelUrl(current), '_blank', 'noreferrer')
    setNowPlayingOpen(false)
    navigate(`/artist/${current.artistId}`)
  }

  return (
    <div className="np" role="dialog" aria-modal="true" aria-label="Now playing">
      <div className="np__bg" style={{ backgroundImage: current.artwork ? `url(${current.artwork})` : undefined }} />
      <header className="np__head">
        <button className="icon-btn" onClick={() => setNowPlayingOpen(false)} aria-label="Close">
          <ChevronDownIcon size={28} />
        </button>
        <div className="np__tabs">
          <button className={tab === 'art' ? 'is-on' : ''} onClick={() => setTab('art')}>Playing</button>
          <button className={tab === 'queue' ? 'is-on' : ''} onClick={() => setTab('queue')}>Up next</button>
        </div>
        <button className="icon-btn" onClick={(e) => openMenu(current, e.currentTarget)} aria-label="More options">
          <MoreIcon size={22} />
        </button>
      </header>

      <div className={`np__body np__body--${tab}`}>
        <div className="np__main">
          {isVideo ? (
            // The YouTube player (see YouTubeDock) is positioned over this box
            <div className="np__video" ref={setVideoSlot} />
          ) : (
            <Artwork src={current.artworkLarge} alt={current.title} seed={current.id} className={`np__art ${isPlaying ? 'is-playing' : ''}`} />
          )}
          <div className="np__info">
            <div className="np__text">
              <h1 className="np__title">{current.title}</h1>
              <button className="np__artist" onClick={goArtist}>{current.artist}</button>
            </div>
            <LikeButton size={26} />
          </div>
          <SeekBar />
          <TransportControls large />
          <div className="np__extras">
            <button className={`chip ${autoplay ? 'is-on' : ''}`} onClick={toggleAutoplay} title="Keep playing similar songs when the queue ends">
              <InfinityIcon size={16} /> Autoplay {autoplay ? 'on' : 'off'}
            </button>
            <button className="chip np__queue-toggle" onClick={() => setTab('queue')}>
              <QueueIcon size={16} /> Up next
            </button>
          </div>
        </div>

        <aside className="np__queue">
          <h3>Now playing</h3>
          <div className="q-item is-active">
            <Artwork src={current.artwork} alt="" seed={current.id} className="q-item__art" />
            <div className="q-item__text">
              <div className="q-item__title">{current.title}</div>
              <div className="q-item__artist">{current.artist}</div>
            </div>
            {isPlaying && <Equalizer />}
          </div>
          <h3>Up next {upcoming.length > 0 && <span className="muted">· {upcoming.length}</span>}</h3>
          {upcoming.length === 0 && (
            <p className="muted small">{autoplay ? 'Similar songs will be added automatically.' : 'Queue is empty.'}</p>
          )}
          {upcoming.map((t, k) => (
            <div className="q-item" key={`${t.id}-${k}`}>
              <button className="q-item__main" onClick={() => jumpTo(index + 1 + k)}>
                <Artwork src={t.artwork} alt="" seed={t.id} className="q-item__art" />
                <div className="q-item__text">
                  <div className="q-item__title">{t.title}</div>
                  <div className="q-item__artist">{t.artist}</div>
                </div>
              </button>
              <button className="icon-btn" onClick={() => removeFromQueue(index + 1 + k)} aria-label="Remove from queue">
                <CloseIcon size={16} />
              </button>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
