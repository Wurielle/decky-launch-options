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
