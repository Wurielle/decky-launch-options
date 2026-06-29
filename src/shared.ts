import { v4 as uuid } from "uuid"

export const batchCreateLaunchOptionsEventType = "dlo-add-launch-options"

export const routes = {
  appLaunchOptions: (appid: number | string = ":appid") =>
    `/launch-options/${appid}`,
  launchOptionsManagerItem: (page: number | string = ":page") =>
    `/launch-options-manager/${page}`,
  envVariableMergesManagerItem: (page: number | string = ":page") =>
    `/env-variable-merges-manager/${page}`,
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
})

export const envVariableMergeFactory = (
  envVariableMerge: Partial<EnvVariableMerge> = {},
): EnvVariableMerge => ({
  id: envVariableMerge.id || uuid(),
  name: envVariableMerge.name || "",
  delimiter: envVariableMerge.delimiter ?? "",
})

export const defaultEnvVariableMerges: EnvVariableMerge[] = [
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
}

export type LaunchOption = {
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

export type EnvVariableMerge = {
  id: string
  name: string
  delimiter: string
}

export type Settings = {
  profiles: Record<string, Profile>
  launchOptions: LaunchOption[]
  envVariableMerges: EnvVariableMerge[]
}
