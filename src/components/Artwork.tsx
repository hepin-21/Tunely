import { useEffect, useRef, useState } from 'react'
import { artworkMirrors } from '../api/audius'
import { MusicIcon, UserIcon } from './Icons'

interface Props {
  src: string | null | undefined
  alt: string
  className?: string
  round?: boolean
  seed?: string
}

const MAX_MIRROR_TRIES = 3
const SLOW_MS = 7000

// Deterministic gradient so tracks without cover art still look distinct
function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 60) % 360} 70% 30%))`
}

/** Same image path on another content node, or null when we've run out. */
function mirrorUrl(src: string, attempt: number) {
  try {
    const url = new URL(src)
    const hosts = artworkMirrors().filter((h) => !src.startsWith(h))
    const host = hosts[attempt - 1]
    return host && attempt <= MAX_MIRROR_TRIES ? host + url.pathname : null
  } catch {
    return null
  }
}

export function Artwork({ src, alt, className = '', round, seed = alt }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setAttempt(0)
    setLoaded(false)
  }, [src])

  const current = !src ? null : attempt === 0 ? src : mirrorUrl(src, attempt)
  const imgRef = useRef<HTMLImageElement>(null)
  const [visible, setVisible] = useState(false)

  // Lazy images only start loading once on screen, so only time them from then
  useEffect(() => {
    const el = imgRef.current
    if (!el || visible) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [current, visible])

  // A hung node never fires onError, so move on to a mirror if it's too slow
  useEffect(() => {
    if (!current || loaded || !visible) return
    const id = setTimeout(() => setAttempt((a) => a + 1), SLOW_MS)
    return () => clearTimeout(id)
  }, [current, loaded, visible])

  const cls = `artwork ${round ? 'artwork--round' : ''} ${className}`
  if (!current) {
    return (
      <div className={`${cls} artwork--empty`} style={{ background: gradientFor(seed) }} role="img" aria-label={alt}>
        {round ? <UserIcon size={28} /> : <MusicIcon size={28} />}
      </div>
    )
  }
  return (
    <img
      key={current}
      ref={imgRef}
      className={`${cls} ${loaded ? 'is-loaded' : ''}`}
      src={current}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setAttempt((a) => a + 1)}
    />
  )
}
