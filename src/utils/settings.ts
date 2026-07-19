import { WritableDraft } from "immer"
import { v4 as uuid } from "uuid"
import {
  defaultEnvVariableMerges,
  envVariableMergeFactory,
  LaunchOption,
  Settings,
} from "../shared"

export function normalizeSettings(nextSettings?: Settings | null): Settings {
  const envVariableMerges =
    nextSettings?.envVariableMerges === undefined
      ? defaultEnvVariableMerges
      : nextSettings.envVariableMerges

  return {
    profiles: nextSettings?.profiles || {},
    launchOptions: (nextSettings?.launchOptions || []).map((item) => ({
      ...item,
      valueId: item.valueId || "",
      valueName: item.valueName || "",
      fallbackValue: !!item.fallbackValue,
      priority: item.priority || 0,
    })),
    envVariableMerges: envVariableMerges.map((item) =>
      envVariableMergeFactory(item),
    ),
  }
}

/**
 * Clear per-app profile state for the given launch option IDs across all profiles.
 * This ensures that when a launch option (or valueId group) is promoted to global,
 * no stale per-app state overrides the global default.
 */
export function clearProfileState(
  draft: WritableDraft<Settings>,
  ids: string[],
) {
  for (const profile of Object.values(draft.profiles)) {
    for (const id of ids) {
      delete profile.state[id]
    }
  }
}

export function normalizeFallbackValues(draft: WritableDraft<Settings>) {
  const groups = new Map<string, LaunchOption[]>()
  draft.launchOptions.forEach((item) => {
    if (!item.valueId) {
      item.fallbackValue = false
      return
    }
    const siblings = groups.get(item.valueId) || []
    siblings.push(item)
    groups.set(item.valueId, siblings)
  })

  groups.forEach((siblings) => {
    let hasFallbackValue = false
    siblings.forEach((item) => {
      if (!item.fallbackValue) return
      if (hasFallbackValue) {
        item.fallbackValue = false
        return
      }
      hasFallbackValue = true
    })
  })
}

export function getCopyLabel(label: string, existingLabels: Iterable<string>) {
  const baseLabel = label || "Unnamed"
  const labels = new Set(existingLabels)
  let nextLabel = `${baseLabel} (Copy)`
  let index = 2

  while (labels.has(nextLabel)) {
    nextLabel = `${baseLabel} (Copy ${index})`
    index++
  }

  return nextLabel
}

export function getCopyValueId(
  valueId: string,
  existingValueIds: Iterable<string>,
) {
  const baseValueId =
    valueId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unnamed"
  const valueIds = new Set(existingValueIds)
  let nextValueId = ""

  do {
    const suffix = uuid().replace(/-/g, "").slice(0, 4)
    nextValueId = `${baseValueId}-copy-${suffix}`
  } while (valueIds.has(nextValueId))

  return nextValueId
}

export function getSelectedValueIdLaunchOptionId(
  settings: Settings,
  appid: string,
  valueId: string,
): string | null {
  const siblings = settings.launchOptions.filter(
    (item) => item.valueId === valueId,
  )
  if (siblings.length === 0) return null

  const appProfile = settings.profiles[appid]

  // Explicit user choice wins.
  const explicitlyEnabled = siblings.find(
    (item) => appProfile?.state?.[item.id] === true,
  )
  if (explicitlyEnabled) return explicitlyEnabled.id

  // Any explicit state on this group without a true means user selected Disabled.
  const hasExplicitState = siblings.some(
    (item) => appProfile?.state && item.id in appProfile.state,
  )
  if (hasExplicitState) return null

  // Global fallback for valueId groups: the globally-enabled option, if any.
  const globallyEnabled = siblings.find((item) => item.enableGlobally)
  if (globallyEnabled) return globallyEnabled.id

  // Last resort: the fallbackValue option, or the first sibling.
  const fallback = siblings.find((item) => item.fallbackValue)
  return fallback?.id || siblings[0].id
}

export function getLaunchOptionState(
  settings: Settings,
  appid: string,
  launchOptionId: string,
): boolean {
  const launchOption = settings.launchOptions.find(
    (item) => item.id === launchOptionId,
  )
  if (!launchOption) return false

  if (launchOption.valueId) {
    return (
      getSelectedValueIdLaunchOptionId(
        settings,
        appid,
        launchOption.valueId,
      ) === launchOptionId
    )
  }

  const appProfile = settings.profiles[appid]
  if (appProfile && launchOptionId in appProfile.state) {
    return appProfile.state[launchOptionId]
  }
  return !!launchOption.enableGlobally
}
