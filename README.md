# opencode-opper-budget

An [OpenCode](https://opencode.ai) plugin that shows your Opper spend in the
terminal's status bar, so you always know how much budget is left while you
work.

OpenCode is an AI coding agent that runs in your terminal. Opper is the AI
gateway that serves the models behind it. The plugin renders a live status
item in the prompt and home footers, for example:

```
opper $1.24 / $10.00 (12%) · $8.76 left
```

When the account is blocked, the status item shows `BLOCKED` with the
reason.

## How it works

The plugin reads the Opper API key from OpenCode's own credential store
(the credential for the `opper` integration, which OpenCode uses for model
calls) and calls `GET https://api.opper.ai/v3/me` every 60 seconds while
the terminal is focused and an Opper model is selected. Polling pauses when
the terminal loses focus or after repeated failed requests, and resumes
with an immediate refresh on refocus. The response contains a
`member_spend` object with `spent_cents`, `limit_cents`, `remaining_cents`,
and `currency` fields. Only the personal budget is displayed; project-level
spend is ignored.

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

You need an Opper account whose API key is configured as a provider
credential in OpenCode (this is what OpenCode uses for model calls, so if
you are already using Opper models, you are set).

## Limitations

- The endpoint returns organization-wide member spend, not per-session cost.
  It is the authoritative personal budget number to show, but it includes
  all Opper usage from all tools, not only OpenCode sessions.

## License

MIT
