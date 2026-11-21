import { parsePresetDefinition } from "./model"
import type { PresetDiscovery } from "./discovery"

type CacheStorage = Pick<Storage, "getItem" | "setItem">

const cacheKey = (queryKey: readonly string[]) =>
  `decky-launch-options/preset-cache/v1/${JSON.stringify(queryKey)}`

export function readPresetCache(
  queryKey: readonly string[],
  storage?: CacheStorage,
): { data: PresetDiscovery; updatedAt: number } | undefined {
  try {
    const value = JSON.parse(
      (storage ?? globalThis.localStorage).getItem(cacheKey(queryKey)) ??
        "null",
    )
    if (
      value?.version !== 1 ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt <= 0 ||
      !Array.isArray(value.presets)
    )
      return undefined
    return {
      data: {
        presets: value.presets.map((preset: { id?: string }) =>
          parsePresetDefinition(preset, `${preset?.id}.json`),
        ),
        errors: [],
      },
      updatedAt: Math.min(value.updatedAt, Date.now()),
    }
  } catch {
    return undefined
  }
}

export function writePresetCache(
  queryKey: readonly string[],
  data: PresetDiscovery,
  storage?: CacheStorage,
) {
  try {
    const cacheStorage = storage ?? globalThis.localStorage
    cacheStorage.setItem(
      cacheKey(queryKey),
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        presets: data.presets,
      }),
    )
  } catch {
    // Storage can be unavailable or full; the in-memory cache still works.
  }
}
