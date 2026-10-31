# Recomp Watcher

A PS2-style showcase for my static recompilation projects: each game port and tool gets a page with
its README, a link to its repository and, once a release is published, its downloads.

Built with [Astro](https://astro.build) (static pages, view transitions) and [three.js](https://threejs.org)
(the boot towers in the background). Arrow keys or a gamepad move around the menu; ✕/Enter opens,
○/Esc goes back, L1/R1 (Page Up/Down) flip between projects.

## How it works

- The project list lives in [`src/data/projects.ts`](src/data/projects.ts): repo, title, icon letters, colour, serial.
- At build time [`src/lib/github.ts`](src/lib/github.ts) fetches from the GitHub API, for each repo:
  - the README as GitHub renders it (relative links and images are pointed back at the repo),
  - the `platform` and `status` badges and any screenshots it contains,
  - the latest release and its assets, which become the **Download** buttons (Windows / Linux / macOS
    are guessed from the file names).
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
- run: gh api repos/boubou666/RecompWatcher/dispatches -f event_type=project-updated
  env:
    GH_TOKEN: ${{ secrets.WATCHER_DISPATCH_TOKEN }}
```
