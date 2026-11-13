import { DialogButton, Field, Focusable, TextField } from "@decky/ui"
import { useState } from "react"

export function UpdateLaunchOptionGroupForm({
  group,
  onSubmit,
}: {
  group: string
  onSubmit: (group: string) => void
}) {
  const [nextGroup, setNextGroup] = useState(group)

  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Field
        label="Group"
        description="Move all launch options in this group together. Use an existing group to merge them, or leave empty to ungroup them."
        childrenLayout="below"
      >
        <TextField
          style={{ width: "100%" }}
          value={nextGroup}
          onChange={(event) => setNextGroup(event.target.value)}
        />
      </Field>
      <DialogButton onClick={() => onSubmit(nextGroup)}>Save</DialogButton>
    </Focusable>
  )
}
