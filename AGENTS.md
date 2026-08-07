# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

**Infinity MMO Extension** — a Manifest V3 browser extension (Chrome/Chromium
and Firefox) that adds an overlay to `infinitymmo.net`: live battle data, a
type calculator/chart, and a Party/PC viewer with filters, IVs, natures, and
catch-rate info. No build tooling, no npm/bundler, no dependencies — plain
HTML/CSS/JS loaded directly by the browser. User-facing docs (PT-BR) live in
[README.md](README.md); developer docs (architecture, interception,
DevTools, build/release) live in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
— read the latter before touching `interceptor.js`, `content.js`, or the
manifests/build scripts.

## Layout

| Path | Context | Role |
|---|---|---|
| `manifest.json` / `manifest.firefox.json` | — | Chrome vs Firefox MV3 manifests (kept in sync manually) |
| `background.js` | service worker | Injects overlay scripts on click/shortcut/page load; runs update/data-refresh alarms |
| `interceptor.js` | MAIN world | Hooks `window.fetch` to capture battle/character payloads |
| `content.js` | isolated world | Overlay shell, tabs, auto focus/blur logic |
| `index.html` / `app.js` | iframe | Type matchup calculator |
| `battle.html` / `battle.js` | iframe | Live encounter data |
| `chart.html` / `chart.js` | iframe | Full type effectiveness chart |
| `myPokemons.html` / `myPokemons.js` | iframe | Party/PC viewer, search, sort, filters |
| `components/` | shared | Reusable UI pieces (icons, tooltip, header/tabs, settings panel, type tags, filters, catch-rate, IV/nature/ability helpers) — full file table in DEVELOPMENT.md |
| `data/` | shared | Storage/persistence layer plus game data tables (species, moves, PokeAPI-derived move info) — full file table in DEVELOPMENT.md |
| `scripts/build-chrome.sh`, `scripts/build-firefox.sh` | — | Copy source files into `dist/<browser>/` and zip for distribution |
| `dist/` | generated | Build output, gitignored — never edit by hand |

## Conventions / critical rules

- **No build step for development.** Load unpacked from the repo root via
  `chrome://extensions` (Chrome) or `about:debugging` (Firefox, using
  `manifest.firefox.json`). Only run `scripts/build-*.sh` when actually
  producing a release zip.
- **Two manifests must stay in sync, manually.** Any change to permissions,
  `web_accessible_resources`, or file lists in `manifest.json` needs the
  equivalent change in `manifest.firefox.json` (which has Firefox-only
  fields: `background.scripts` instead of `service_worker`, and
  `browser_specific_settings`). If adding a new file that an iframe/script
  loads, also add it to the `FILES` array in **both**
  `scripts/build-chrome.sh` and `build-firefox.sh`.
- **`browser_specific_settings.gecko.id` (`ifinitymmo-helper@andaragui`) is
  intentional — do not "fix" it to match the new name.** Changing it makes
  Firefox treat the package as a different extension, and existing users
  lose their saved settings (`chrome.storage.local` is namespaced by
  extension id on Firefox).
- **Internal code identifiers keep their old names on purpose** —
  `pokemon-helper-*`/`pkmn-helper-*` globals/events and the
  `[Pokemon Helper]` console prefix predate the "Infinity MMO Extension"
  rename. Do not rename them in refactors.
- **`data.foe`/`data.party`/`data.pc` payloads are duck-typed, not routed by
  URL.** `content.js` decides overlay/tab behavior from payload shape, not
  the request URL. `state.over` is deliberately ignored inside `battle.js`
  (there's specific bug history behind that) — read the "Interceptação de
  dados" section of docs/DEVELOPMENT.md before changing anything in
  `interceptor.js` or `content.js`.
- **Do not bump the version in the manifests per commit.** Only bump it for
  actual releases — `background.js` uses that field to detect updates.
- Docs and commit messages are written in Portuguese; code identifiers are
  in English. Match existing style per file.
- No test suite or linter is configured — verify changes manually by
  loading the unpacked extension and exercising the relevant overlay tab.
  `infinitymmo.net` blocks normal DevTools (F12); see docs/DEVELOPMENT.md's
  "DevTools no infinitymmo.net" section for the workaround (open via the
  extension icon, undock the DevTools window, add the site to the ignore
  list).

## Also worth knowing

- `interceptor.js` captures `/character/` responses (party/PC sync) too,
  not just `/battle/` — see "Interceptação de dados" in DEVELOPMENT.md.
- Overlay injection loads `data/extension-storage.js` and the `components/`
  bundle (icons, tooltip, header buttons, shortcut utils, settings panel)
  into the isolated world *before* `content.js`, in a fixed dependency
  order; `interceptor.js` is injected separately into the MAIN world — see
  "Arquitetura" in DEVELOPMENT.md for the exact order.
- `background.js` also runs periodic remote checks via `chrome.alarms` (new
  version against the GitHub raw manifest, plus pokédex/abilities/trainer
  moves refreshed from `infinitymmo.net`) — see "Atualizações remotas" in
  DEVELOPMENT.md.
