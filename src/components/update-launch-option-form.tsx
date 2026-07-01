import { usePlugin } from "./plugin-provider"
import { ConfirmModal, DialogButton, showModal } from "@decky/ui"
import { useMemo, useRef } from "react"
import { LaunchOptionFields } from "./launch-option-fields"

export function UpdateLaunchOptionForm({
  id,
  onDelete,
  commonOnly = true,
  syncCommonFields = true,
  deleteByValueId = false,
}: {
  id: string
  onDelete?: () => void
  commonOnly?: boolean
  syncCommonFields?: boolean
  deleteByValueId?: boolean
}) {
  const {
    updateLaunchOption,
    deleteLaunchOption,
    deleteLaunchOptionsByIds,
    settings,
  } = usePlugin().settings

  const data = useMemo(
    () => settings.launchOptions.find((launchOption) => launchOption.id === id),
    [settings.launchOptions, id],
  )

  const syncedLaunchOptionIdsRef = useRef<string[] | null>(null)
  const deleteGroupRef = useRef<boolean | null>(null)

  if (data && syncedLaunchOptionIdsRef.current === null) {
    // Freeze the modal's sibling list for its lifetime. Otherwise editing Value ID
    // to match another group would make later synced edits/delete affect that group too.
    deleteGroupRef.current = !!data.valueId
    syncedLaunchOptionIdsRef.current = data.valueId
      ? settings.launchOptions
          .filter((launchOption) => launchOption.valueId === data.valueId)
          .map((launchOption) => launchOption.id)
      : [data.id]
  }

  if (!data) return null
  const deleteGroup = !!deleteGroupRef.current

  function remove() {
    if (!data) return null
    return showModal(
      <ConfirmModal
        strTitle={
          deleteByValueId && deleteGroup
            ? "Remove launch options"
            : "Remove launch option"
        }
        strDescription={
          deleteByValueId && deleteGroup
            ? "Do you want to remove this launch option group?"
            : `Do you want to remove the "${data.name || "Unnamed"}" launch option?`
        }
        strOKButtonText="Confirm"
        strCancelButtonText="Cancel"
        onOK={async () => {
          if (deleteByValueId && deleteGroup) {
            deleteLaunchOptionsByIds(syncedLaunchOptionIdsRef.current || [])
          } else {
            deleteLaunchOption(data.id)
          }
          onDelete?.()
        }}
      />,
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <LaunchOptionFields
        data={data}
        onChange={(field, value) =>
          updateLaunchOption(
            data,
            field,
            value,
            syncCommonFields,
            syncedLaunchOptionIdsRef.current || undefined,
          )
        }
        commonOnly={commonOnly}
      />
      <DialogButton style={{ flex: 1 }} onClick={remove}>
        <div
          style={{
            color: "oklch(63.7% 0.237 25.331)",
            fontWeight: "bold",
          }}
        >
          {deleteByValueId && deleteGroup
            ? "Remove launch options"
            : "Remove launch option"}
        </div>
      </DialogButton>
    </div>
  )
}
