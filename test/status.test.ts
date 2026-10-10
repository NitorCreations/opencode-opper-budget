import { describe, expect, test } from "bun:test"
import {
  MAX_CONSECUTIVE_FAILURES,
  REFRESH_MS,
  buildLabel,
  money,
  pickOpperKey,
  shouldFetch,
  spendPercent,
  trafficLight,
} from "../status"

// ---------- money ----------

describe("money", () => {
  test("formats usd from integer cents", () => {
    expect(money(124, "usd")).toBe("$1.24")
  })

  test("supports eur and gbp symbols", () => {
    expect(money(1000, "eur")).toBe("€10.00")
    expect(money(50, "gbp")).toBe("£0.50")
  })

  test("unknown currency falls back to prefix form", () => {
    expect(money(200, "chf")).toBe("chf 2.00")
  })

  test("null and undefined render as em dash", () => {
    expect(money(null)).toBe("—")
    expect(money(undefined)).toBe("—")
  })

  test("negative amounts render with sign", () => {
    expect(money(-100, "usd")).toBe("$-1.00")
  })

  test("zero renders as zero", () => {
    expect(money(0, "usd")).toBe("$0.00")
  })
})

// ---------- spendPercent / trafficLight ----------

describe("spendPercent", () => {
  test("computes percentage of limit", () => {
    expect(spendPercent(150, 1000)).toBe(15)
  })

  test("caps at 999", () => {
    expect(spendPercent(999999, 10)).toBe(999)
  })

  test("returns null without a positive limit", () => {
    expect(spendPercent(100, undefined)).toBeNull()
    expect(spendPercent(100, 0)).toBeNull()
    expect(spendPercent(100, -5)).toBeNull()
  })

  test("returns null without a numeric spent", () => {
    expect(spendPercent(undefined, 1000)).toBeNull()
  })

  test("rounds to nearest integer", () => {
    expect(spendPercent(125, 1000)).toBe(13)
  })
})

describe("trafficLight", () => {
  test("green under 70", () => {
    expect(trafficLight(69)).toBe("🟢")
    expect(trafficLight(0)).toBe("🟢")
  })

  test("yellow at 70 and up to 89", () => {
    expect(trafficLight(70)).toBe("🟡")
    expect(trafficLight(89)).toBe("🟡")
  })

  test("red at and above 90", () => {
    expect(trafficLight(90)).toBe("🔴")
    expect(trafficLight(999)).toBe("🔴")
  })

  test("null percent means no marker", () => {
    expect(trafficLight(null)).toBe("")
  })
})

// ---------- pickOpperKey ----------

describe("pickOpperKey", () => {
  const key = { type: "key", key: "k".repeat(23) }

  test("accepts the array-direct response shape", () => {
    const res = [{ integrationID: "opper", active: true, value: key }]
    expect(pickOpperKey(res)).toBe(key.key)
  })

  test("accepts the wrapped { data: [...] } response shape", () => {
    const res = { data: [{ integrationID: "opper", active: true, value: key }] }
    expect(pickOpperKey(res)).toBe(key.key)
  })

  test("skips inactive or non-key or non-opper credentials", () => {
    const res = [
      { integrationID: "lyceum", active: true, value: key },
      { integrationID: "opper", active: false, value: key },
      { integrationID: "opper", active: true, value: { type: "oauth", access: "x" } },
    ]
    expect(pickOpperKey(res)).toBeNull()
  })

  test("picks the opper credential among many", () => {
    const res = [
      { integrationID: "lyceum", active: true, value: key },
      { integrationID: "opper", active: true, value: key },
    ]
    expect(pickOpperKey(res)).toBe(key.key)
  })

  test("returns null for null, undefined, and junk input", () => {
    expect(pickOpperKey(null)).toBeNull()
    expect(pickOpperKey(undefined)).toBeNull()
    expect(pickOpperKey({})).toBeNull()
    expect(pickOpperKey("nonsense")).toBeNull()
    expect(pickOpperKey(42)).toBeNull()
  })
})

// ---------- shouldFetch ----------

describe("shouldFetch", () => {
  const base = { focused: true, providerID: "opper" as const, consecutiveFailures: 0 }

  test("fetches when focused, opper, and healthy", () => {
    expect(shouldFetch(base)).toBe(true)
  })

  test("never fetches when blurred (polling paused)", () => {
    expect(shouldFetch({ ...base, focused: false })).toBe(false)
  })

  test("never fetches for non-opper providers", () => {
    expect(shouldFetch({ ...base, providerID: "anthropic" })).toBe(false)
    expect(shouldFetch({ ...base, providerID: undefined })).toBe(false)
  })

  test("stops after MAX_CONSECUTIVE_FAILURES failures", () => {
    expect(shouldFetch({ ...base, consecutiveFailures: MAX_CONSECUTIVE_FAILURES - 1 })).toBe(true)
    expect(shouldFetch({ ...base, consecutiveFailures: MAX_CONSECUTIVE_FAILURES })).toBe(false)
    expect(shouldFetch({ ...base, consecutiveFailures: MAX_CONSECUTIVE_FAILURES + 5 })).toBe(false)
  })

  test("failure stop applies regardless of focus or provider", () => {
    expect(shouldFetch({ ...base, focused: false, consecutiveFailures: 99 })).toBe(false)
    expect(shouldFetch({ ...base, providerID: "anthropic", consecutiveFailures: 99 })).toBe(false)
  })
})

// ---------- buildLabel ----------

const now = Date.now()

function okSnapshot(data: any, fetchedAt = now): any {
  return { fetchedAt, status: "ok", data }
}

const spend = (over: Partial<any> = {}) => ({
  currency: "usd",
  limit_cents: 1000,
  period_end: "",
  period_start: "",
  remaining_cents: 876,
  spent_cents: 124,
  ...over,
})

describe("buildLabel", () => {
  test("empty for non-opper provider or missing model", () => {
    const snap = okSnapshot({ member_spend: spend() })
    expect(buildLabel({ providerID: "anthropic", snapshot: snap })).toBe("")
    expect(buildLabel({ snapshot: snap })).toBe("")
  })

  test("empty before first snapshot", () => {
    expect(buildLabel({ providerID: "opper", snapshot: null })).toBe("")
  })

  test("no-key message", () => {
    expect(
      buildLabel({ providerID: "opper", snapshot: { fetchedAt: now, status: "no-key", data: null } }),
    ).toBe("opper ⚠ no api key (connect opper in opencode)")
  })

  test("fetch-error message includes error text", () => {
    expect(
      buildLabel({
        providerID: "opper",
        snapshot: { fetchedAt: now, status: "fetch-error", error: "HTTP 500", data: null },
      }),
    ).toBe("opper ✗ (HTTP 500)")
  })

  test("render full happy path", () => {
    expect(
      buildLabel({
        providerID: "opper",
        snapshot: okSnapshot({ member_spend: spend(), project_spend: spend({ spent_cents: 350 }) }),
      }),
    ).toBe("opper 🟢 $1.24 / $10.00 (12%) · $8.76 left · project $3.50")
  })

  test("omits limit segment when limit is unset", () => {
    expect(
      buildLabel({
        providerID: "opper",
        snapshot: okSnapshot({
          member_spend: spend({ limit_cents: null, remaining_cents: null }),
        }),
      }),
    ).toBe("opper $1.24")
  })

  test("no double space when no marker (unset limit)", () => {
    expect(
      buildLabel({
        providerID: "opper",
        snapshot: okSnapshot({
          member_spend: spend({ limit_cents: null, remaining_cents: null }),
        }),
      }).startsWith("opper  "),
    ).toBe(false)
  })

  test("shows BLOCKED with reason before amounts", () => {
    const label = buildLabel({
      providerID: "opper",
      snapshot: okSnapshot({
        blocked: true,
        block_reason: "credit exhausted",
        member_spend: spend(),
      }),
    })
    expect(label).toContain("BLOCKED: credit exhausted")
    expect(label).toContain("$1.24 / $10.00 (12%)")
  })

  test("traffic light thresholds in the rendered line", () => {
    const mk = (spent: number) =>
      buildLabel({
        providerID: "opper",
        snapshot: okSnapshot({
          member_spend: spend({ spent_cents: spent, remaining_cents: 1000 - spent }),
        }),
      })
    expect(mk(100).includes("🟢")).toBe(true)
    expect(mk(750).includes("🟡")).toBe(true)
    expect(mk(950).includes("🔴")).toBe(true)
  })

  test("stale marker after three refresh cycles", () => {
    const data = { member_spend: spend() }
    // strict inequality: exactly 3 cycles is not yet stale
    expect(
      buildLabel({ providerID: "opper", snapshot: okSnapshot(data), now: now + REFRESH_MS * 3 - 1 }).includes("stale"),
    ).toBe(false)
    expect(
      buildLabel({ providerID: "opper", snapshot: okSnapshot(data), now: now + REFRESH_MS * 3 + 1 }).includes("stale"),
    ).toBe(true)
  })

  test("keeps previous amounts out of fetch-error rendering", () => {
    // fetch-error uses its own message and never renders stale data
    expect(
      buildLabel({
        providerID: "opper",
        snapshot: { fetchedAt: now, status: "fetch-error", error: "x", data: okSnapshot({ member_spend: spend() }).data },
      }),
    ).toBe("opper ✗ (x)")
  })

  test("null member_spend renders em dash without limit/percent", () => {
    expect(buildLabel({ providerID: "opper", snapshot: okSnapshot({ member_spend: null }) })).toBe(
      "opper —",
    )
  })

  test("percent capped at 999 in rendered output", () => {
    const label = buildLabel({
      providerID: "opper",
      snapshot: okSnapshot({ member_spend: spend({ spent_cents: 999999, remaining_cents: 0 }) }),
    })
    expect(label).toContain("(999%)")
  })
})
