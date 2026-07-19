import { WritableDraft } from "immer"
import { v4 as uuid } from "uuid"
import {
  defaultEnvVariableMerges,
  envVariableMergeFactory,
  LaunchOption,
  Settings,
} from "./shared"
import { type LaunchOptionSort } from "./stores"

export const appLaunchOptionsUpdatedEventType = "dlo-app-launch-options-updated"

export interface DloCommandInfo {
  COMMAND: string
  SHORT_SH_COMMAND_PATH: string
  FULL_SH_COMMAND_PATH: string
}

export type AppLaunchOptionsUpdatedEvent = CustomEvent<{
  appid: number
  launchOptions: string
}>

export type LaunchOptionScope = "local" | "global"

export interface HierarchicalLaunchOption {
  launchOption: LaunchOption
  displayName: string
  indentLevel: number
}

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

interface HierarchicalLaunchOptionNode {
  item: HierarchicalLaunchOption
  children: HierarchicalLaunchOptionNode[]
  isActive: boolean
  originalIndex: number
}

function compareLaunchOptionsAlphabetically(
  a: LaunchOption,
  b: LaunchOption,
): number {
  const name = a.name.localeCompare(b.name)
  if (name !== 0) return name

  const valueName = (a.valueName ?? "").localeCompare(b.valueName ?? "")
  if (valueName !== 0) return valueName

  const on = (a.on ?? "").localeCompare(b.on ?? "")
  if (on !== 0) return on

  return a.id.localeCompare(b.id)
}

function isLaunchOptionActive(
  item: LaunchOption,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): boolean {
  const isActive = getAppLaunchOptionState(appid, item.id)
  return isActive ? !!item.on : !!item.off
}

function sortLaunchOptions(
  options: LaunchOption[],
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
  sortActive: boolean = sortMode.endsWith("-active"),
): LaunchOption[] {
  return [...options].sort((a, b) => {
    if (sortActive) {
      const active =
        Number(isLaunchOptionActive(b, appid, getAppLaunchOptionState)) -
        Number(isLaunchOptionActive(a, appid, getAppLaunchOptionState))
      if (active !== 0) return active
    }

    return compareLaunchOptionsAlphabetically(a, b)
  })
}

function sortHierarchicalLaunchOptions(
  items: HierarchicalLaunchOption[],
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): HierarchicalLaunchOption[] {
  if (!sortMode.endsWith("-active")) return items

  const roots: HierarchicalLaunchOptionNode[] = []
  const stack: HierarchicalLaunchOptionNode[] = []

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const node: HierarchicalLaunchOptionNode = {
      item,
      children: [],
      isActive: isLaunchOptionActive(
        item.launchOption,
        appid,
        getAppLaunchOptionState,
      ),
      originalIndex: index,
    }

    while (
      stack.length > 0 &&
      stack[stack.length - 1].item.indentLevel >= item.indentLevel
    ) {
      stack.pop()
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  const sortNodes = (nodes: HierarchicalLaunchOptionNode[]): boolean => {
    let hasActiveNode = false

    for (const node of nodes) {
      node.isActive = sortNodes(node.children) || node.isActive
      hasActiveNode = node.isActive || hasActiveNode
    }

    nodes.sort((a, b) => {
      const active = Number(b.isActive) - Number(a.isActive)
      if (active !== 0) return active

      const alphabetical = compareLaunchOptionsAlphabetically(
        a.item.launchOption,
        b.item.launchOption,
      )
      if (alphabetical !== 0) return alphabetical

      return a.originalIndex - b.originalIndex
    })

    return hasActiveNode
  }

  const flattenNodes = (
    nodes: HierarchicalLaunchOptionNode[],
  ): HierarchicalLaunchOption[] => {
    const result: HierarchicalLaunchOption[] = []

    for (const node of nodes) {
      result.push(node.item)
      result.push(...flattenNodes(node.children))
    }

    return result
  }

  sortNodes(roots)
  return flattenNodes(roots)
}

export function toHierarchicalLaunchOptions(
  options: LaunchOption[],
  useHierarchy: boolean,
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): HierarchicalLaunchOption[] {
  if (!useHierarchy) {
    return sortLaunchOptions(
      options,
      sortMode,
      appid,
      getAppLaunchOptionState,
    ).map((item) => ({
      launchOption: item,
      displayName: item.name,
      indentLevel: 0,
    }))
  }

  const alphabetical = sortLaunchOptions(
    options,
    sortMode,
    appid,
    getAppLaunchOptionState,
    false,
  )
  return sortHierarchicalLaunchOptions(
    buildHierarchy(alphabetical),
    sortMode,
    appid,
    getAppLaunchOptionState,
  )
}

function buildHierarchy(options: LaunchOption[]): HierarchicalLaunchOption[] {
  const result: HierarchicalLaunchOption[] = []

  // Track which options have been processed as children
  const processed = new Set<string>()

  function findChildren(
    parent: LaunchOption,
    parentIndent: number,
    parentPrefix: string,
  ): HierarchicalLaunchOption[] {
    const children: HierarchicalLaunchOption[] = []

    for (const option of options) {
      if (processed.has(option.id) || option.id === parent.id) continue

      // Check if this option starts with the parent's name (plus a space)
      if (option.name.startsWith(parentPrefix + " ")) {
        processed.add(option.id)
        const displayName = option.name
          .substring(parentPrefix.length + 1)
          .trim()

        children.push({
          launchOption: option,
          displayName,
          indentLevel: parentIndent + 1,
        })

        // Recursively find children of this child
        const grandchildren = findChildren(
          option,
          parentIndent + 1,
          option.name,
        )
        children.push(...grandchildren)
      }
    }

    return children
  }

  // First pass: identify root-level items and build hierarchy
  for (const option of options) {
    if (processed.has(option.id)) continue

    // Add the root item
    result.push({
      launchOption: option,
      displayName: option.name,
      indentLevel: 0,
    })
    processed.add(option.id)

    // Find and add all children recursively
    const children = findChildren(option, 0, option.name)
    result.push(...children)
  }

  return result
}

/**
 * Count active launch options, treating valueId groups as at most 1.
 */
export function countActiveLaunchOptions(
  launchOptions: LaunchOption[],
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
  filter?: (item: LaunchOption) => boolean,
): number {
  const filtered = filter ? launchOptions.filter(filter) : launchOptions
  const countedValueIds = new Set<string>()
  let count = 0

  for (const item of filtered) {
    if (!isLaunchOptionActive(item, appid, getAppLaunchOptionState)) continue

    if (item.valueId) {
      if (countedValueIds.has(item.valueId)) continue
      countedValueIds.add(item.valueId)
    }

    count++
  }

  return count
}

export function appLaunchOptionsIsDloCommand(
  appLaunchOptions: string,
  info?: { COMMAND: string },
): boolean {
  if (!info) return false

  const command = appLaunchOptions.trim()
  return command === info.COMMAND
}

export function appLaunchOptionsIncludesDloCommand(
  appLaunchOptions: string,
  command: string,
): boolean {
  return appLaunchOptions.includes(command)
}

export function appLaunchOptionsIncludesSupportedDloCommand(
  appLaunchOptions: string,
  info: DloCommandInfo,
): boolean {
  return [
    info.COMMAND,
    info.SHORT_SH_COMMAND_PATH,
    info.FULL_SH_COMMAND_PATH,
  ].some(
    (command) =>
      !!command &&
      appLaunchOptionsIncludesDloCommand(appLaunchOptions, command),
  )
}

export function setAppLaunchOptions(appid: number, launchOptions: string) {
  SteamClient.Apps.SetAppLaunchOptions(appid, launchOptions)
  window.dispatchEvent(
    new CustomEvent(appLaunchOptionsUpdatedEventType, {
      detail: { appid, launchOptions },
    }),
  )
}

export function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .catch(() => copyTextToClipboardWithTextarea(text))
  }

  return copyTextToClipboardWithTextarea(text)
}

function copyTextToClipboardWithTextarea(text: string) {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand("copy")) {
      return Promise.reject(new Error("Failed to copy text to clipboard"))
    }

    return Promise.resolve()
  } finally {
    document.body.removeChild(textarea)
  }
}
