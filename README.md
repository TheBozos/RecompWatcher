# Recomp Watcher

A PS2-style showcase for static recompilation projects, mine and friends': each game port and tool gets a
page with its README, who makes it, a link to its repository and, once a release is published, its downloads.

Built with [Astro](https://astro.build) (static pages, view transitions) and [three.js](https://threejs.org)
(the boot towers in the background). Arrow keys or a gamepad move around the menu; ✕/Enter opens,
○/Esc goes back, L1/R1 (Page Up/Down) flip between projects.

Also in English and French (`/fr/`), usable on phones and tablets, with a System Configuration page (sound,
startup screen, motion, background, clock), share cards for links, an RSS feed (`/feed.xml`) and NEW badges.

## How it works

- **Adding a project:** give its GitHub repo the `recomp-watcher` topic (repo page → About → ⚙ → Topics). Any
  public repo of the people listed in `DISCOVER.owners` with that topic appears on the next build; the title, region
  and serial come from the repo description (`Game (NTSC-U, SLUS-12345) …`) or the README's first line. Add the
  `recomp-tool` topic for tools. To hand-tune one (colour, icon letters, faces), give it an entry in `projects.ts`.
- The hand-written project list lives in [`src/data/projects.ts`](src/data/projects.ts): repo, title, icon letters, colour, serial.
  A project made by someone else sets `owner` to their GitHub handle; the site credits them (avatar and handle),
  and the Browser can show one person's games at a time.
- At build time [`src/lib/github.ts`](src/lib/github.ts) fetches from the GitHub API, for each repo:
  - the README as GitHub renders it (relative links and images are pointed back at the repo),
  - the `platform` and `status` badges and any screenshots it contains,
  - the latest release and its assets, which become the **Download** buttons (Windows / Linux / macOS
    are guessed from the file names).
- Interface text lives in [`src/i18n/index.ts`](src/i18n/index.ts) (English and French); project content stays as the
  repos write it.
- Want a download link before cutting a release? Add `downloads: [{ label, url, os }]` to the project in `projects.ts`.

## Develop

```bash
npm install
npm run dev
```

The build uses `GITHUB_TOKEN` if set, otherwise `gh auth token`, otherwise anonymous requests (60 per hour).
API responses are cached in `.cache/` for an hour outside CI.

## Deploy

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes to GitHub Pages on every
push to `main`, once a day, and on a `project-updated` repository dispatch. In the repo settings, set
**Pages → Source** to **GitHub Actions**.

To refresh the site as soon as a project publishes a release, add this step to that project's release workflow
(with a token that can dispatch to this repo):

```yaml
- run: gh api repos/TheBozos/RecompWatcher/dispatches -f event_type=project-updated
  env:
    GH_TOKEN: ${{ secrets.WATCHER_DISPATCH_TOKEN }}
```
