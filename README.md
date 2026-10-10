# opencode-opper-budget

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

The plugin reads the Opper API key from OpenCode's own credential store
(the credential for the `opper` integration, which OpenCode uses for model
calls). If OpenCode has no Opper credential, it falls back to the Opper CLI
state file `~/.opper/config.json` (`keys.default.apiKey`). It then calls
`GET https://api.opper.ai/v3/me` every 60 seconds. The response contains
`member_spend` and `project_spend` objects with `spent_cents`, `limit_cents`,
`remaining_cents`, and `currency` fields.

Nothing is stored anywhere: the key is only used to call Opper, and the
response is kept in memory. Uninstalling the plugin stops all requests.

## Install

Install the plugin with the OpenCode CLI:

```sh
opencode plugin add opencode-opper-budget
```

Updates are handled the same way:

```sh
opencode plugin update opencode-opper-budget
```

You need an Opper account with an API key already saved by the Opper CLI:

```sh
opper login
```

## Limitations

- Opper CLI state file: the fallback path parses a private, undocumented
  file. An Opper CLI update could change its shape and break that fallback.
- The endpoint returns organization-wide spend, not per-session cost. It is
  the authoritative number to show, but it includes all Opper usage from all
  tools, not only OpenCode sessions.

## License

MIT
