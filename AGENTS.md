# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

**InfinityMMO Helper** — a Manifest V3 browser extension (Chrome/Chromium
and Firefox) that adds an overlay to `infinitymmo.net`. It provides a type
calculator/chart, live battle data, and a Party/PC viewer with filters, IVs,
natures, and catch-rate info. No build tooling, no npm/bundler, no
dependencies — plain HTML/CSS/JS loaded directly by the browser. Full
user-facing docs (in Portuguese) live in [README.md](README.md); read it for
architecture details on the fetch interceptor and overlay tab-focus logic
before touching `interceptor.js` or `content.js`.

## Layout

| Path | Context | Role |
|---|---|---|
| `manifest.json` / `manifest.firefox.json` | — | Chrome vs Firefox MV3 manifests (kept in sync manually; Firefox needs `background.scripts` instead of `service_worker` and `browser_specific_settings`) |
| `background.js` | service worker | Injects `content.js` + `interceptor.js` on click/shortcut/page load for `infinitymmo.net` |
| `interceptor.js` | MAIN world | Hooks `window.fetch` to capture battle payloads |
| `content.js` | isolated world | Overlay shell, tabs, auto focus/blur logic |
| `index.html` / `app.js` | iframe | Type matchup calculator |
| `battle.html` / `battle.js` | iframe | Live encounter data |
| `chart.html` / `chart.js` | iframe | Full type effectiveness chart |
| `myPokemons.html` / `myPokemons.js` | iframe | Party/PC viewer, search, sort, filters |
| `components/` | shared | Reusable UI pieces (type tags, nature/ability info, catch-rate calc, filters) |
| `data/` | shared | `constants.js` (game data tables) and `extension-storage.js` (settings persistence) |
| `scripts/build-chrome.sh`, `scripts/build-firefox.sh` | — | Copy source files into `dist/<browser>/` and zip for distribution |
| `dist/` | generated | Build output, gitignored — never edit by hand |

## Conventions

- **No build step for development.** Load unpacked from the repo root via
  `chrome://extensions` (dev mode → "Load unpacked"). Only run
  `scripts/build-*.sh` when actually producing a release zip.
- **Two manifests must stay in sync.** Any change to permissions,
  `web_accessible_resources`, or file lists in `manifest.json` needs the
  equivalent change in `manifest.firefox.json`, respecting the
  Firefox-specific fields (`background.scripts`, `browser_specific_settings`).
  If adding a new file that iframes/scripts load, also add it to the
  `FILES` array in both `scripts/build-chrome.sh` and `build-firefox.sh`.
- **`data.foe`/`data.party`/`data.pc` are duck-typed, not routed by URL.**
  `content.js` decides overlay/tab behavior from payload shape, not the
  request URL — see the "Interceptação" section of README.md before
  changing this logic; there's specific history behind why `state.over` is
  intentionally ignored in `battle.js`.
- **Do not bump the version in `manifest.json` per commit.** Only bump it
  for actual releases, not routine edits (see repo memory /
  `feedback_bump_extension_version.md`).
- Comments and docs in this repo (README, commit messages) are written in
  Portuguese; code identifiers are in English. Match existing style per file.
- No test suite or linter is configured — verify changes manually by loading
  the unpacked extension and exercising the relevant overlay tab (see
  README's "DevTools" section for how to inspect each context, since
  `infinitymmo.net` blocks normal F12).
