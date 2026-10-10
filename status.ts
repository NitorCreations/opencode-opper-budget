export const REFRESH_MS = 60_000
/** Stop polling after this many consecutive failures (until refocus or success). */
export const MAX_CONSECUTIVE_FAILURES = 3

/**
 * Decides whether a poll tick should perform a fetch.
 * Pure so it can be unit-tested.
 *
 * Policy:
 * - Blurred terminals never fetch; the label already shows "stale" and a
 *   fresh fetch runs on refocus.
 * - Non-opper models never fetch (the label renders empty for them anyway).
 * - After MAX_CONSECUTIVE_FAILURES failures, stop polling until a fetch is
 *   triggered again (focus event or success reset).
 */
export function shouldFetch(input: {
  focused: boolean
  providerID: string | undefined
  consecutiveFailures: number
}): boolean {
  if (!input.focused) return false
  if (input.providerID !== "opper") return false
  return input.consecutiveFailures < MAX_CONSECUTIVE_FAILURES
}

export type Spend = {
  currency: string
  limit_cents: number | null
  period_end: string
  period_start: string
  remaining_cents: number | null
  spent_cents: number
}

export type OpperMe = {
  blocked?: boolean
  block_reason?: string | null
  member_spend?: Spend | null
  visibility?: { organization_finance?: boolean }
}

export type Snapshot = {
  fetchedAt: number
  status: "ok" | "fetch-error" | "no-key"
  error?: string
  data: OpperMe | null
}

/** Formats integer cents as currency; null/undefined renders as an em dash. */
export function money(cents: number | null | undefined, currency?: string) {
  if (typeof cents !== "number") return "—"
  const symbol = currency === "usd" ? "$" : currency === "eur" ? "€" : currency === "gbp" ? "£" : `${currency ?? ""} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

/** Percent of budget spent, capped at 999; null when no usable limit. */
export function spendPercent(
  spent: number | undefined,
  limit: number | undefined,
): number | null {
  return typeof limit === "number" && limit > 0 && typeof spent === "number"
    ? Math.min(999, Math.round((spent / limit) * 100))
    : null
}

/**
 * Picks the active Opper API key from a credential list response.
 * The client returns the array directly in some versions and
 * `{ data: [...] }` in others; accept both.
 */
export function pickOpperKey(res: unknown): string | null {
  const data: any[] = Array.isArray(res) ? res : ((res as any)?.data ?? [])
  const match = data.find(
    (c: any) => c?.integrationID === "opper" && c?.active && c?.value?.type === "key",
  )
  return match?.value?.key ?? null
}

/** Pure status-line renderer; tui.tsx only supplies live inputs. */
export function buildLabel(input: {
  providerID?: string
  snapshot: Snapshot | null
  now?: number
}): string {
  const { providerID, snapshot } = input
  const now = input.now ?? Date.now()
  if (!providerID || providerID !== "opper") return ""

  const s = snapshot
  if (!s) return ""
  if (s.status === "no-key") return "opper ⚠ no api key (connect opper in opencode)"
  if (s.status === "fetch-error") return `opper ✗ (${s.error ?? "api error"})`

  const me = s.data ?? {}
  const member = me.member_spend

  const percent = spendPercent(member?.spent_cents, member?.limit_cents)

  const parts: string[] = []
  if (me.blocked) {
    parts.push(`BLOCKED${me.block_reason ? `: ${me.block_reason}` : ""}`)
  }
  parts.push(
    `${money(member?.spent_cents, member?.currency)}${
      typeof member?.limit_cents === "number" ? ` / ${money(member.limit_cents, member.currency)}` : ""
    }` + (percent !== null ? ` (${percent}%)` : ""),
  )
  if (typeof member?.remaining_cents === "number")
    parts.push(`${money(member.remaining_cents, member.currency)} left`)
  if (now - s.fetchedAt > REFRESH_MS * 3) parts.push("stale")

  return `opper ${parts.join(" · ")}`
}
