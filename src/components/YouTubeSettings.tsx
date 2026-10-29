import { useState } from 'react'
import { setYouTubeKey, testYouTubeKey, useYouTubeKey, YouTubeError, youtubeKeyFromBuild } from '../api/youtube'

const CONSOLE_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'

/** Paste / check / remove the YouTube Data API key. */
export function YouTubeKeyForm({ onSaved }: { onSaved?: () => void }) {
  const current = useYouTubeKey()
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (youtubeKeyFromBuild()) {
    return <p className="muted small">YouTube is set up for this site by its owner.</p>
  }

  const save = async () => {
    if (!value.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      await testYouTubeKey(value)
      setYouTubeKey(value)
      setValue('')
      setStatus({ ok: true, msg: 'Key works. YouTube results are on.' })
      onSaved?.()
    } catch (e) {
      const msg =
        e instanceof YouTubeError && e.kind === 'quota'
          ? 'This key has used up its daily limit. It will work again tomorrow.'
          : e instanceof YouTubeError && e.kind === 'network'
            ? "Couldn't reach YouTube to check the key. Check your connection."
            : `That key didn't work: ${e instanceof Error ? e.message : 'unknown error'}`
      setStatus({ ok: false, msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="yt-key">
      {current ? (
        <div className="yt-key__row">
          <span className="small">
            ✓ YouTube key saved <span className="muted">(…{current.slice(-4)})</span>
          </span>
          <button className="link-more" onClick={() => setYouTubeKey('')}>Remove</button>
        </div>
      ) : (
        <ol className="tips muted small">
          <li>
            Open the{' '}
            <a href={CONSOLE_URL} target="_blank" rel="noreferrer">
              YouTube Data API v3 page
            </a>{' '}
            in Google Cloud (free, sign in with any Google account) and click <b>Enable</b>.
          </li>
          <li>Go to <b>Credentials → Create credentials → API key</b> and copy it.</li>
          <li>Paste it below. It's saved only in this browser.</li>
        </ol>
      )}
      <form
        className="yt-key__form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          className="input"
          placeholder={current ? 'Replace with a new key' : 'Paste your API key (starts with AIza…)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn" type="submit" disabled={busy || !value.trim()}>
          {busy ? 'Checking…' : 'Save'}
        </button>
      </form>
      {status && <p className={`small ${status.ok ? 'ok-text' : 'error-text'}`}>{status.msg}</p>}
    </div>
  )
}
