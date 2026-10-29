import { debugLog } from './debugLog'

// Wraps the official YouTube IFrame player so it behaves like an <audio> element
// (src, play(), pause(), currentTime, and the same events). The player store can
// then drive Audius and YouTube tracks with one set of logic.

/* The IFrame API has no bundled types; this is the subset we use. */
interface YTPlayer {
  loadVideoById(id: string): void
  cueVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getVideoLoadedFraction(): number
  setVolume(v: number): void
  mute(): void
  unMute(): void
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: object) => YTPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const
const STATE_NAMES: Record<number, string> = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' }
const LOAD_TIMEOUT_MS = 60000 // slow connections can need 20s+ for YouTube's ~2 MB player
const WATCHDOG_MS = 7000

/** IFrame API error codes → what to tell the listener */
function describeError(code: number) {
  switch (code) {
    case 2:
      return 'This YouTube link is invalid.'
    case 5:
      return "YouTube's player couldn't play this video in your browser."
    case 100:
      return 'This video was removed from YouTube or made private.'
    case 101:
    case 150:
      return 'The owner only allows this video to play on YouTube itself.'
    case 153:
      return 'YouTube refused to play here because the page sent no referrer.'
    default:
      return `YouTube couldn't play this video (error ${code}).`
  }
}

let apiPromise: Promise<NonNullable<Window['YT']>> | null = null

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    const started = performance.now()
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        debugLog('api ready', { ms: Math.round(performance.now() - started) })
        previous?.()
        resolve(window.YT!)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        debugLog('api script failed to load (blocked?)')
        apiPromise = null
        script.remove()
        reject(new Error('The YouTube player could not be loaded'))
      }
      debugLog('loading api script')
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

export class YouTubeMedia extends EventTarget {
  private host: HTMLElement | null = null
  private player: YTPlayer | null = null
  private ready: Promise<YTPlayer> | null = null
  private videoId = ''
  private needsLoad = false
  private _paused = true
  private _volume = 1
  private _muted = false
  private timer = 0
  private watchdog = 0
  private state = -1
  /** Why the last 'error' happened, in words people can act on */
  errorReason: string | null = null
  /** True when the player itself can't load, so skipping to another YouTube song won't help */
  playerUnavailable = false

  /** The (visible) element the iframe lives in; YouTube requires the player to be shown. */
  attach(el: HTMLElement) {
    this.host = el
  }

  /** Load the API and create the iframe ahead of time, so the first play starts quickly. */
  warmUp() {
    this.ensure().catch(() => {})
  }

  private emit(type: string) {
    this.dispatchEvent(new Event(type))
  }

  private ensure(): Promise<YTPlayer> {
    if (this.ready) return this.ready
    if (!this.host) return Promise.reject(new Error('YouTube player has no host element'))
    const host = this.host
    const loading = loadApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          host.replaceChildren() // drop a player that never became ready
          const mount = document.createElement('div')
          host.appendChild(mount)
          const created = performance.now()
          setTimeout(() => {
            const f = host.querySelector('iframe')
            const r = host.getBoundingClientRect()
            debugLog('iframe created', {
              src: f?.src.slice(0, 120),
              allow: f?.getAttribute('allow'),
              referrerpolicy: f?.getAttribute('referrerpolicy'),
              box: `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}`,
            })
          }, 0)
          const player = new YT.Player(mount, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
            events: {
              onReady: () => {
                debugLog('player ready', { ms: Math.round(performance.now() - created) })
                this.player = player
                player.setVolume(this._volume * 100)
                if (this._muted) player.mute()
                resolve(player)
              },
              onStateChange: (e: { data: number }) => {
                debugLog('state', { state: STATE_NAMES[e.data] ?? e.data, video: this.videoId })
                this.onState(e.data)
              },
              onError: (e: { data: number }) => {
                debugLog('youtube error', { code: e.data, video: this.videoId })
                this.fail(describeError(e.data))
              },
            },
          })
        }),
    )
    // If YouTube's script or iframe is blocked (ad blocker, network filter), these never finish
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS),
    )
    this.ready = Promise.race([loading, timeout])
    this.ready.catch(() => {
      this.ready = null
    })
    return this.ready
  }

  /** While waiting for a video to start, record what the player looks like every 3s */
  private heartbeat(id: string, n = 0) {
    window.setTimeout(() => {
      if (this.videoId !== id || this.state === STATE.PLAYING || n >= 10) return
      const r = this.host?.getBoundingClientRect()
      debugLog('still waiting', {
        video: id,
        seconds: (n + 1) * 3,
        state: STATE_NAMES[this.state] ?? this.state,
        playerReady: !!this.player,
        iframe: !!this.host?.querySelector('iframe'),
        box: r ? `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}` : null,
        pageVisible: document.visibilityState,
      })
      this.heartbeat(id, n + 1)
    }, 3000)
  }

  private fail(reason: string, playerUnavailable = false) {
    debugLog('failed', { reason })
    this.errorReason = reason
    this.playerUnavailable = playerUnavailable
    clearTimeout(this.watchdog)
    this.stopTimer()
    this._paused = true
    this.emit('error')
  }

  /**
   * Browsers (phones especially) can refuse to start a YouTube video that wasn't tapped
   * directly, leaving it "unstarted" forever. Nudge it once, then ask for a tap.
   */
  private armWatchdog(player: YTPlayer, id: string, nudged = false) {
    clearTimeout(this.watchdog)
    this.watchdog = window.setTimeout(() => {
      const neverStarted = this.state === STATE.UNSTARTED || this.state === STATE.CUED
      if (this._paused || this.videoId !== id || !neverStarted) return
      if (!nudged) {
        debugLog('not started after 7s, retrying', { video: id, state: STATE_NAMES[this.state] })
        player.playVideo()
        this.armWatchdog(player, id, true)
      } else {
        debugLog('still not started, asking for a tap', { video: id, state: STATE_NAMES[this.state] })
        this.emit('blocked')
      } 
    }, WATCHDOG_MS)
  }

  private onState(state: number) {
    this.state = state
    if (state === STATE.PLAYING) {
      clearTimeout(this.watchdog)
      this.errorReason = null
      this._paused = false
      this.emit('loadedmetadata')
      this.emit('play')
      this.emit('playing')
      this.startTimer()
    } else if (state === STATE.PAUSED) {
      this._paused = true
      this.stopTimer()
      this.emit('pause')
    } else if (state === STATE.BUFFERING) {
      this.emit('waiting')
    } else if (state === STATE.ENDED) {
      this._paused = true
      this.stopTimer()
      this.emit('pause')
      this.emit('ended')
    }
  }

  // The IFrame API has no timeupdate event, so poll while playing
  private startTimer() {
    this.stopTimer()
    this.timer = window.setInterval(() => this.emit('timeupdate'), 250)
  }

  private stopTimer() {
    clearInterval(this.timer)
  }

  get src() {
    return this.videoId
  }

  set src(id: string) {
    this.videoId = id
    this.needsLoad = !!id
  }

  removeAttribute(name: 'src') {
    if (name !== 'src') return
    this.videoId = ''
    this.needsLoad = false
    this._paused = true
    clearTimeout(this.watchdog)
    this.stopTimer()
    this.player?.stopVideo()
  }

  get paused() {
    return this._paused
  }

  play(): Promise<void> {
    if (!this.videoId) return Promise.resolve()
    this._paused = false
    this.errorReason = null
    const id = this.videoId
    debugLog('play requested', {
      video: id,
      playerExists: !!this.player,
      userActivation: navigator.userActivation ? { active: navigator.userActivation.isActive, ever: navigator.userActivation.hasBeenActive } : 'n/a',
    })
    this.heartbeat(id)
    return this.ensure().then(
      (p) => {
        if (this._paused || this.videoId !== id) return // paused or changed while the player was loading
        if (this.needsLoad) {
          this.needsLoad = false
          this.state = STATE.UNSTARTED
          p.loadVideoById(id)
        } else {
          p.playVideo()
        }
        this.armWatchdog(p, id)
      },
      (err) => {
        this.fail(
          "YouTube's player didn't load. An ad blocker, browser extension or network filter may be blocking youtube.com.",
          true,
        )
        throw err
      },
    )
  }

  pause() {
    const wasPlaying = !this._paused
    this._paused = true
    clearTimeout(this.watchdog)
    this.player?.pauseVideo()
    if (wasPlaying && !this.player) this.emit('pause')
  }

  get currentTime() {
    return this.player?.getCurrentTime() ?? 0
  }

  set currentTime(t: number) {
    if (!this.player || this.needsLoad) return
    this.player.seekTo(t, true)
    this.emit('timeupdate')
  }

  get duration() {
    return this.player?.getDuration() || 0
  }

  get buffered() {
    const end = (this.player?.getVideoLoadedFraction() ?? 0) * this.duration
    return { length: end > 0 ? 1 : 0, end: (_index: number) => end }
  }

  get volume() {
    return this._volume
  }

  set volume(v: number) {
    this._volume = v
    this.player?.setVolume(v * 100)
  }

  get muted() {
    return this._muted
  }

  set muted(m: boolean) {
    this._muted = m
    if (m) this.player?.mute()
    else this.player?.unMute()
  }
}

export const youtubeMedia = new YouTubeMedia()
