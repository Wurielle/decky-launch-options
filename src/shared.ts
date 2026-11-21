import { v4 as uuid } from "uuid"

export const batchCreateLaunchOptionsEventType = "dlo-add-launch-options"
export const importRecipeEventType = "dlo-add-recipe"

export const routes = {
  recipeStore: () => "/launch-options-store",
  recipeStores: () => "/launch-options-store/stores",
  appLaunchOptions: (appid: number | string = ":appid") =>
    `/launch-options/${appid}`,
  launchOptionsManagerItem: (page: number | string = ":page") =>
    `/launch-options-manager/${page}`,
  environmentVariableMergesManagerItem: (page: number | string = ":page") =>
    `/environment-variable-merges-manager/${page}`,
}

export const profileFactory = (profile: Partial<Profile> = {}): Profile => ({
  state: {},
  originalLaunchOptions: "",
  ...profile,
})

export const launchOptionFactory = (
  launchOption: Partial<LaunchOption> = {},
): LaunchOption => ({
  // Note: do not spread as launchOptions can be provided by third-party plugins
  id: launchOption.id || uuid(),
  name: launchOption.name || "",
  on: launchOption.on || "",
  off: launchOption.off || "",
  enableGlobally: launchOption.enableGlobally || false,
  group: launchOption.group || "",
  valueId: launchOption.valueId || "",
  valueName: launchOption.valueName || "",
  fallbackValue: launchOption.fallbackValue || false,
  priority: launchOption.priority || 0,
  ...(launchOption.requireExplicitSelection
    ? { requireExplicitSelection: true }
    : {}),
  ...(launchOption.source ? { source: { ...launchOption.source } } : {}),
})

export const environmentVariableMergeFactory = (
  environmentVariableMerge: Partial<EnvironmentVariableMerge> = {},
): EnvironmentVariableMerge => ({
  id: environmentVariableMerge.id || uuid(),
  name: environmentVariableMerge.name || "",
  delimiter: environmentVariableMerge.delimiter ?? "",
})

export const defaultEnvironmentVariableMerges: EnvironmentVariableMerge[] = [
  { id: "winedlloverrides", name: "WINEDLLOVERRIDES", delimiter: ";" },
  { id: "mangohud-config", name: "MANGOHUD_CONFIG", delimiter: "," },
  { id: "dxvk-config", name: "DXVK_CONFIG", delimiter: ";" },
  { id: "vkd3d-config", name: "VKD3D_CONFIG", delimiter: "," },
  { id: "dxvk-hud", name: "DXVK_HUD", delimiter: "," },
  { id: "radv-perftest", name: "RADV_PERFTEST", delimiter: "," },
]

export type Profile = {
  state: Record<string, boolean>
  originalLaunchOptions: string
  disableAutoManageLaunchOptions?: boolean
  overrideCommandEnabled?: boolean
  overrideCommand?: string
}

export type LaunchOption = {
  /** Suppress implicit defaults (and unselected off commands) until selected. */
  requireExplicitSelection?: boolean
  source?: {
    storeKey: string
    recipeId: string
    launchOptionId: string
  }
  id: string
  name: string
  on: string
  off: string
  enableGlobally: boolean
  group: string
  valueId: string
  valueName: string
  fallbackValue: boolean
  priority: number
}

export type EnvironmentVariableMerge = {
  id: string
  name: string
  delimiter: string
}

export type Recipe = {
  id?: string
  name: string
  launchOptions?: Partial<LaunchOption>[]
  environmentVariableMerges?: (Omit<EnvironmentVariableMerge, "id"> & {
    id?: string
  })[]
}

export type Settings = {
  profiles: Record<string, Profile>
  launchOptions: LaunchOption[]
  environmentVariableMerges: EnvironmentVariableMerge[]
}

export type StoredSettings = Partial<Settings> & {
  /** Compatibility with settings saved before the property was renamed. */
  envVariableMerges?: EnvironmentVariableMerge[]
}
