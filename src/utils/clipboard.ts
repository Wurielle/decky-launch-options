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

export function readClipboardText(container: HTMLElement): Promise<string> {
  const ownerDocument = container.ownerDocument
  const ownerWindow = ownerDocument.defaultView as
    (Window & { SteamClient?: typeof SteamClient }) | null
  const sharedSteam =
    typeof SteamClient === "undefined" ? undefined : SteamClient
  const input = sharedSteam?.Input ?? ownerWindow?.SteamClient?.Input
  const browser = ownerWindow?.SteamClient?.Browser ?? sharedSteam?.Browser
  const keyboardPaste =
    typeof input?.ControllerKeyboardSetKeyState === "function"

  if (!keyboardPaste && typeof browser?.Paste !== "function") {
    return (
      ownerWindow?.navigator.clipboard?.readText?.() ??
      Promise.reject(new Error("Clipboard reading is unavailable."))
    )
  }

  // Steam's virtual keyboard reads the system clipboard via Ctrl+V. Browser.Paste
  // can read a different, empty clipboard. Keep the helper in the dialog's window.
  return new Promise((resolve, reject) => {
    const previousFocus = ownerDocument.activeElement as HTMLElement | null
    const textarea = ownerDocument.createElement("textarea")
    textarea.tabIndex = -1
    textarea.style.cssText =
      "position:fixed;opacity:0;width:1px;height:1px;pointer-events:none"
    let settled = false
    const finish = (value: string, error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(poll)
      const restoreFocus = ownerDocument.activeElement === textarea
      textarea.remove()
      if (restoreFocus) previousFocus?.focus?.({ preventScroll: true })
      if (error) reject(error)
      else resolve(value)
    }
    const timeout = setTimeout(
      () => finish("", new Error("Clipboard paste timed out.")),
      3000,
    )
    // Steam may update the native input without emitting a DOM event.
    const poll = setInterval(() => {
      if (textarea.value) finish(textarea.value)
    }, 50)
    textarea.addEventListener(
      "paste",
      (event) => {
        event.preventDefault()
        finish(event.clipboardData?.getData("text/plain") ?? "")
      },
      { once: true },
    )
    textarea.addEventListener("input", () => finish(textarea.value), {
      once: true,
    })
    container.appendChild(textarea)
    textarea.focus({ preventScroll: true })

    try {
      if (keyboardPaste) {
        // EHIDKeyboardKey.LControl = 103; EHIDKeyboardKey.V = 25.
        try {
          input.ControllerKeyboardSetKeyState(103, true)
          input.ControllerKeyboardSetKeyState(25, true)
        } finally {
          try {
            input.ControllerKeyboardSetKeyState(25, false)
          } finally {
            input.ControllerKeyboardSetKeyState(103, false)
          }
        }
      } else {
        Promise.resolve(browser!.Paste()).catch((error) => finish("", error))
      }
    } catch (error) {
      finish("", error)
    }
  })
}
