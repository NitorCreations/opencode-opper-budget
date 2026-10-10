import { createSignal } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"

const REFRESH_MS = 60_000
const OPPER_API = "https://api.opper.ai/v3/me"

type Spend = {
  currency: string
  limit_cents: number | null
  period_end: string
  period_start: string
  remaining_cents: number | null
  spent_cents: number
}

type OpperMe = {
  blocked?: boolean
  block_reason?: string | null
  member_spend?: Spend | null
  project_spend?: Spend | null
  visibility?: { organization_finance?: boolean }
}

type Snapshot = {
  fetchedAt: number
  status: "ok" | "fetch-error" | "no-key"
  error?: string
  data: OpperMe | null
}

async function readApiKey(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises")
    const { homedir } = await import("node:os")
    const { join } = await import("node:path")
    const raw = await readFile(join(homedir(), ".opper", "config.json"), "utf8")
    const parsed = JSON.parse(raw) as { keys?: { default?: { apiKey?: string } } }
    return parsed?.keys?.default?.apiKey ?? null
  } catch {
    return null
  }
}

function money(cents: number | null | undefined, currency?: string) {
  if (typeof cents !== "number") return "—"
  const symbol = currency === "usd" ? "$" : currency === "eur" ? "€" : currency === "gbp" ? "£" : `${currency ?? ""} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

export default Plugin.define({
  id: "opper.budget",
  async setup(context) {
    const [snap, setSnap] = createSignal<Snapshot | null>(null)

    async function fetchSpend() {
      const apiKey = await readApiKey()
      if (!apiKey) {
        setSnap({ fetchedAt: Date.now(), status: "no-key", data: null })
        return
      }
      try {
        const res = await fetch(OPPER_API, { headers: { Authorization: `Bearer ${apiKey}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSnap({ fetchedAt: Date.now(), status: "ok", data: (await res.json()) as OpperMe })
      } catch (err) {
        setSnap((prev) => ({
          fetchedAt: Date.now(),
          status: "fetch-error",
          error: err instanceof Error ? err.message : String(err),
          data: prev?.data ?? null,
        }))
      }
    }

    void fetchSpend()
    const timer = setInterval(() => void fetchSpend(), REFRESH_MS)

    const render = () => <text>{label()}</text>

    const label = () => {
      const model = context.ui?.model?.current?.()
      if (!model || model.providerID !== "opper") return ""

      const s = snap()
      if (!s) return ""
      if (s.status === "no-key") return "opper ⚠ no ~/.opper/config.json api key (auth)"
      if (s.status === "fetch-error") return `opper ✗ (${s.error ?? "api error"})`

      const me = s.data ?? {}
      const member = me.member_spend
      const project = me.project_spend
      const spent = member?.spent_cents
      const limit = member?.limit_cents
      const remaining = member?.remaining_cents

      const percent =
        typeof limit === "number" && limit > 0 && typeof spent === "number"
          ? Math.min(999, Math.round((spent / limit) * 100))
          : null
      const marker = percent === null ? "" : percent >= 90 ? "🔴" : percent >= 70 ? "🟡" : "🟢"

      const parts: string[] = []
      if (me.blocked) {
        parts.push(`BLOCKED${me.block_reason ? `: ${me.block_reason}` : ""}`)
      }
      parts.push(
        `${money(spent, member?.currency)}${typeof limit === "number" ? ` / ${money(limit, member?.currency)}` : ""}` +
          (percent !== null ? ` (${percent}%)` : ""),
      )
      if (typeof remaining === "number") parts.push(`${money(remaining, member?.currency)} left`)
      if (project && typeof project.spent_cents === "number") {
        parts.push(`project ${money(project.spent_cents, project.currency)}`)
      }
      if (Date.now() - s.fetchedAt > REFRESH_MS * 3) parts.push("stale")

      return `opper ${marker} ${parts.join(" · ")}`
    }

    context.ui.slot({ append: "prompt.footer.status", render })
    context.ui.slot({ append: "home.footer.status", render })

    return () => clearInterval(timer)
  },
})
