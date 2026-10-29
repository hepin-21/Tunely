# Tunely: free music, no ads

A web app that installs like a phone app. It streams **full-length songs for free**, with **no ads, no account, and no tracking**.

Music comes from [Audius](https://audius.co), an open platform where independent artists publish their music for anyone to stream. Its public API needs no key and costs nothing. Paid or gated tracks are filtered out, so everything in the app is free to play.

## Features

- **Smart search** (`src/lib/search.ts`) for songs, artists and playlists:
  - Falls back to parts of the query when a full song name finds nothing
  - Ranks results by how many of your words match, using popularity only to break ties
  - Merges duplicate re-uploads and hides clips under a minute ("Show clips" brings them back)
  - Cleans messy titles (`Pal___%5BSlowed%5D(128k)` → `Pal [Slowed]`)
  - Shows a "Top result" card and recent searches
- **Suggestions**
  - *Made for you*: a mix built on your device from the genres and artists you like and play
  - *Because you like …*: genre shelves based on your taste
  - *Autoplay*: when your queue ends, similar songs keep playing
  - *Fans also like* on artist pages
- **Indian music**: Hindi & Bollywood, Hindi lo-fi, 90s/retro Hindi, Punjabi, Desi hip-hop, Sufi & Qawwali, Bhakti/devotional, Tamil, Telugu. Hindi, Punjabi, Tamil and Telugu songs are detected (including from search), so autoplay and suggestions stay in the same language. Collections are defined in `src/api/regional.ts`.
- **Singer playlists** (`/singer/darshan-raval` and 21 more, listed in `src/api/singers.ts`):
  - With a YouTube key: the singer's official songs from YouTube, one entry per song (official, lyric and audio uploads merged), shorts and jukeboxes removed, most popular first, cached for a week
  - Without a key: their covers and remixes from Audius
- **Discover**: trending this week, month, year or all time; underground picks; genres; moods; community playlists
- **Player**: queue, play next, shuffle, repeat (all/one), seek, volume, full-screen Now Playing, keyboard shortcuts
- **Lock-screen and headphone controls** on phones (Media Session API)
- **Library**: Liked Songs, your own playlists (create, rename, delete), recently played. Everything is saved in the browser, so no sign-up is needed.
- **Mobile-first, responsive UI**: bottom tabs and mini player on phones, sidebar and player bar on desktop
- **Installable PWA**: "Add to Home Screen" on Android/iOS, or "Install app" in Chrome/Edge

## YouTube results (optional)

Film and label releases (Bollywood, T-Series, Punjabi hits…) aren't on Audius. With a free YouTube API key, search also shows YouTube songs. They play inside the app in YouTube's official embedded player, with the same queue, likes, playlists and history.

1. Open the [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) page in Google Cloud (any Google account) and click **Enable**.
2. Go to **Credentials → Create credentials → API key**.
3. Either paste it in the app (**Library → Settings**, or the card on the Search page; it's saved only in that browser), or set it for everyone in `.env.local`:
   ```
   VITE_YOUTUBE_API_KEY=AIza...
   ```
4. For a public site, restrict the key: **Application restrictions → Websites → your domain**, and **API restrictions → YouTube Data API v3**.

Limits and trade-offs:
- **Quota:** the free tier is 10,000 units/day, and a search costs about 101, so roughly **100 searches per day per key**. Results are cached for 24 hours and only fetched once typing pauses. When the limit is hit, the app says so and links to YouTube.
- **Ads:** YouTube may show its own ads inside its player. Audius songs stay ad-free.
- **Visible player:** YouTube's terms require the video to be visible while it plays, so it appears in a small window (or in Now Playing).
- **Phones:** YouTube songs stop when the screen locks. On iPhone the first YouTube song may need a tap on the video.
- **Blocked videos:** some videos block embedding. These are skipped automatically.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server also prints a **Network** URL. Open that on your phone (same Wi-Fi) to try the mobile layout.

Keyboard: `Space` play/pause · `←/→` seek 5s · `Shift+←/→` previous/next.

## Build and deploy (free)

```bash
npm run build      # outputs static files to dist/
npm run preview    # serve the production build locally
```

`dist/` is a static site. Music streams directly from Audius and YouTube to each listener, so the host only serves ~0.4 MB of app files and free plans are plenty. Page routing is already set up for Netlify (`public/_redirects`), Vercel (`vercel.json`) and Cloudflare Pages (automatic). All of them provide HTTPS, which phones need to install the app.

**Quickest: Netlify Drop (no account setup, no Git)**
1. `npm run build` (this bakes the YouTube key from `.env.local` into `dist/`).
2. Open https://app.netlify.com/drop, sign up free, and drag the `dist` folder onto the page.
3. You get a link like `https://tunely-abc123.netlify.app`. Rename it under *Site configuration → Change site name*.
4. To update later: build again and drag `dist` onto *Deploys* for that site.

**Auto-deploy on every change: Vercel or Cloudflare Pages with GitHub**
1. Push the project to a GitHub repository (`.env.local` stays private because it's git-ignored).
2. Import the repo at https://vercel.com/new or Cloudflare → *Workers & Pages → Create → Pages → Connect to Git*.
3. Build command `npm run build`, output folder `dist` (Vercel detects these automatically).
4. Add an environment variable `VITE_YOUTUBE_API_KEY` with your key in the host's settings, then deploy.

**GitHub Pages (free for public repositories)**
The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. It sets the sub-folder path (`/<repo>/`) and adds a `404.html` so links like `/singer/kinjal-dave` open directly.
1. Create a **public** repository on GitHub and push the project to its `main` branch.
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. Optional, for YouTube: **Settings → Secrets and variables → Actions → New repository secret** named `VITE_YOUTUBE_API_KEY`.
4. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to finish (re-run it after adding the secret). The site is at `https://<username>.github.io/<repo>/`.

**After deploying, lock the YouTube key to your site.** The key is visible in the app's code (that's unavoidable for browser apps), so restrict it: Google Cloud → *APIs & Services → Credentials →* your key → *Application restrictions: Websites* → add `https://your-site.netlify.app/*` or `https://<username>.github.io/*` (and `http://localhost:5173/*` for development). Under *API restrictions*, allow only *YouTube Data API v3*.

## Project structure

```
src/
  api/audius.ts        Audius API client; filters out non-free tracks
  lib/recommend.ts     On-device suggestion engine (taste profile, similar songs)
  store/player.tsx     Audio engine: queue, shuffle/repeat, autoplay, lock-screen controls
  store/library.tsx    Likes, playlists, history (localStorage)
  store/ui.tsx         Toasts, track menu, dialogs
  components/          Player bar, Now Playing, track rows, cards, layout
  pages/               Home, Search, Browse, Genre/Mood, Artist, Playlist, Library
public/
  manifest.webmanifest, sw.js, icons   PWA install support
```

## Notes

- All songs are streamed legally from Audius. Credit goes to the artists, so tap an artist name to see their page.
- Likes and playlists are stored in your browser. Clearing site data removes them.
