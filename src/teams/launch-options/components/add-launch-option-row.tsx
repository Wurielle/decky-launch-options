import { DialogButton, Field } from "@decky/ui"
import {
  ActionMenuButton,
  MenuAction,
} from "../../../components/action-menu-button"
import {
  LaunchOptionControl,
  LaunchOptionControls,
} from "../../../components/launch-option-focus"

export function AddLaunchOptionRow({
  onAdd,
  actions,
}: {
  onAdd: () => void
  actions?: MenuAction[]
}) {
  return (
    <Field childrenLayout="inline" childrenContainerWidth="max">
      <LaunchOptionControls style={{ width: "100%" }}>
        <LaunchOptionControl control="value" style={{ flex: 1 }}>
          <DialogButton style={{ width: "100%" }} onClick={onAdd}>
            Add launch option
          </DialogButton>
        </LaunchOptionControl>
        {actions && (
          <LaunchOptionControl control="actions">
            <ActionMenuButton label="Group actions" actions={actions} />
          </LaunchOptionControl>
        )}
      </LaunchOptionControls>
    </Field>
  )
}
