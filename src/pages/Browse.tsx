import { Link } from 'react-router-dom'
import { GENRES, MOODS } from '../api/audius'
import { REGIONAL } from '../api/regional'
import { SINGER_GROUPS, singersIn } from '../api/singers'
import { SingerCard } from '../components/SingerCard'

const MOOD_COLORS = ['#0ea5e9', '#f97316', '#e11d48', '#eab308', '#6366f1', '#14b8a6', '#a855f7', '#22c55e']

export function BrowsePage() {
  return (
    <div className="page">
      <header className="page-head">
        <h1>Browse</h1>
        <p className="muted">Explore by genre or mood. Every song is free to play.</p>
      </header>
      {SINGER_GROUPS.map((g) => (
        <section className="section" key={g.group}>
          <div>
            <h2>{g.title}</h2>
            <p className="muted">{g.subtitle}</p>
          </div>
          <div className="card-grid">
            {singersIn(g.group).map((s) => (
              <SingerCard key={s.slug} singer={s} />
            ))}
          </div>
        </section>
      ))}
      <section className="section">
        <h2>Indian music</h2>
        <div className="genre-grid">
          {REGIONAL.map((c) => (
            <Link key={c.slug} to={`/india/${c.slug}`} className="genre-tile" style={{ background: c.color }}>
              {c.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Moods</h2>
        <div className="genre-grid">
          {MOODS.map((m, i) => (
            <Link key={m} to={`/mood/${encodeURIComponent(m)}`} className="genre-tile" style={{ background: MOOD_COLORS[i % MOOD_COLORS.length] }}>
              {m}
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Genres</h2>
        <div className="genre-grid">
          {GENRES.map((g) => (
            <Link key={g.name} to={`/genre/${encodeURIComponent(g.name)}`} className="genre-tile" style={{ background: g.color }}>
              {g.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
