# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

A single OpenCode CLI plugin that renders an Opper spend status line. Two
source files, no build step, no test suite. Keep it that way unless there is a
good reason.

## Files

- `index.ts` — server-side plugin entry, currently an empty `Plugin.define`
  with the `opper.budget` id. It exists so the plugin package has a main
  entrypoint (required for auto-loading; the TUI part is exported separately).
- `tui.tsx` — the CLI plugin that does all the work: reads the Opper API key
  from `~/.opper/config.json`, polls `https://api.opper.ai/v3/me` every 60 s,
  and renders a footer status slot with spend, percentage, and traffic-light
  marker.
- `package.json` — declares the plugin's id/name, entrypoints (`.` and
  `./tui`), and its `@opencode/plugin` dependency. Published to npm as
  `opencode-opper-budget`; install with `npm install opencode-opper-budget`.

## Conventions

- **Keep it minimal.** No framework, no state management, no extra deps beyond
  `@opencode/plugin` and the Solid `createSignal` already used.
- **Solid reactivity**: snapshot state lives in a `createSignal` inside
  `setup`; `label()` reads it reactively so slot renders stay current.
- **Money math**: cents are integers; `money()` is the only place that formats
  currency. Percentages are capped at 999. Traffic light: >=90 red, >=70
  yellow, otherwise green; `null` percent means no limit is set.
- **Failing silently-ish**: an error at setup, a missing key, or a failed
  fetch must not crash the TUI. Log or surface the failure in the status line,
  never throw from `render` or `label`.
- **One fetch loop**: a single `setInterval` started in `setup`, cleared by
  the returned cleanup function. Do not add more timers or fetches without
  removing one.
- **Secrets**: never commit real API keys. The key comes from
  `~/.opper/config.json` at runtime; do not add a config option that would
  inline a key into the repo.
- **OpenCode APIs**: changes to `Plugin.define`, `context.ui.slot`, slot names
  like `prompt.footer.status`/`home.footer.status`, or the `/v3/me` response
  shape are the likely breakage sources. Verify against the current
  [plugin docs](https://opencode.ai/v2/docs/build/plugins) before changing
  them. SLOT names are commented in `tui.tsx` for the same reason.

## Committing

- Commit small and frequently; messages are one line, imperative, no prefix
  conventions to follow.
- Before committing, double-check `git status` and `git diff --staged` for
  credentials or secrets (including the `~/.opper/config.json` path with a
  real key inside).
