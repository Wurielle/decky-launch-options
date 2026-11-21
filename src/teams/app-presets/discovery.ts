import { parsePresetDefinition, storeKey } from "./model"
import type { PresetDefinition } from "./model"
import type { SavedStore } from "../recipe-store/store"
import type { QueryClient } from "@tanstack/react-query"

export type PresetFetcher = (
  url: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>
export interface PresetDiscovery {
  presets: PresetDefinition[]
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

export function downloadHttpError(
  status: number,
  resource: "presets" | "recipes",
): Error {
  return new Error(
    status === 403 || status === 429
      ? `GitHub rate limit or permission error (HTTP ${status}).\nTry again later or check the store's visibility.`
      : `Could not download ${resource} (HTTP ${status}).`,
  )
}

export function presetQueryOptions(
  store: SavedStore,
  sourceAppid: string,
  fetcher: PresetFetcher,
) {
  const global = sourceAppid === "*"
  const queryKey = ["app-presets", storeKey(store), sourceAppid]
  return {
    queryKey,
    staleTime: 5 * 60_000,
    gcTime: Infinity,
    retry: false as const,
    retryOnMount: true,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async (context: {
      signal: AbortSignal
      client?: QueryClient
    }): Promise<PresetDiscovery> => {
      // Global discovery belongs to the store, so let it finish and populate the
      // shared cache even if navigation temporarily removes its last observer.
      // Reading context.signal would opt into TanStack's unmount cancellation.
      const signal = global ? new AbortController().signal : context.signal
      const previous = context.client?.getQueryData<PresetDiscovery>(queryKey)
      signal.throwIfAborted()
      const repository = store.store.github.repository
        .split("/")
        .map(encodeURIComponent)
        .join("/")
      const branch = encodeURIComponent(store.store.github.branch)
      const scope = global ? "%2A" : encodeURIComponent(sourceAppid)
      const directory = `presets/steam/${scope}`
      const response = await fetchPresetResource(
        `https://api.github.com/repos/${repository}/contents/${directory}?ref=${branch}`,
        fetcher,
        signal,
      )
      if (response.status === 404) return { presets: [], errors: [] }
      if (!response.ok) throw downloadHttpError(response.status, "presets")
      let entries: unknown
      try {
        entries = await response.json()
      } catch {
        signal.throwIfAborted()
        return { presets: [], errors: [] }
      }
      if (!Array.isArray(entries)) return { presets: [], errors: [] }
      const names = new Set<string>()
      const files = entries.filter((entry) => {
        if (
          entry?.type !== "file" ||
          typeof entry.name !== "string" ||
          !entry.name.endsWith(".json") ||
          names.has(entry.name) ||
          /[/\\]/.test(entry.name)
        )
          return false
        names.add(entry.name)
        return true
      })
      const results = await Promise.all(
        files.map(async (entry): Promise<PresetDiscovery> => {
          let file: Awaited<ReturnType<typeof fetchPresetResource>>
          try {
            file = await fetchPresetResource(
              `https://raw.githubusercontent.com/${repository}/refs/heads/${branch}/${directory}/${encodeURIComponent(entry.name)}`,
              fetcher,
              signal,
            )
            if (!file.ok) throw downloadHttpError(file.status, "presets")
          } catch (error) {
            signal.throwIfAborted()
            return {
              presets:
                previous?.presets.filter(
                  (preset) => `${preset.id}.json` === entry.name,
                ) ?? [],
              errors: [error instanceof Error ? error.message : String(error)],
            }
          }
          try {
            return {
              presets: [parsePresetDefinition(await file.json(), entry.name)],
              errors: [],
            }
          } catch {
            signal.throwIfAborted()
            return { presets: [], errors: [] }
          }
        }),
      )
      signal.throwIfAborted()
      return {
        presets: results.flatMap((result) => result.presets),
        errors: [...new Set(results.flatMap((result) => result.errors))],
      }
    },
  }
}
