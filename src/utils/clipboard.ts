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
