import { useEffect, useRef, type RefObject } from 'react'
import type { Track } from '../api/audius'
import { featuresOf } from '../lib/features'
import { useProgress } from '../store/player'

// Waves that move with the song: they pulse on the beat at the track's tempo (Audius measures
// BPM; otherwise it's estimated from the song's energy), hit harder for energetic songs and
// sway gently for calm ones, and follow play, pause and seeking.
// Not live audio analysis on purpose: that needs Web Audio, which stops playback when an
// iPhone locks, and YouTube's player doesn't share its audio at all.

/** A steady pseudo-random number in [0, 1) for a bar and a moment, so bars jitter like a spectrum. */
function noise(i: number, step: number) {
  const x = Math.sin(i * 127.1 + step * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Tempo folded into a comfortable 70–150 BPM pulse (a 180 BPM track pulses at 90). */
function pulseBpm(track: Track) {
  const f = featuresOf(track)
  let bpm = f.bpm ?? 70 + f.energy * 70
  while (bpm > 150) bpm /= 2
  while (bpm < 70) bpm *= 2
  return bpm
}

export function Visualizer({ track, playing, glow }: { track: Track; playing: boolean; glow?: RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { time } = useProgress()
  // Progress arrives a few times a second; the animation runs from the last report plus elapsed time
  const clock = useRef({ time, at: performance.now() })
  const live = useRef({ playing, bpm: pulseBpm(track), energy: featuresOf(track).energy })
  if (clock.current.time !== time || live.current.playing !== playing) clock.current = { time, at: performance.now() }
  live.current = { playing, bpm: pulseBpm(track), energy: featuresOf(track).energy }

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let heights: number[] = []
    let level = 0
    let frame = 0

    const draw = () => {
      const { playing, bpm, energy } = live.current
      const { time, at } = clock.current
      const t = time + (playing ? (performance.now() - at) / 1000 : 0)
      const n = heights.length
      const beats = (t * bpm) / 60
      const phase = beats - Math.floor(beats)
      // Energetic songs get a sharp kick on each beat; calm ones a smooth swell
      const kick = Math.exp(-phase * (3 + energy * 6))
      const swell = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2)
      const beat = energy * kick + (1 - energy) * swell
      const hat = Math.exp(-((beats * 2) % 1) * 10) * energy
      const step = Math.floor(beats * 4) // new jitter every 16th note

      for (let i = 0; i < n; i++) {
        const d = Math.abs(i / (n - 1) - 0.5) * 2 // 0 in the middle, 1 at the edges
        const shape = 1 - Math.pow(d, 1.6) * 0.75
        let target = 0.06 * shape
        if (playing && !still) {
          const flow = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.45) * Math.sin(t * 0.9 - i * 0.21)
          const mix = 0.35 * flow + 0.4 * beat * (1 - d * 0.5) + 0.25 * noise(i, step) + 0.25 * hat * d
          target = shape * (0.15 + 0.85 * mix) * (0.45 + 0.55 * energy)
        } else if (still) {
          target = shape * 0.35
        }
        // Rise fast, fall slowly, like a level meter (reduced motion: just the resting shape)
        heights[i] = still ? target : heights[i] + (target - heights[i]) * (target > heights[i] ? 0.45 : 0.12)
      }
      level += ((playing && !still ? beat * (0.4 + 0.6 * energy) : 0) - level) * 0.25
      glow?.current?.style.setProperty('--beat', level.toFixed(3))

      const { width: w, height: h } = el
      ctx.clearRect(0, 0, w, h)
      const gap = w / n
      const bar = Math.max(2, gap * 0.55)
      const gradient = ctx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, '#8b5cf6')
      gradient.addColorStop(1, '#ec4899')
      ctx.fillStyle = gradient
      for (let i = 0; i < n; i++) {
        const bh = Math.max(bar, heights[i] * h * 0.95)
        const x = i * gap + (gap - bar) / 2
        ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, heights[i] * 1.5)
        ctx.beginPath()
        ctx.roundRect(x, (h - bh) / 2, bar, bh, bar / 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (!still) frame = requestAnimationFrame(draw)
    }

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      el.width = Math.round(el.clientWidth * dpr)
      el.height = Math.round(el.clientHeight * dpr)
      const n = Math.max(24, Math.min(72, Math.floor(el.clientWidth / 9)))
      if (heights.length !== n) heights = Array.from({ length: n }, () => 0.05)
      if (still) draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    if (!still) draw()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [glow])

  return <canvas ref={canvas} className="viz" aria-hidden="true" />
}
