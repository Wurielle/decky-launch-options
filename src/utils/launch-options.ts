import { LaunchOption } from "../shared"
import { type LaunchOptionSort } from "../stores"

export type LaunchOptionScope = "local" | "global"

export interface HierarchicalLaunchOption {
  launchOption: LaunchOption
  displayName: string
  indentLevel: number
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
