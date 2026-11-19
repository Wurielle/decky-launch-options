import { parsePreset, storeKey } from "./model"
import type { AppPreset } from "./model"
import type { SavedStore } from "../recipe-store/store"

export type PresetFetcher = (
  url: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>
export interface PresetDiscovery {
  presets: AppPreset[]
  errors: string[]
}

let activeRequests = 0
const waiting: (() => void)[] = []

// Decky's fetch bridge may finish after cancellation. Retain its slot until it
// actually settles, but never parse or publish its stale result.
export async function fetchPresetResource(
  url: string,
  fetcher: PresetFetcher,
  signal: AbortSignal,
) {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", abort)
      activeRequests++
      resolve()
    }
    const abort = () => {
      const index = waiting.indexOf(start)
      if (index !== -1) waiting.splice(index, 1)
      reject(signal.reason)
    }
    if (activeRequests < 4) start()
    else {
      waiting.push(start)
      signal.addEventListener("abort", abort, { once: true })
    }
  })
  try {
    signal.throwIfAborted()
    const response = await fetcher(url, {
      cache: "no-store",
      credentials: "omit",
    })
    signal.throwIfAborted()
    return response
  } finally {
    activeRequests--
    waiting.shift()?.()
  }
}

export function presetHttpError(status: number): Error {
  return new Error(
    status === 403 || status === 429
      ? `GitHub rate limit or permission error (HTTP ${status}). Try again later or check the store's visibility.`
      : `Could not download presets (HTTP ${status}).`,
  )
}

export function presetQueryOptions(
  store: SavedStore,
  appid: string,
  fetcher: PresetFetcher,
) {
  return {
    queryKey: ["app-presets", storeKey(store), appid],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false as const,
    queryFn: async ({
      signal,
    }: {
      signal: AbortSignal
    }): Promise<PresetDiscovery> => {
      signal.throwIfAborted()
      const repository = store.store.github.repository
        .split("/")
        .map(encodeURIComponent)
        .join("/")
      const branch = encodeURIComponent(store.store.github.branch)
      const directory = `presets/steam/${appid}`
      const response = await fetchPresetResource(
        `https://api.github.com/repos/${repository}/contents/${directory}?ref=${branch}`,
        fetcher,
        signal,
      )
      if (response.status === 404) return { presets: [], errors: [] }
      if (!response.ok) throw presetHttpError(response.status)
      const entries: unknown = await response.json()
      if (!Array.isArray(entries))
        throw new Error("Invalid preset directory listing.")
      const presets: AppPreset[] = []
      const errors: string[] = []
      const names = new Set<string>()
      for (const entry of entries) {
        if (
          entry?.type !== "file" ||
          typeof entry.name !== "string" ||
          !entry.name.endsWith(".json")
        )
          continue
        try {
          if (names.has(entry.name) || /[/\\]/.test(entry.name))
            throw new Error(
              `Invalid or duplicate preset filename: ${entry.name}.`,
            )
          names.add(entry.name)
          const file = await fetchPresetResource(
            `https://raw.githubusercontent.com/${repository}/refs/heads/${branch}/${directory}/${encodeURIComponent(entry.name)}`,
            fetcher,
            signal,
          )
          if (!file.ok) throw presetHttpError(file.status)
          presets.push(parsePreset(await file.json(), entry.name, store, appid))
        } catch (error) {
          signal.throwIfAborted()
          errors.push(
            `${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
      signal.throwIfAborted()
      return { presets, errors }
    },
  }
}
