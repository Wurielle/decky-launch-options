import { Focusable, NavEntryPositionPreferences } from "@decky/ui"
import {
  ComponentProps,
  createContext,
  CSSProperties,
  ReactNode,
  useContext,
  useState,
} from "react"

type Control = "value" | "up" | "down" | "actions" | "quick-select"

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
  // Choose the changed row before a list-wide search reaches the
  // preferred controls that every row exposes for vertical navigation.
  return (
    <Focusable
      {...props}
      preferredFocus={props.autoFocus || props.preferredFocus}
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      style={{ display: "flex", gap: 10, alignItems: "center", ...props.style }}
    />
  )
}

// Match the control's role across rows rather than its screen coordinates.
// Text fields, toggles, and value dropdowns share the primary "value" column.
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
