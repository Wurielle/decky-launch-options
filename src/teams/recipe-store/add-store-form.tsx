import { fetchNoCors, toaster } from "@decky/api"
import { DialogButton, Field, Focusable, TextField } from "@decky/ui"
import { useEffect, useRef, useState } from "react"
import { parseStore, saveStore } from "./store"
import { readClipboardText } from "../../utils/clipboard"

export function AddStoreForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [error, setError] = useState("")
  const formRef = useRef<HTMLDivElement>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  const paste = async () => {
    if (!formRef.current) return
    setPasting(true)
    setError("")
    try {
      const text = (await readClipboardText(formRef.current)).trim()
      if (!active.current) return
      if (!text) throw new Error("Clipboard is empty.")
      setUrl(text)
    } catch (failure) {
      if (active.current)
        setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      if (active.current) setPasting(false)
    }
  }

  const add = async () => {
    setBusy(true)
    setError("")
    try {
      const source = new URL(url.trim())
      if (!["http:", "https:"].includes(source.protocol)) {
        throw new Error("Enter an HTTP or HTTPS URL to a store JSON file.")
      }
      const response = await fetchNoCors(source.href)
      if (!response.ok)
        throw new Error(`Could not download store (HTTP ${response.status}).`)
      const store = parseStore(await response.json())
      if (!active.current) return
      saveStore(source.href, store)
      toaster.toast({ title: "Store added", body: store.name })
      onAdded()
    } catch (failure) {
      if (active.current)
        setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      if (active.current) setBusy(false)
    }
  }

  return (
    <div
      ref={formRef}
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Focusable>
          <Field label="Store URL" childrenLayout="below">
            <TextField
              aria-label="Store URL"
              style={{ width: "100%" }}
              value={url}
              disabled={busy || pasting}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
        </Focusable>
        <DialogButton disabled={busy || pasting} onClick={paste}>
          {pasting ? "Reading clipboard…" : "Paste from clipboard"}
        </DialogButton>
      </Focusable>
      {error && <div role="alert">{error}</div>}
      <DialogButton
        style={{ flex: 1 }}
        disabled={busy || pasting || !url.trim()}
        onClick={add}
      >
        {busy ? "Adding store…" : "Add store"}
      </DialogButton>
    </div>
  )
}
