import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { audius, GENRES, type Track } from '../api/audius'
import { REGIONAL } from '../api/regional'
import { GROUP_KEYWORDS, initials, SINGER_GROUPS, SINGERS, singersIn } from '../api/singers'
import { SingerCard } from '../components/SingerCard'
import { tokens } from '../lib/text'
import { searchYouTube, useYouTubeKey, YouTubeError, youtubeSearchUrl } from '../api/youtube'
import { YouTubeKeyForm } from '../components/YouTubeSettings'
import { ArtistLink, YouTubeBadge } from '../components/ArtistLink'
import { Artwork } from '../components/Artwork'
import { ArtistCard, CardSkeletons, ErrorState, PlaylistCard, RowSkeletons, Shelf } from '../components/Cards'
import { CloseIcon, ClockIcon, PauseIcon, PlayIcon, SearchIcon } from '../components/Icons'
import { TrackList } from '../components/TrackRow'
import { matchesAllWords, matchingByName, searchSongs, type SongSearch } from '../lib/search'
import { useAsync, useDebounced } from '../lib/useAsync'
import { usePlayer } from '../store/player'

type Tab = 'all' | 'songs' | 'youtube' | 'artists' | 'playlists'
const TABS: [Tab, string][] = [
  ['all', 'All'],
  ['songs', 'Songs'],
  ['youtube', 'YouTube'],
  ['artists', 'Artists'],
  ['playlists', 'Playlists'],
]
const HISTORY_KEY = 'tunely.searches'

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

// Search results are many versions of what you typed, not a playlist: playing one starts a
// radio of different songs like it, instead of the next upload of the same song.
function TopResult({ track }: { track: Track }) {
  const { current, isPlaying, startRadio, toggle } = usePlayer()
  const active = current?.id === track.id
  return (
    <div className="top-result">
      <Artwork src={track.artwork} alt="" seed={track.id} className="top-result__art" />
      <div className="top-result__text">
        <span className="hero__kind">Top result</span>
        <h3 className="top-result__title">{track.title}</h3>
        <span>
          <ArtistLink className="muted" track={track} /> <YouTubeBadge track={track} />
        </span>
      </div>
      <button
        className="play-btn play-btn--big"
        onClick={() => (active ? toggle() : startRadio(track))}
        aria-label={active && isPlaying ? 'Pause' : `Play ${track.title}`}
      >
        {active && isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
      </button>
    </div>
  )
}

function SongResults({
  query,
  songs,
  loading,
  compact,
  showClips,
  onShowClips,
  onSeeAll,
  quietEmpty,
  hideTop,
}: {
  query: string
  songs: SongSearch | undefined
  loading: boolean
  compact: boolean
  showClips: boolean
  onShowClips: () => void
  onSeeAll: () => void
  quietEmpty?: boolean // YouTube found results, so don't make "nothing here" loud
  hideTop?: boolean // a YouTube song took the top spot; list Audius's best match normally
}) {
  if (loading || !songs) {
    return (
      <section className="section">
        {compact && <h2>Songs</h2>}
        <RowSkeletons n={compact ? 5 : 10} />
      </section>
    )
  }

  const list = showClips ? [...songs.tracks, ...songs.shortClips] : songs.tracks
  const top = hideTop ? null : songs.top
  const rest = top ? list.filter((t) => t.id !== top.id) : list
  const shown = compact ? rest.slice(0, 6) : rest
  const hiddenNotes = [
    songs.duplicates > 0 && `${songs.duplicates} duplicate upload${songs.duplicates === 1 ? '' : 's'} merged`,
    !showClips && songs.shortClips.length > 0 && `${songs.shortClips.length} short clip${songs.shortClips.length === 1 ? '' : 's'} hidden`,
  ].filter(Boolean)

  return (
    <section className="section">
      {songs.closestOnly && (
        <p className="notice">
          No exact match for “{query}”. Showing the closest songs. Tip: try just the song name or the artist.
        </p>
      )}
      {top && <TopResult track={top} />}
      {compact && shown.length > 0 && <h2>Songs</h2>}
      {shown.length > 0 && <TrackList tracks={shown} showPlays radio />}

      {!list.length && quietEmpty && <p className="muted small">No matching songs from independent artists on Audius.</p>}

      {!list.length && !quietEmpty && (
        <div className="empty empty--left">
          <p>
            {songs.shortClips.length
              ? `Only short clips were found for “${query}”.`
              : `No songs found for “${query}”.`}
          </p>
          <ul className="tips muted small">
            <li>Check the spelling, or try fewer words (just the song name or the artist).</li>
            <li>Try the Hindi name in English letters, e.g. “tum hi ho”, or in Hindi script.</li>
            <li>
              Tunely plays music that artists share for free on Audius. Many new film releases aren’t there yet, but covers,
              remixes and lo-fi versions often are.
            </li>
          </ul>
        </div>
      )}

      {(hiddenNotes.length > 0 || (compact && rest.length > 6)) && (
        <div className="search-meta">
          {hiddenNotes.length > 0 && <span className="muted small">{hiddenNotes.join(' · ')}</span>}
          {!showClips && songs.shortClips.length > 0 && (
            <button className="link-more" onClick={onShowClips}>Show clips</button>
          )}
          {compact && rest.length > 6 && <button className="link-more" onClick={onSeeAll}>See all {rest.length} songs</button>}
        </div>
      )}
    </section>
  )
}

function YouTubeSetup({ query, compact }: { query: string; compact: boolean }) {
  const [open, setOpen] = useState(!compact)
  return (
    <section className="yt-setup">
      <div className="yt-setup__head">
        <div>
          <h3>Get more songs from YouTube</h3>
          <p className="muted small">
            Film and label releases (Bollywood, T-Series, Punjabi hits…) aren't on Audius. Add a free YouTube API key to
            search YouTube too.
          </p>
        </div>
        {!open && (
          <button className="btn btn--ghost" onClick={() => setOpen(true)}>Set up</button>
        )}
      </div>
      {open && <YouTubeKeyForm />}
      <a className="link-more" href={youtubeSearchUrl(query)} target="_blank" rel="noreferrer">
        Search “{query}” on YouTube ↗
      </a>
    </section>
  )
}

function YouTubeResults({
  query,
  hasKey,
  state,
  compact,
  top,
  onSeeAll,
}: {
  query: string
  hasKey: boolean
  state: { data: Track[] | null | undefined; loading: boolean; error: Error | null; reload: () => void }
  compact: boolean
  top: Track | null
  onSeeAll: () => void
}) {
  if (!hasKey) return <YouTubeSetup query={query} compact={compact} />

  if (!state.loading && state.error) {
    const e = state.error
    const kind = e instanceof YouTubeError ? e.kind : 'network'
    return (
      <section className="section">
        <h2 className="yt-heading">From YouTube</h2>
        <div className="notice">
          {kind === 'quota'
            ? "YouTube's free daily search limit is used up. It resets at midnight (US Pacific time)."
            : kind === 'key'
              ? `YouTube rejected the API key: ${e.message}`
              : "Couldn't reach YouTube right now."}
        </div>
        <div className="search-meta">
          {kind === 'network' && <button className="link-more" onClick={state.reload}>Try again</button>}
          <a className="link-more" href={youtubeSearchUrl(query)} target="_blank" rel="noreferrer">Search on YouTube ↗</a>
        </div>
        {kind === 'key' && <YouTubeKeyForm onSaved={state.reload} />}
      </section>
    )
  }

  if (state.loading || state.data === undefined) {
    return (
      <section className="section">
        <h2 className="yt-heading">From YouTube</h2>
        <RowSkeletons n={compact ? 3 : 8} />
      </section>
    )
  }

  const tracks = state.data ?? []
  if (!tracks.length) {
    return (
      <section className="section">
        <h2 className="yt-heading">From YouTube</h2>
        <p className="muted">No playable YouTube music videos for “{query}”.</p>
      </section>
    )
  }

  const rest = top ? tracks.filter((t) => t.id !== top.id) : tracks
  const shown = compact ? rest.slice(0, 5) : rest
  return (
    <section className="section">
      {top && <TopResult track={top} />}
      <h2 className="yt-heading">From YouTube</h2>
      <TrackList tracks={shown} showPlays radio />
      <div className="search-meta">
        {compact && rest.length > 5 && <button className="link-more" onClick={onSeeAll}>See all {tracks.length} from YouTube</button>}
        <span className="muted small">Plays in YouTube's player. YouTube may show its own ads.</span>
      </div>
    </section>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')
  const [tab, setTab] = useState<Tab>('all')
  const [history, setHistory] = useState<string[]>(loadHistory)
  const input = useRef<HTMLInputElement>(null)
  const query = useDebounced(text.trim(), 400)

  // Keep the URL in sync so searches can be shared and survive reloads
  useEffect(() => {
    setParams(query ? { q: query } : {}, { replace: true })
  }, [query, setParams])

  // Remember searches that the user actually waited on
  useEffect(() => {
    if (query.length < 2) return
    const id = setTimeout(() => {
      setHistory((h) => {
        const next = [query, ...h.filter((x) => x.toLowerCase() !== query.toLowerCase())].slice(0, 10)
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    }, 1500)
    return () => clearTimeout(id)
  }, [query])

  const results = useAsync(async () => {
    if (!query) return null
    const [songs, artists, playlists] = await Promise.all([
      searchSongs(query),
      audius.searchArtists(query, 20).catch(() => []),
      audius.searchPlaylists(query, 20).catch(() => []),
    ])
    return {
      songs,
      artists: matchingByName(artists, (a) => `${a.name} ${a.handle}`, query),
      playlists: matchingByName(playlists, (p) => p.name, query),
    }
  }, [query])
  const [showClips, setShowClips] = useState(false)
  useEffect(() => setShowClips(false), [query])

  // YouTube searches use daily quota, so wait a little longer for typing to settle
  const ytKey = useYouTubeKey()
  const ytQuery = useDebounced(query, 700)
  const yt = useAsync(
    () => (ytKey && ytQuery.length >= 2 ? searchYouTube(ytQuery) : Promise.resolve(null)),
    [ytQuery, ytKey],
  )
  const ytPending = !!ytKey && (yt.loading || ytQuery !== query)

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  const data = results.data
  const searching = results.loading || text.trim() !== query
  // Typing a known singer's name offers their full playlist
  const groupMatch = tokens(query).map((w) => GROUP_KEYWORDS[w]).find(Boolean)
  const singerMatch =
    query.length >= 3
      ? SINGERS.find((s) => tokens(query).every((w) => tokens(s.name).some((n) => n.startsWith(w))))
      : undefined

  // When Audius has no real match (e.g. new film songs), YouTube results go first
  const ytTracks = !ytPending && yt.data ? yt.data : []
  const ytMatch = ytTracks.find((t) => matchesAllWords(t, query)) ?? null
  const audiusTop = data?.songs.top ?? null
  // Top result: the more popular of the two sources' full matches (an obscure Audius upload
  // named "Kalyani …" shouldn't beat the 8M-view song people are looking for)
  const ytWinsTop = !!ytMatch && (!audiusTop || ytMatch.plays > audiusTop.plays)
  const ytFirst = !searching && !!data && ytTracks.length > 0 && (ytWinsTop || !audiusTop)
  const ytTop = ytWinsTop ? ytMatch : ytFirst ? ytTracks[0] : null
  const youtubeSection = (compact: boolean) => (
    <YouTubeResults
      query={query}
      hasKey={!!ytKey}
      state={{ data: ytPending ? undefined : yt.data, loading: ytPending, error: ytPending ? null : yt.error, reload: yt.reload }}
      compact={compact}
      top={compact ? ytTop : (ytMatch ?? ytTracks[0] ?? null)}
      onSeeAll={() => setTab('youtube')}
    />
  )

  return (
    <div className="page">
      <div className="search-box">
        <SearchIcon size={20} />
        <input
          ref={input}
          type="search"
          placeholder="Try “arijit”, “punjabi”, “lofi”…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          enterKeyHint="search"
          aria-label="Search music"
        />
        {text && (
          <button
            className="icon-btn"
            onClick={() => {
              setText('')
              input.current?.focus()
            }}
            aria-label="Clear search"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {!text.trim() && (
        <>
          {history.length > 0 && (
            <section className="section">
              <header className="shelf__head">
                <h2>Recent searches</h2>
                <button className="link-more" onClick={clearHistory}>Clear</button>
              </header>
              <div className="chips">
                {history.map((h) => (
                  <button key={h} className="chip" onClick={() => setText(h)}>
                    <ClockIcon size={14} /> {h}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="section">
            <h2>Browse all</h2>
            <div className="genre-grid">
              {REGIONAL.map((c) => (
                <Link key={c.slug} to={`/india/${c.slug}`} className="genre-tile" style={{ background: c.color }}>
                  {c.name}
                </Link>
              ))}
              {GENRES.map((g) => (
                <Link key={g.name} to={`/genre/${encodeURIComponent(g.name)}`} className="genre-tile" style={{ background: g.color }}>
                  {g.name}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {text.trim() && (
        <>
          <div className="tabs" role="tablist">
            {TABS.map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'is-on' : ''}`} onClick={() => setTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {results.error && !searching && <ErrorState onRetry={results.reload} />}

          {tab === 'all' && groupMatch && (
            <Shelf title={SINGER_GROUPS.find((g) => g.group === groupMatch)!.title} subtitle="Singer playlists">
              {singersIn(groupMatch).map((s) => (
                <SingerCard key={s.slug} singer={s} />
              ))}
            </Shelf>
          )}

          {tab === 'all' && singerMatch && (
            <Link className="singer-hit" to={`/singer/${singerMatch.slug}`}>
              <span className="singer-initials singer-hit__art" style={{ background: singerMatch.color }}>{initials(singerMatch.name)}</span>
              <span>
                <span className="hero__kind">Singer playlist</span>
                <strong>{singerMatch.name}</strong>
                <span className="muted small">{singerMatch.tagline} · all their songs in one place</span>
              </span>
              <span className="singer-hit__go">Open ›</span>
            </Link>
          )}

          {tab === 'all' && ytFirst && youtubeSection(true)}

          {(tab === 'all' || tab === 'songs') && (
            <SongResults
              query={query}
              songs={data?.songs}
              loading={searching && !data}
              compact={tab === 'all'}
              showClips={showClips}
              onShowClips={() => setShowClips(true)}
              onSeeAll={() => setTab('songs')}
              quietEmpty={ytTracks.length > 0}
              hideTop={tab === 'all' && ytWinsTop}
            />
          )}

          {tab === 'all' && !ytFirst && youtubeSection(true)}
          {tab === 'youtube' && youtubeSection(false)}

          {(tab === 'all' || tab === 'artists') &&
            (tab === 'artists' ? (
              data && !searching && !data.artists.length ? (
                <p className="muted">No artists named like “{query}”.</p>
              ) : (
                <div className="card-grid">
                  {searching && !data ? <CardSkeletons n={8} round /> : data?.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
                </div>
              )
            ) : (
              (searching || !!data?.artists.length) && (
                <Shelf title="Artists">
                  {searching && !data ? <CardSkeletons round /> : data?.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
                </Shelf>
              )
            ))}

          {(tab === 'all' || tab === 'playlists') &&
            (tab === 'playlists' ? (
              data && !searching && !data.playlists.length ? (
                <p className="muted">No playlists named like “{query}”.</p>
              ) : (
                <div className="card-grid">
                  {searching && !data ? <CardSkeletons n={8} /> : data?.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
                </div>
              )
            ) : (
              (searching || !!data?.playlists.length) && (
                <Shelf title="Playlists">
                  {searching && !data ? <CardSkeletons /> : data?.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
                </Shelf>
              )
            ))}
        </>
      )}
    </div>
  )
}
