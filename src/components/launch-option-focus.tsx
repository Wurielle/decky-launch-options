import { Focusable, NavEntryPositionPreferences } from "@decky/ui"
import {
  ComponentProps,
  createContext,
  CSSProperties,
  ReactNode,
  useContext,
  useState,
} from "react"

type Control = "value" | "up" | "down" | "actions"

const FocusContext = createContext<{
  control: Control
  setControl: (control: Control) => void
} | null>(null)

export function LaunchOptionFocusProvider({
  children,
}: {
  children: ReactNode
}) {
  const [control, setControl] = useState<Control>("value")
  return (
    <FocusContext.Provider value={{ control, setControl }}>
      {children}
    </FocusContext.Provider>
  )
}

export function useLaunchOptionFocus() {
  const context = useContext(FocusContext)
  if (!context) throw new Error("Launch option controls need a focus provider")
  return context
}

export function LaunchOptionFocusList(props: ComponentProps<typeof Focusable>) {
  return (
    <LaunchOptionFocusProvider>
      <Focusable {...props} />
    </LaunchOptionFocusProvider>
  )
}

export function LaunchOptionControls(props: ComponentProps<typeof Focusable>) {
  return (
    <Focusable
      {...props}
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      style={{ display: "flex", gap: 10, alignItems: "center", ...props.style }}
    />
  )
}

// Match the control's role across rows rather than its screen coordinates.
// Toggle and dropdown controls both occupy the primary "value" column.
export function LaunchOptionControl({
  control,
  children,
  style,
}: {
  control: Control
  children: ReactNode
  style?: CSSProperties
}) {
  const focus = useLaunchOptionFocus()
  return (
    <Focusable
      preferredFocus={focus.control === control}
      onGamepadFocus={() => focus.setControl(control)}
      style={style}
    >
      {children}
    </Focusable>
  )
}
