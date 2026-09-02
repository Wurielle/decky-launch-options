import { Focusable, GamepadButton, ModalRoot } from "@decky/ui"
import type { GamepadEvent } from "@decky/ui"
import { ComponentType, ReactNode, useEffect, useRef, useState } from "react"
import { get_debug_log } from "../query"

const SCROLL_STEP = 120

const ModalScrollContent = Focusable as ComponentType<{
  autoFocus?: boolean
  className?: string
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

export function DebugLogModal({ onClose }: { onClose: () => void }) {
  const [log, setLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    get_debug_log().then((result) => {
      setLog(result)
      setLoading(false)
    })
  }, [])

  const scrollLog = (event: GamepadEvent) => {
    const scrollElement = findScrollableAncestor(scrollRef.current)

    if (
      !scrollElement ||
      (event.detail.button !== GamepadButton.DIR_UP &&
        event.detail.button !== GamepadButton.DIR_DOWN)
    ) {
      return
    }

    event.preventDefault()
    scrollElement.scrollBy({
      top:
        event.detail.button === GamepadButton.DIR_UP
          ? -SCROLL_STEP
          : SCROLL_STEP,
      behavior: "smooth",
    })
  }

  return (
    <ModalRoot onCancel={onClose} bAllowFullSize>
      <ModalScrollContent
        autoFocus
        focusable
        noFocusRing
        onGamepadDirection={scrollLog}
      >
        <div ref={scrollRef}>
          {loading ? (
            <div>Loading...</div>
          ) : log ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {log}
            </pre>
          ) : (
            <div>No debug log found. Launch a game to generate one.</div>
          )}
        </div>
      </ModalScrollContent>
    </ModalRoot>
  )
}
