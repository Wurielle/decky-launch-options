import { ConfirmModal, showModal } from "@decky/ui"
import { LaunchOption } from "../shared"

export const getDeleteLaunchOptionLabel = (deleteGroup: boolean) =>
  deleteGroup ? "Remove launch options" : "Remove launch option"

export function showDeleteLaunchOptionModal({
  launchOption,
  deleteGroup,
  onDelete,
}: {
  launchOption: LaunchOption
  deleteGroup: boolean
  onDelete: () => void
}) {
  return showModal(
    <ConfirmModal
      strTitle={getDeleteLaunchOptionLabel(deleteGroup)}
      strDescription={
        deleteGroup
          ? "Do you want to remove this launch option group?"
          : `Do you want to remove the "${launchOption.name || "Unnamed"}" launch option?`
      }
      strOKButtonText="Confirm"
      strCancelButtonText="Cancel"
      onOK={async () => {
        onDelete()
      }}
    />,
  )
}
