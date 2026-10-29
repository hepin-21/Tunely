import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <h1>Page not found</h1>
        <p className="muted">The page you're looking for doesn't exist.</p>
        <Link className="btn" to="/">Go home</Link>
      </div>
    </div>
  )
}
