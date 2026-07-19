import { Focusable, gamepadDialogClasses, ScrollPanelGroup } from "@decky/ui"
import {
  ComponentType,
  CSSProperties,
  ReactNode,
  useEffect,
  useState,
} from "react"
import { get_debug_log } from "../query"

const ModalScrollPanel = ScrollPanelGroup as ComponentType<{
  className?: string
  children?: ReactNode
  focusable?: boolean
  style?: CSSProperties
}>

const ModalScrollContent = Focusable as ComponentType<{
  autoFocus?: boolean
  className?: string
  children: ReactNode
  focusable?: boolean
  noFocusRing?: boolean
  onCancel?: () => void
}>

export function DebugLogModal({ onClose }: { onClose: () => void }) {
  const [log, setLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get_debug_log().then((result) => {
      setLog(result)
      setLoading(false)
    })
  }, [])

  return (
    <ModalScrollPanel
      className={gamepadDialogClasses.ModalPosition}
      focusable={false}
      style={{ position: "absolute" }}
    >
      <ModalScrollContent
        autoFocus
        className={`${gamepadDialogClasses.GamepadDialogContent} DialogContent _DialogLayout`}
        focusable
        noFocusRing
        onCancel={onClose}
      >
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
      </ModalScrollContent>
    </ModalScrollPanel>
  )
}
