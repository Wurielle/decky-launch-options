import { DialogButton } from "@decky/ui"
import { useState } from "react"
import { LaunchOptionGroupField } from "./launch-option-fields"
import { LaunchOptionFocusList } from "./launch-option-focus"

export function UpdateLaunchOptionGroupForm({
  group,
  onSubmit,
}: {
  group: string
  onSubmit: (group: string) => void
}) {
  const [nextGroup, setNextGroup] = useState(group)

  return (
    <LaunchOptionFocusList
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <LaunchOptionGroupField
        description="Move all launch options in this group together. Use an existing group to merge them, or leave empty to ungroup them."
        value={nextGroup}
        onChange={setNextGroup}
      />
      <DialogButton onClick={() => onSubmit(nextGroup)}>Save</DialogButton>
    </LaunchOptionFocusList>
  )
}
