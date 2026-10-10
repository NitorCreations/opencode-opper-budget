/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import {
  buildLabel,
  MAX_CONSECUTIVE_FAILURES,
  pickOpperKey,
  REFRESH_MS,
  shouldFetch,
  type Snapshot,
} from "./status"

const OPPER_API = "https://api.opper.ai/v3/me"

export default Plugin.define({
  id: "opper.budget",
  async setup(context) {
    const [snap, setSnap] = createSignal<Snapshot | null>(null)

    const readApiKey = async (): Promise<string | null> => {
      try {
        const res = await (context.client as any).credential.list()
        return pickOpperKey(res)
      } catch {
        return null
      }
    }

    // Poll-state: focus comes from the renderer's focus/blur events and is
    // kept outside the signal to avoid re-render churn.
    let focused = true
    let consecutiveFailures = 0
    let timer: ReturnType<typeof setInterval> | null = null

    const currentProviderID = () =>
      (context.ui?.model?.current?.() as any)?.providerID

    async function fetchSpend() {
      if (!shouldFetch({
        focused,
        providerID: currentProviderID(),
        consecutiveFailures,
      })) {
        return
      }
      const apiKey = await readApiKey()
      if (!apiKey) {
        setSnap({ fetchedAt: Date.now(), status: "no-key", data: null })
        return
      }
      try {
        const res = await fetch(OPPER_API, { headers: { Authorization: `Bearer ${apiKey}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        consecutiveFailures = 0
        setSnap({ fetchedAt: Date.now(), status: "ok", data: (await res.json()) as Snapshot["data"] })
      } catch (err) {
        consecutiveFailures++
        setSnap((prev) => ({
          fetchedAt: Date.now(),
          status: "fetch-error",
          error: err instanceof Error ? err.message : String(err),
          data: prev?.data ?? null,
        }))
      }
    }

    // Single fetch loop (AGENTS.md rule): one setInterval, stopped on blur,
    // restarted on focus with an immediate fetch for a fresh marker.
    const start = () => {
      if (timer !== null) return
      void fetchSpend()
      timer = setInterval(() => void fetchSpend(), REFRESH_MS)
    }
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }

    const onFocus = () => {
      focused = true
      consecutiveFailures = 0
      start()
    }
    const onBlur = () => {
      focused = false
      stop()
    }

    context.renderer.on("focus", onFocus)
    context.renderer.on("blur", onBlur)

    // The renderer starts focused; begin polling.
    start()

    const render = () => <text>{label()}</text>

    const label = () =>
      buildLabel({
        providerID: currentProviderID(),
        snapshot: snap(),
      })

    context.ui.slot({ append: "prompt.footer.status", render })
    context.ui.slot({ append: "home.footer.status", render })

    return () => {
      stop()
      context.renderer.off("focus", onFocus)
      context.renderer.off("blur", onBlur)
    }
  },
})
