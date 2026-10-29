import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Artwork } from '../components/Artwork'
import { Hero } from '../components/Hero'
import { ClockIcon, HeartIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { YouTubeKeyForm } from '../components/YouTubeSettings'
import { songs, totalDuration } from '../lib/format'
import { useLibrary } from '../store/library'
import { useUI } from '../store/ui'

type Tab = 'playlists' | 'recent'

export function LibraryPage() {
  const { liked, recent, playlists, createPlaylist, clearRecent } = useLibrary()
  const { showToast } = useUI()
  const [tab, setTab] = useState<Tab>('playlists')
  const navigate = useNavigate()

  return (
    <div className="page">
      <header className="page-head page-head--row">
        <h1>Your Library</h1>
        <button
          className="btn"
          onClick={() => {
            const p = createPlaylist(`My playlist #${playlists.length + 1}`)
            showToast(`Created ${p.name}`)
            navigate(`/my/${p.id}`)
          }}
        >
          <PlusIcon size={16} /> New playlist
        </button>
      </header>
      <div className="tabs">
        <button className={`chip ${tab === 'playlists' ? 'is-on' : ''}`} onClick={() => setTab('playlists')}>Playlists</button>
        <button className={`chip ${tab === 'recent' ? 'is-on' : ''}`} onClick={() => setTab('recent')}>Recently played</button>
      </div>

      {tab === 'playlists' && (
        <div className="lib-list">
          <Link to="/liked" className="lib-item">
            <span className="liked-tile liked-tile--lg"><HeartIcon size={24} filled /></span>
            <span>
              <span className="lib-item__name">Liked Songs</span>
              <span className="muted small">Playlist · {songs(liked.length)}</span>
            </span>
          </Link>
          {playlists.map((p) => (
            <Link key={p.id} to={`/my/${p.id}`} className="lib-item">
              <Artwork src={p.tracks[0]?.artwork} alt="" seed={p.id} className="lib-item__art" />
              <span>
                <span className="lib-item__name">{p.name}</span>
                <span className="muted small">Playlist · {songs(p.tracks.length)}</span>
              </span>
            </Link>
          ))}
          {playlists.length === 0 && (
            <p className="muted small">Create playlists to organize your favorite songs. Use the ⋯ menu on any song to add it.</p>
          )}
        </div>
      )}

      {tab === 'recent' &&
        (recent.length ? (
          <>
            <div className="row-end">
              <button className="link-more" onClick={clearRecent}>Clear history</button>
            </div>
            <TrackList tracks={recent} />
          </>
        ) : (
          <div className="empty">
            <ClockIcon size={40} />
            <p>Songs you play will show up here.</p>
            <Link className="btn" to="/">Find something to play</Link>
          </div>
        ))}

      <section className="section settings">
        <h2>Settings</h2>
        <div className="settings__item">
          <h3>YouTube results in search</h3>
          <p className="muted small">
            Adds songs from YouTube (film songs, label releases) next to the free Audius catalog. YouTube songs play in
            YouTube's player, which may show YouTube's own ads, and stop when your phone's screen locks.
          </p>
          <YouTubeKeyForm />
        </div>
      </section>
    </div>
  )
}

export function LikedPage() {
  const { liked } = useLibrary()
  return (
    <div className="page page--hero">
      <Hero
        tint="#7c3aed"
        art={<div className="liked-tile liked-tile--hero"><HeartIcon size={72} filled /></div>}
        kind="Playlist"
        title="Liked Songs"
        meta={`${songs(liked.length)}${liked.length ? ` · ${totalDuration(liked)}` : ''}`}
        tracks={liked}
      />
      {liked.length ? (
        <TrackList tracks={liked} />
      ) : (
        <div className="empty">
          <HeartIcon size={40} />
          <p>Songs you like will appear here. Tap the heart on any song.</p>
          <Link className="btn" to="/search">Find songs</Link>
        </div>
      )}
    </div>
  )
}

export function MyPlaylistPage() {
  const id = useParams().id ?? ''
  const { playlists, renamePlaylist, deletePlaylist } = useLibrary()
  const { showToast } = useUI()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const playlist = playlists.find((p) => p.id === id)

  if (!playlist) {
    return (
      <div className="page">
        <div className="empty">
          <p>This playlist doesn't exist anymore.</p>
          <Link className="btn" to="/library">Back to library</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--hero">
      <Hero
        art={<Artwork src={playlist.tracks[0]?.artworkLarge} alt="" seed={playlist.id} />}
        kind="Your playlist"
        title={playlist.name}
        meta={`${songs(playlist.tracks.length)}${playlist.tracks.length ? ` · ${totalDuration(playlist.tracks)}` : ''}`}
        tracks={playlist.tracks}
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => setEditing(true)}>Rename</button>
            <button
              className="icon-btn"
              aria-label="Delete playlist"
              onClick={() => {
                if (!confirm(`Delete "${playlist.name}"?`)) return
                deletePlaylist(playlist.id)
                showToast('Playlist deleted')
                navigate('/library')
              }}
            >
              <TrashIcon size={20} />
            </button>
          </>
        }
      />
      {editing && (
        <form
          className="rename"
          onSubmit={(e) => {
            e.preventDefault()
            const name = new FormData(e.currentTarget).get('name')?.toString().trim()
            if (name) renamePlaylist(playlist.id, name)
            setEditing(false)
          }}
        >
          <input className="input" name="name" defaultValue={playlist.name} autoFocus maxLength={80} />
          <button className="btn" type="submit">Save</button>
          <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      )}
      {playlist.tracks.length ? (
        <TrackList tracks={playlist.tracks} playlistId={playlist.id} />
      ) : (
        <div className="empty">
          <p>This playlist is empty. Use the ⋯ menu on any song and choose “Add to playlist”.</p>
          <Link className="btn" to="/search">Search for songs</Link>
        </div>
      )}
    </div>
  )
}
