import type { AppDetails } from "@decky/ui/dist/globals/steam-client/App"
import type { Profile } from "../shared"

export const appLaunchOptionsUpdatedEventType = "dlo-app-launch-options-updated"

export const launchOptionsLifecycle = { active: true }

export interface DloCommandInfo {
  COMMAND: string
  SHORT_SH_COMMAND_PATH: string
  FULL_SH_COMMAND_PATH: string
}

export type AppLaunchOptionsUpdatedEvent = CustomEvent<{
  appid: number
  launchOptions: string
}>

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

// Use Steam's live shortcut field here: the backend may already have stopped
// when Decky dismounts the frontend, and shortcuts.vdf may not be flushed yet.
function updateAppLaunchOptions(
  appid: number,
  update: (current: string, isNonSteamApp: boolean) => string | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let registration: { unregister(): void } | undefined
    let finished = false
    let expected: string | undefined
    const finish = () => {
      finished = true
      clearTimeout(timeout)
      // RegisterForAppDetails can also deliver a cached result synchronously.
      queueMicrotask(() => registration?.unregister())
      resolve()
    }
    const timeout = setTimeout(finish, 5000)
    try {
      registration = SteamClient.Apps.RegisterForAppDetails(
        appid,
        (details: AppDetails) => {
          if (finished) return
          try {
            const isNonSteamApp = typeof details.strShortcutExe !== "undefined"
            const current = isNonSteamApp
              ? details.strShortcutLaunchOptions
              : details.strLaunchOptions
            // The setter returns before Steam publishes the change. Keep the
            // subscription until it does, so startup cannot read the old value.
            if (expected !== undefined) {
              if (current === expected) finish()
              return
            }
            if (typeof current === "string") {
              const next = update(current, isNonSteamApp)
              if (next !== undefined && next !== current) {
                expected = next
                setAppLaunchOptions(appid, next)
                return
              }
            }
            finish()
          } catch (error) {
            reject(error)
            finish()
          }
        },
      )
    } catch (error) {
      reject(error)
      finish()
    }
  })
}

export function restoreAppLaunchOptions(
  appid: number,
  profile: Profile,
  info?: DloCommandInfo,
): Promise<void> {
  if (!info) return Promise.resolve()
  return updateAppLaunchOptions(appid, (current) =>
    appLaunchOptionsIncludesSupportedDloCommand(current, info)
      ? profile.originalLaunchOptions
      : undefined,
  )
}

export function applyProfileLaunchOptions(
  appid: number,
  profile: Profile,
  info: DloCommandInfo,
  autoManage: { steam: boolean; nonSteam: boolean },
): Promise<void> {
  return updateAppLaunchOptions(appid, (current, isNonSteamApp) => {
    if (
      !launchOptionsLifecycle.active ||
      profile.disableAutoManageLaunchOptions
    )
      return undefined
    if (!(isNonSteamApp ? autoManage.nonSteam : autoManage.steam))
      return undefined
    // Only recover the original value left by unload. Other edits still go
    // through the existing page-visit flow.
    return current === profile.originalLaunchOptions &&
      !appLaunchOptionsIncludesSupportedDloCommand(current, info)
      ? info.COMMAND
      : undefined
  })
}
