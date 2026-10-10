/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { buildLabel, pickOpperKey, REFRESH_MS, type Snapshot } from "./status"

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

    async function fetchSpend() {
      const apiKey = await readApiKey()
      if (!apiKey) {
        setSnap({ fetchedAt: Date.now(), status: "no-key", data: null })
        return
      }
      try {
        const res = await fetch(OPPER_API, { headers: { Authorization: `Bearer ${apiKey}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSnap({ fetchedAt: Date.now(), status: "ok", data: (await res.json()) as Snapshot["data"] })
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

    const label = () =>
      buildLabel({
        providerID: context.ui?.model?.current?.()?.providerID,
        snapshot: snap(),
      })

    context.ui.slot({ append: "prompt.footer.status", render })
    context.ui.slot({ append: "home.footer.status", render })

    return () => clearInterval(timer)
  },
})
