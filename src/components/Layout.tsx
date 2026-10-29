import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { songs } from '../lib/format'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUI } from '../store/ui'
import { Artwork } from './Artwork'
import { CompassIcon, HeartIcon, HomeIcon, LibraryIcon, PlusIcon, SearchIcon } from './Icons'
import { NowPlaying } from './NowPlaying'
import { PlayerBar } from './PlayerBar'
import { YouTubeDock } from './YouTubeDock'
import { PlaylistPicker, Toast, TrackMenu } from './Overlays'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/browse', label: 'Browse', icon: CompassIcon },
  { to: '/library', label: 'Library', icon: LibraryIcon },
]

function Sidebar() {
  const { playlists, liked, createPlaylist } = useLibrary()
  const { showToast } = useUI()
  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={32} height={32} />
        <span>Tunely</span>
      </Link>
      <nav className="sidebar__nav">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="sidebar__link">
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__lib">
        <div className="sidebar__lib-head">
          <span>Your playlists</span>
          <button
            className="icon-btn"
            aria-label="New playlist"
            onClick={() => {
              const p = createPlaylist(`My playlist #${playlists.length + 1}`)
              showToast(`Created ${p.name}`)
            }}
          >
            <PlusIcon size={18} />
          </button>
        </div>
        <NavLink to="/liked" className="sidebar__pl">
          <span className="liked-tile"><HeartIcon size={16} filled /></span>
          <span>
            <span className="sidebar__pl-name">Liked Songs</span>
            <span className="muted small">{songs(liked.length)}</span>
          </span>
        </NavLink>
        {playlists.map((p) => (
          <NavLink key={p.id} to={`/my/${p.id}`} className="sidebar__pl">
            <Artwork src={p.tracks[0]?.artwork} alt="" seed={p.id} className="sidebar__pl-art" />
            <span>
              <span className="sidebar__pl-name">{p.name}</span>
              <span className="muted small">{songs(p.tracks.length)}</span>
            </span>
          </NavLink>
        ))}
      </div>
      <p className="sidebar__foot muted small">
        100% free · No ads · No sign-up
        <br />
        Music from independent artists on{' '}
        <a href="https://audius.co" target="_blank" rel="noreferrer">Audius</a>
      </p>
    </aside>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="bottom-nav__link">
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  const { current } = usePlayer()
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)

  // Scroll to top on page change
  useEffect(() => {
    main.current?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={`app ${current ? 'has-player' : ''} ${current?.source === 'youtube' ? 'has-video' : ''}`}>
      <Sidebar />
      <main className="main" ref={main}>
        <Outlet />
      </main>
      <PlayerBar />
      <YouTubeDock />
      <BottomNav />
      <NowPlaying />
      <TrackMenu />
      <PlaylistPicker />
      <Toast />
    </div>
  )
}
