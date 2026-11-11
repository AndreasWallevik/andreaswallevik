# Andreas Wallevik portfolio

A small static portfolio built with Astro. Projects and the biography live in Markdown files. The published site is intended for GitHub Pages; no service or database is needed.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm run dev
```

Open the local URL Astro prints. Run `npm run check` and `npm run build` before publishing. `npm run preview` serves the built site.

Check YouTube and Vimeo playback in a regular browser window. VS Code's embedded browser can restrict video playback even when the same local page works in Edge. If automated browser testing needs a separate profile, create it under the operating system's temporary directory, outside this repository.

## Add or edit a project

Create one Markdown file per song, album, film, or creative work, such as `src/content/projects/my-work.md`. Keep the Markdown files in this flat directory; **Selected Work**, **Projects**, and **Visual Work** are listing choices, not content folders. Copy `wavy-pop-haze.md` for a detailed music entry, `gjenferd.md` for an image-led card, or `dreamlag-timelapse.md` for a video. Valid categories are `music`, `film-visuals`, `sound-for-visuals` and `experiments`. Categories describe the medium; they do not control placement.

For every published entry, provide `title` and `categories`, plus either `cover` with `coverAlt` or a `video`. Add `artistOrClient`, `subtitle`, `roles`, `collaborators`, `credits`, `status`, `description`, `year`, `releaseDate`, and `links` when known. `collaborators` is a list of names shown in the project detail metadata, for example `collaborators: [Kjærleik]`. `credits` groups exact roles and names. `status` displays a small note on cards, as with Gjenferd. Links appear on cards and detail pages. The Markdown body provides detail-page copy. Leave unconfirmed credits and dates out rather than guessing.

### Visibility

New entries default to `draft: true`. Set the flags explicitly when the work is ready:

| Frontmatter | Result |
| --- | --- |
| `draft: true` | No public page or listing. |
| `draft: false`, `featured: true` | Appears in **Selected Work**. |
| `draft: false`, `showInProjects: true` | Appears in **Projects**. |
| `draft: false`, `showInVisualWork: true` | Appears in **Visual Work** on the Work page; requires `video`. |
| `draft: false`, all listing flags `false`, `detail: true` | Direct page only, hidden from the Home and Work listings. |

The three listing flags are independent. Set multiple flags in the **same file** when a work belongs in more than one section: Wavy Pop Haze is both Selected Work and a Project, while Visit Norway’s *Inspired by Bergen* is both Selected Work and Visual Work. The Work page shows entries in every enabled section. The homepage shows all Selected Work and avoids repeating those entries in its Projects section. Set `detail: false` for an image-led card without a page. With `draft: false` and `detail: true`, the filename becomes `/work/filename/`. `headphones.md` remains a draft. Use `collaborators`, `gallery` and `embeds` only when relevant.

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
