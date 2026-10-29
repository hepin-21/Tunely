import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { songs } from '../lib/format'
import { youtubeWatchUrl } from '../api/youtube'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUI } from '../store/ui'
import { Artwork } from './Artwork'
import { CloseIcon, PlusIcon } from './Icons'

/** Context menu for a track: queue, like, playlist, artist, share. */
export function TrackMenu() {
  const { menu, closeMenu, showToast, openPlaylistPicker, setNowPlayingOpen } = useUI()
  const { playNext, addToQueue } = usePlayer()
  const { isLiked, toggleLike, removeFromPlaylist } = useLibrary()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const left = Math.max(8, Math.min(menu.x - w, window.innerWidth - w - 8))
    const top = menu.y + h + 8 > window.innerHeight ? Math.max(8, menu.y - h - 40) : menu.y + 4
    setPos({ left, top })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => closeMenu()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu()
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, closeMenu])

  if (!menu) return null
  const { track, playlistId } = menu
  const liked = isLiked(track.id)

  const act = (fn: () => void) => () => {
    fn()
    closeMenu()
  }

  const share = async () => {
    const text = `Listen to ${track.title} by ${track.artist} free on Tunely`
    const url = track.source === 'youtube' ? youtubeWatchUrl(track) : `${location.origin}${import.meta.env.BASE_URL}artist/${track.artistId}`
    try {
      if (navigator.share) await navigator.share({ title: track.title, text, url })
      else {
        await navigator.clipboard.writeText(`${text}: ${url}`)
        showToast('Link copied')
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <>
      <div className="backdrop backdrop--clear" onClick={closeMenu} />
      <div className="menu" ref={ref} style={pos} role="menu">
        <div className="menu__head">
          <Artwork src={track.artwork} alt="" seed={track.id} className="menu__art" />
          <div>
            <div className="menu__title">{track.title}</div>
            <div className="muted small">{track.artist}</div>
          </div>
        </div>
        <button role="menuitem" onClick={act(() => (playNext(track), showToast('Playing next')))}>Play next</button>
        <button role="menuitem" onClick={act(() => (addToQueue(track), showToast('Added to queue')))}>Add to queue</button>
        <button role="menuitem" onClick={act(() => (toggleLike(track), showToast(liked ? 'Removed from Liked Songs' : 'Added to Liked Songs')))}>
          {liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
        </button>
        <button role="menuitem" onClick={act(() => openPlaylistPicker(track))}>Add to playlist…</button>
        {playlistId && (
          <button role="menuitem" onClick={act(() => (removeFromPlaylist(playlistId, track.id), showToast('Removed from playlist')))}>
            Remove from this playlist
          </button>
        )}
        {track.source === 'youtube' ? (
          <button role="menuitem" onClick={act(() => window.open(youtubeWatchUrl(track), '_blank', 'noreferrer'))}>
            Open on YouTube
          </button>
        ) : (
          <button role="menuitem" onClick={act(() => (setNowPlayingOpen(false), navigate(`/artist/${track.artistId}`)))}>
            Go to artist
          </button>
        )}
        {track.genre && (
          <button role="menuitem" onClick={act(() => (setNowPlayingOpen(false), navigate(`/genre/${encodeURIComponent(track.genre)}`)))}>
            More {track.genre}
          </button>
        )}
        <button role="menuitem" onClick={act(share)}>Share</button>
      </div>
    </>
  )
}

/** Dialog for adding a track to one of your playlists (or a new one). */
export function PlaylistPicker() {
  const { playlistPicker: track, closePlaylistPicker, showToast } = useUI()
  const { playlists, addToPlaylist, createPlaylist } = useLibrary()
  const [name, setName] = useState('')

  useEffect(() => setName(''), [track])
  if (!track) return null

  const create = () => {
    const p = createPlaylist(name || `My playlist #${playlists.length + 1}`, track)
    showToast(`Added to ${p.name}`)
    closePlaylistPicker()
  }

  return (
    <>
      <div className="backdrop" onClick={closePlaylistPicker} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Add to playlist">
        <header className="dialog__head">
          <h3>Add to playlist</h3>
          <button className="icon-btn" onClick={closePlaylistPicker} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </header>
        <form
          className="dialog__new"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <input className="input" placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn" type="submit">
            <PlusIcon size={16} /> Create
          </button>
        </form>
        <div className="dialog__list">
          {playlists.length === 0 && <p className="muted small">You have no playlists yet. Create one above.</p>}
          {playlists.map((p) => {
            const has = p.tracks.some((t) => t.id === track.id)
            return (
              <button
                key={p.id}
                className="dialog__item"
                disabled={has}
                onClick={() => {
                  addToPlaylist(p.id, track)
                  showToast(`Added to ${p.name}`)
                  closePlaylistPicker()
                }}
              >
                <Artwork src={p.tracks[0]?.artwork} alt="" seed={p.id} className="dialog__art" />
                <span>
                  <span className="dialog__name">{p.name}</span>
                  <span className="muted small">{has ? 'Already added' : songs(p.tracks.length)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function Toast() {
  const { toast } = useUI()
  return (
    <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">
      {toast}
    </div>
  )
}
