import { Focusable, GamepadButton } from "@decky/ui"
import type { GamepadEvent } from "@decky/ui"
import { ComponentType, ReactNode, useRef } from "react"

const SCROLL_STEP = 120

const ScrollContent = Focusable as ComponentType<{
  autoFocus?: boolean
  children: ReactNode
  focusable?: boolean
  noFocusRing?: boolean
  onGamepadDirection?: (event: GamepadEvent) => void
}>

function findScrollableAncestor(element: HTMLElement | null) {
  const ownerWindow = element?.ownerDocument.defaultView
  let current = element

  while (current && current !== element?.ownerDocument.body) {
    const overflowY = ownerWindow?.getComputedStyle(current).overflowY

    if (
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current
    }

    current = current.parentElement
  }

  return null
}

export function ModalScrollContent({
  children,
  autoFocus = true,
  onFocusPrevious,
  onFocusNext,
}: {
  children: ReactNode
  autoFocus?: boolean
  onFocusPrevious?: () => void
  onFocusNext?: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollContent = (event: GamepadEvent) => {
    const scrollElement = findScrollableAncestor(scrollRef.current)
    const up = event.detail.button === GamepadButton.DIR_UP
    const down = event.detail.button === GamepadButton.DIR_DOWN

    if (!up && !down) return

    if (
      up &&
      onFocusPrevious &&
      (!scrollElement || scrollElement.scrollTop <= 0)
    ) {
      event.preventDefault()
      onFocusPrevious()
      return
    }

    if (
      down &&
      onFocusNext &&
      (!scrollElement ||
        Math.ceil(scrollElement.scrollTop + scrollElement.clientHeight) >=
          scrollElement.scrollHeight)
    ) {
      event.preventDefault()
      onFocusNext()
      return
    }

    if (!scrollElement) return

    event.preventDefault()
    scrollElement.scrollBy({
      top: up ? -SCROLL_STEP : SCROLL_STEP,
      behavior: event.detail.is_repeat ? "auto" : "smooth",
    })
  }

  return (
    <ScrollContent
      autoFocus={autoFocus}
      focusable
      noFocusRing
      onGamepadDirection={scrollContent}
    >
      <div ref={scrollRef}>{children}</div>
    </ScrollContent>
  )
}
