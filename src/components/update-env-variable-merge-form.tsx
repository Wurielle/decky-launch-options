import { ConfirmModal, DialogButton, showModal } from "@decky/ui"
import { useMemo } from "react"
import { usePlugin } from "./plugin-provider"
import { EnvVariableMergeFields } from "./env-variable-merge-fields"

export function UpdateEnvVariableMergeForm({
  id,
  onDelete,
}: {
  id: string
  onDelete?: () => void
}) {
  const { updateEnvVariableMerge, deleteEnvVariableMerge, settings } =
    usePlugin().settings

  const data = useMemo(
    () =>
      settings.envVariableMerges.find(
        (envVariableMerge) => envVariableMerge.id === id,
      ),
    [settings.envVariableMerges, id],
  )

  if (!data) return null

  function remove() {
    if (!data) return null
    return showModal(
      <ConfirmModal
        strTitle="Remove environment variable merge"
        strDescription={`Do you want to remove the "${data.name || "Unnamed"}" environment variable merge?`}
        strOKButtonText="Confirm"
        strCancelButtonText="Cancel"
        onOK={async () => {
          deleteEnvVariableMerge(data.id)
          onDelete?.()
        }}
      />,
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <EnvVariableMergeFields
        data={data}
        onChange={(field, value) => updateEnvVariableMerge(data, field, value)}
      />
      <DialogButton style={{ flex: 1 }} onClick={remove}>
        <div
          style={{
            color: "oklch(63.7% 0.237 25.331)",
            fontWeight: "bold",
          }}
        >
          Remove environment variable merge
        </div>
      </DialogButton>
    </div>
  )
}
