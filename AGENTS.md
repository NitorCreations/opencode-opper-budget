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
  from OpenCode's credential store, polls `https://api.opper.ai/v3/me`
  every 60 s, and renders a footer status slot with spend, percentage, and
  traffic-light marker.
- `package.json` — declares the plugin's id/name, entrypoints (`.` and
  `./tui`), and its `@opencode/plugin` dependency. Published to npm as
  `opencode-opper-budget`; install with `opencode plugin add
  opencode-opper-budget`.

## Conventions

- **Keep it minimal.** No framework, no state management, no extra deps beyond
  `@opencode/plugin` and the Solid `createSignal` already used.
- **Solid reactivity**: snapshot state lives in a `createSignal` inside
  `setup`; `label()` reads it reactively so slot renders stay current.
- **JSX pragma**: `tui.tsx` must begin with
  `/** @jsxImportSource @opentui/solid */`. Without it, OpenCode transpiles
  the file with the React JSX runtime and plugin loading fails with
  `Cannot find package 'react'` for npm-installed copies.
- **Money math**: cents are integers; `money()` is the only place that formats
  currency. Percentages are capped at 999. Traffic light: >=90 red, >=70
  yellow, otherwise green; `null` percent means no limit is set.
- **Failing silently-ish**: an error at setup, a missing key, or a failed
  fetch must not crash the TUI. Log or surface the failure in the status line,
  never throw from `render` or `label`.
- **Key source**: the Opper key comes exclusively from OpenCode's credential
  store (`context.client.credential.list()`, filter `integrationID ===
  "opper"`, key type, active). Do not read other tools' config files. The
  key is never logged or rendered.
- **One fetch loop**: a single `setInterval` started in `setup`, cleared by
  the returned cleanup function. Do not add more timers or fetches without
  removing one.
- **Secrets**: never commit real API keys. The key comes from OpenCode's
  credential store at runtime; do not add a config option that would inline
  a key into the repo.
- **OpenCode APIs**: changes to `Plugin.define`, `context.ui.slot`, slot names
  like `prompt.footer.status`/`home.footer.status`, or the `/v3/me` response
  shape are the likely breakage sources. Verify against the current
  [plugin docs](https://opencode.ai/v2/docs/build/plugins) before changing
  them. SLOT names are commented in `tui.tsx` for the same reason.

## Testing

No automated test suite. Verify changes manually against a running OpenCode:

- **Scratch project**: copy the plugin sources into a throwaway directory's
  `.opencode/plugins/<name>/` (or test the npm flow with
  `opencode plugin add <pkg>`). Never test in a project you care about.
- **Headless load check**: `opencode debug agents` from the scratch
  directory must exit 0. This exercises server-side loading only — the TUI
  plugin's `setup` does not run headless.
- **TUI load check**: the TUI does not start headless. Wrap a short run in a
  pseudo-TTY instead, e.g. `timeout 30 script -q /dev/null opencode` from
  the scratch directory. This exercises TSX transpiling, slot registration,
  and TUI-only APIs such as `context.client.credential.list()`.
- **Failure signals**: check `~/.local/share/opencode/log/opencode.log` for
  `plugin operation failed` and `Cannot find package`. Beware: your own
  grep/shell commands are logged too — filter for the real message lines
  (`grep -v "spawning process"`), don't match on your command text.
- **Probing plugin APIs**: to explore context APIs without exposing secrets,
  use a temporary probe plugin that writes shapes only — strings as
  `len:<n>`, key/token/secret fields masked — to a JSON file in `~/.cache/`,
  then read it after a run. Delete the probe file afterwards. Never write
  real key values to disk or logs.
- **Packaging**: `npm pack --dry-run` must list exactly `index.ts`,
  `tui.tsx`, `README.md`, and `package.json`.
- **Test through the npm path, not only local copies**: some failure modes
  only appear for npm-installed plugins (see the JSX pragma convention — the
  same file loaded fine locally and failed from the npm cache).

## Committing

- Commit small and frequently; messages are one line, imperative, no prefix
  conventions to follow.
- Before committing, double-check `git status` and `git diff --staged` for
  credentials or secrets (including anything referencing a real key value).
