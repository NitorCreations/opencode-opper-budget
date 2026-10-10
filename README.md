# opper-budget

An [OpenCode](https://opencode.ai) plugin that shows your Opper spend in the
terminal's status bar, so you always know how much budget is left while you
work.

OpenCode is an AI coding agent that runs in your terminal. Opper is the AI
gateway that serves the models behind it. This plugin is a small CLI plugin
that polls Opper's usage API and renders a live status item in the prompt and
home footers, for example:

```
opper 🟢 $1.24 / $10.00 (12%) · $8.76 left · project $3.50
```

The status item only renders when the current model's provider is `opper`.
Traffic light thresholds: 🟢 under 70%, 🟡 70–90%, 🔴 over 90% of the budget,
plus a `BLOCKED` warning when the account is blocked and a `stale` marker when
the last fetch is more than three refresh cycles old.

## How it works

The plugin reads the Opper API key from `~/.opper/config.json`
(`keys.default.apiKey`, the file the Opper CLI writes) and calls
`GET https://api.opper.ai/v3/me` every 60 seconds. The response contains
`member_spend` and `project_spend` objects with `spent_cents`, `limit_cents`,
`remaining_cents`, and `currency` fields.

Nothing is stored anywhere: the key is only used to call Opper, and the
response is kept in memory. Uninstalling the plugin stops all requests.

## Install

Install from npm and add the package to your OpenCode config:

```sh
npm install opencode-opper-budget
```

```jsonc
// opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-opper-budget"]
}
```

Prefer not to use npm? Copy the two source files into your OpenCode plugin directory:

```sh
mkdir -p ~/.config/opencode/plugins/opper-budget
curl -o ~/.config/opencode/plugins/opper-budget/index.ts \
  https://raw.githubusercontent.com/NitorCreations/opencode-opper-budget/main/index.ts
curl -o ~/.config/opencode/plugins/opper-budget/tui.tsx \
  https://raw.githubusercontent.com/NitorCreations/opencode-opper-budget/main/tui.tsx
```

Alternatively, install the whole directory from this repo into any project's
`.opencode/plugins/opper-budget/`. OpenCode loads plugins from
`.opencode/plugins/` automatically; no config changes needed.

You need an Opper account with an API key already saved by the Opper CLI:

```sh
opper login
```

## Limitations

- Opper CLI state file: the plugin parses a private, undocumented file. An
  Opper CLI update could change its shape and break the plugin.
- The endpoint returns organization-wide spend, not per-session cost. It is
  the authoritative number to show, but it includes all Opper usage from all
  tools, not only OpenCode sessions.

## License

MIT
