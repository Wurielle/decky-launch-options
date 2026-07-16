export const appLaunchOptionsUpdatedEventType = "dlo-app-launch-options-updated"

export type AppLaunchOptionsUpdatedEvent = CustomEvent<{
  appid: number
  launchOptions: string
}>

export function appLaunchOptionsIncludesDloCommand(
  appLaunchOptions: string,
  command: string,
): boolean {
  return appLaunchOptions.includes(command)
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
