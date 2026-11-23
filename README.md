# Andreas Wallevik portfolio

A small static portfolio built with Astro. Projects and the biography live in Markdown files. The published site is intended for GitHub Pages; no service or database is needed.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm run dev
```

Open the local URL Astro prints. Run `npm run check` and `npm run build` before publishing. `npm run preview` serves the built site.

## Radio prototype

`/radio/` is a noindex experiment linked from the homepage. Audio playback is static and needs no streaming server. At build time, `src/lib/radio-manifest.server.ts` scans MP3 and WAV files directly in `public/radio/audio/` for **Radio** and `public/radio/audio/beats/` for **Beat Station**. Files are sorted by filename, then their title, artist and duration are read from audio metadata. If tags are missing, `Artist - Title.mp3` supplies both names; otherwise the filename becomes the title and the artist line is omitted. A missing duration stops the build with an instruction to add an override. Other file types or unexpected folders in the public audio directories also stop the build, to avoid publishing unrelated files.

To add a song, export an MP3 to the correct folder, then commit and push it with the site when ready to publish. Prefer embedded title and artist tags. New files need no manual playlist entry. The four short generated WAV test sounds can be recreated with `node scripts/generate-radio-demo-audio.mjs`; remove them when they are no longer wanted. `src/config/radio.ts` holds optional overrides keyed by path relative to `public/radio/audio/`. Use an override for artwork, corrected title or artist, `durationSeconds` when a file has no readable duration, or `playbackDurationSeconds` to give a song a shorter radio slot. Songs without an artwork override use `radioArtworkPool`; both artwork types can include an artist credit.

The player in `src/lib/radio-player.ts` uses a fixed time anchor and the generated track durations to choose approximately the same position for listeners on the same published version whose device clocks agree. The static page embeds a versioned snapshot of its playlist; an open tab keeps its snapshot when a new deploy adds tracks. New visitors use the new snapshot. Builds with unchanged audio and metadata do not restart the schedule. Old and new versions can briefly play different songs; keep removed audio files available until old tabs have refreshed if uninterrupted playback matters. Playback starts only after a visitor presses Play. Switching stations is allowed; there is no skip control. Browsers may pause audio in the background, and the player resynchronizes when the page becomes visible again.

The radio's optional visualizer lives in `src/components/RadioVisualizer.astro` and `src/lib/radio-visualizer.ts`. Cover artwork is shown by default; visitors can enable Oscilloscope, Psychedelic or Artwork reactive mode. It uses one Web Audio `MediaElementAudioSourceNode` and one `AnalyserNode` for the existing audio element, even as tracks change. The animation stops when paused, hidden or switched off, and stays off for visitors who prefer reduced motion. External audio hosts such as R2 must allow CORS from the site origin for Web Audio analysis; the `<audio>` element requests media with `crossorigin="anonymous"`.

GitHub Pages can host this static prototype, but substantial audio libraries should be served from dedicated object storage rather than committed to Git. Drive sync and Cloudflare audio storage are outside this prototype.

### Radio reactions and guestbook

The homepage links to `/radio/`. The radio page always shows the reactions and guestbook sections. Without an API URL, their controls are disabled with an explanation. In local Astro development, the page defaults to `http://127.0.0.1:8787`; production uses `PUBLIC_RADIO_API_URL` set during the build. The API is a separate Cloudflare Worker in `worker/`, backed by one D1 database. The site and its DNS can stay on GitHub Pages; the browser calls the Worker's `workers.dev` URL. No Cloudflare resources are created by this repository or its GitHub Actions workflow.

Reactions use the existing path-based track IDs, so reordering the playlist does not reset counts. Renaming or moving an audio file changes its ID and starts new counts. Each browser stores a random token per track in local storage; D1 has one row per track and token, so refreshing or repeating a request does not add another reaction. Clearing browser storage or using another browser creates a new token. Counts refresh on track changes, when the tab becomes visible and every 30 seconds while visible.

The guestbook accepts an optional name (30 characters) and a message (280 characters). Its latest 30 entries are returned newest first. It normalizes text and strips control characters; the browser renders it with `textContent`, never HTML. A hidden form field catches simple bots. D1 rate limiting allows at most five guestbook posts per day and one per minute from the same Cloudflare-provided IP, plus 100 reaction changes per day. The Worker stores only a daily HMAC of that IP, not the raw address; buckets older than seven days are removed on a later write. This limits casual abuse but cannot stop someone who changes IP address or browser storage. No account or email is requested.

**Local setup** (two terminals):

1. Run `npm ci` and `npm run radio:api:migrate:local`.
2. Create ignored `worker/.dev.vars` containing `RATE_LIMIT_SECRET=` followed by a random value of at least 32 characters. Run `npm run radio:api:dev` (port 8787).
3. Run `npm run dev` (port 4321) in another terminal. The local API URL is automatic; use an ignored `.env` with `PUBLIC_RADIO_API_URL=...` only if your Worker runs elsewhere. Run `npm run radio:api:test` against the local Worker when needed.

**Cloudflare setup, when explicitly approved:**

1. Sign in with `npx wrangler login`, then create a free D1 database with `npx wrangler d1 create andreas-radio-social`. Replace the all-zero local placeholder `database_id` in `worker/wrangler.jsonc` with the returned ID. Check `ALLOWED_ORIGINS` before deployment.
2. Apply `npx wrangler d1 migrations apply andreas-radio-social --remote --config worker/wrangler.jsonc` and deploy with `npx wrangler deploy --config worker/wrangler.jsonc`.
3. Set a long random secret with `npx wrangler secret put RATE_LIMIT_SECRET --config worker/wrangler.jsonc`. Never put this secret in `.env`, GitHub variables, or frontend code.
4. Add the deployed `https://...workers.dev` URL (without a trailing slash) as the GitHub repository variable `PUBLIC_RADIO_API_URL`, then rebuild the Astro site. The Pages workflow passes this variable to `npm run build`. Until this variable is set, the public radio keeps playing and displays disabled social controls.

To remove an unwanted guestbook entry, note its numeric `id` from `GET /api/guestbook`, then run `npx wrangler d1 execute andreas-radio-social --remote --config worker/wrangler.jsonc --command "DELETE FROM guestbook WHERE id = 123"` with the correct ID. There is no public admin endpoint or browser-held admin secret. Cloudflare's [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) describe the current free allowances; check them before enabling the service.

Check YouTube and Vimeo playback in a regular browser window. VS Code's embedded browser can restrict video playback even when the same local page works in Edge. If automated browser testing needs a separate profile, create it under the operating system's temporary directory, outside this repository.

## Add or edit a project

Create one Markdown file per song, album, film, or creative work, such as `src/content/projects/my-work.md`. Keep the Markdown files in this flat directory; **Selected Work**, **Projects**, and **Visual Work** are listing choices, not content folders. Copy `wavy-pop-haze.md` for a detailed music entry, `gjenferd.md` for an image-led card, or `dreamlag-timelapse.md` for a video. Valid categories are `music`, `film-visuals`, `sound-for-visuals` and `experiments`. Categories describe the medium; they do not control placement.

The navigation has `/work/` for a curated overview, `/work/sound/` for music and sound, and `/work/visual/` for the full video gallery. Use one Markdown entry for each work, even when it belongs to both disciplines. Add `music` or `sound-for-visuals` to `categories` to include a listed entry on Sound. Set `showInVisualWork: true` with a `video` to include it on Visual. For work that spans both, such as a music video with songwriting and video production, use `categories: [music, film-visuals]` and `showInVisualWork: true`. The `featured` and `showInProjects` flags still decide placement within the Sound page and the Work overview; category alone never makes a draft public.

For every published entry, provide `title` and `categories`, plus either `cover` with `coverAlt` or a `video`. Add `artistOrClient`, `subtitle`, `roles`, `collaborators`, `credits`, `status`, `description`, `year`, `releaseDate`, and `links` when known. `collaborators` is a list of names shown in the project detail metadata, for example `collaborators: [Kjærleik]`. `credits` groups exact roles and names. `status` displays a small note on cards, as with Gjenferd. Links appear on cards and detail pages. The Markdown body provides detail-page copy. Leave unconfirmed credits and dates out rather than guessing.

### Visibility

New entries default to `draft: true`. Set the flags explicitly when the work is ready:

| Frontmatter | Result |
| --- | --- |
| `draft: true` | No public page or listing. |
| `draft: false`, `featured: true` | Appears in **Selected Work**. |
| `draft: false`, `showInProjects: true` | Appears in **Projects**. |
| `draft: false`, `showInVisualWork: true` | Appears on **Visual** and may appear in the Work overview preview; requires `video`. |
| `draft: false`, all listing flags `false`, `detail: true` | Direct page only, hidden from the Home and Work listings. |

The three listing flags are independent. Set multiple flags in the **same file** when a work belongs in more than one section: Wavy Pop Haze is both Selected Work and a Project, while Visit Norway’s *Inspired by Bergen* is both Selected Work and Visual Work. The Work overview shows Selected Work and Projects plus a small Visual preview. Sound includes listed music and sound projects, followed by music-related videos not already shown there; Visual shows every published entry with `showInVisualWork: true`. The homepage shows all Selected Work and avoids repeating those entries in its Projects section. Set `detail: false` for an image-led card without a page. With `draft: false` and `detail: true`, the filename becomes `/work/filename/`. `headphones.md` remains a draft. Use `collaborators`, `gallery` and `embeds` only when relevant.

For an expandable player, add `player` with `provider: spotify` or `provider: soundcloud` and an `embedUrl` copied from that platform's official embed iframe. See `lonely-city-beats.md` for SoundCloud, `hyuna.md` for a Spotify track, and `dreamlag.md` for a Spotify artist. The schema accepts only official HTTPS embed hosts and rejects autoplay. The iframe loads when a visitor opens the player and is removed when they close it. Spotify albums, playlists, and artists use the full player height; tracks use a shorter player. SoundCloud adapts to visual, playlist, or track embeds. Keep `links` for optional external streaming destinations. Without `player`, existing external Listen links remain unchanged.

### Add a visual work

Create one Markdown file in `src/content/projects/` and set `showInVisualWork: true`. The `video` field stores the official watch URL, provider, and video ID; the site builds an official YouTube or Vimeo iframe URL and inserts it only when a visitor clicks Play. The click requests autoplay. Browser or provider restrictions can still prevent playback, so the original watch URL stays visible beneath the player. Set `video.embed: false` when a provider refuses playback; the same thumbnail then opens the original watch URL directly. A local `cover` thumbnail is recommended and optimized by Astro, but the player has a text fallback if no thumbnail is available. Never download or rehost the video itself.

```yaml
showInVisualWork: true
visualOrder: 1
video:
  provider: youtube
  id: 2klhuvf4Tmk
  url: https://www.youtube.com/watch?v=2klhuvf4Tmk
```

Use `roles` for Andreas’s short contribution label. For exact shared credits, use `credits: [{ role: "Directed by", names: ["Person A", "Person B"] }]`; do not assign individual roles without a source. `relatedTo: [dreamlag]` links a visual entry to an existing project slug. Detail pages show related visual work automatically. `visualOrder` controls gallery order. A visual entry can also set `featured: true` when it belongs in Selected Work; it does not need a duplicate file or a new navigation page.

The separate `embeds` field remains available for additional click-to-load media on a detail page. Entries use `provider`, `id`, and `label`, plus an optional `poster` image. For an external link use `links: [{ label: "Listen", url: "https://..." }]`.

## Add images

Put photos or artwork in `src/assets/projects/` and reference them relative to the Markdown file, for example `../../assets/projects/my-work/cover.jpg`. Astro creates optimized WebP output. The three Kjærleik collaborations keep separate covers in `src/assets/projects/kjaerleik/lonely-city-beats/`, `dark-ocean-waves/`, and `wavy-pop-haze/`; each still has its own Markdown entry and URL. Official video thumbnail stills for Visual Work live in `src/assets/projects/visual/`; video files remain on YouTube and Vimeo. Small SVG art can go in `public/images/projects/` and be referenced as `/images/projects/filename.svg`. Always add descriptive `coverAlt` and gallery `alt` text. The Gjenferd SVG is **placeholder artwork**; Lonely City Beats, Wavy Pop Haze, Dark Ocean Waves, Dreamlag, and HyunA’s *Mirror* use supplied assets. The Kjærleik and delario logos remain in `src/assets/` but are not displayed. The About portrait is `src/assets/portraits/andreas_2.jpg`.

## Edit the biography and contact details

Edit the body of `src/content/pages/about.md` for the biography. Site-wide name, description, public email and social links are in `src/config/site.ts`. The email is used on the Contact page and footer. Add real social links to `social` when ready to publish them.

## Publish with GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on each push to `main`. Commit `package-lock.json` with any dependency changes. In the GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow automatically uses `https://OWNER.github.io/REPOSITORY/` for a normal project site, including the correct asset base path. Do not push to `main` until publishing is approved.

For a custom domain, set the domain in GitHub Pages repository settings, then set repository Actions variables `SITE_URL` to `https://your-domain.example` and `BASE_PATH` to `/`. GitHub ignores `CNAME` files when publishing through this custom Actions workflow. Configure DNS only after the domain is added in GitHub. For a user or organization root site (`OWNER.github.io`), set `SITE_URL` to that URL and `BASE_PATH` to `/`.

For a local build with a non-default URL, set `SITE_URL` and `BASE_PATH` in your shell before running `npm run build`. The default `https://example.com` is a development placeholder for canonical and sitemap URLs.

## Content still to add

- Any additional confirmed credits for *Dark Ocean Waves*.
- Confirmed individual contributions and any additional project context for *Lonely City Beats*.
- Any further confirmed credits or audio examples for Wavy Pop Haze.
- Approved artwork and more material for Gjenferd, if it gets a detail page.
- Release details, video and streaming links for the draft Headphones page.
- More context about Andreas’s creative timeline if the About biography should go further.
- Optional social profiles and additional verified projects.
