import { ConfirmModal, showModal } from "@decky/ui"
import { LaunchOption } from "../shared"

export const getDeleteLaunchOptionLabel = (deleteGroup: boolean) =>
    deleteGroup ? "Remove launch options" : "Remove launch option"

export function showDeleteLaunchOptionModal({
                                                launchOption,
                                                deleteGroup,
                                                deleteCount,
                                                onDelete,
                                            }: {
    launchOption: LaunchOption
    deleteGroup: boolean
    deleteCount?: number
    onDelete: () => void
}) {
    const deleteGroupDescription =
        typeof deleteCount === "number"
            ? `Do you want to remove ${ deleteCount } launch option${ deleteCount === 1 ? "" : "s" }?`
            : "Do you want to remove these launch options?"

    return showModal(
        <ConfirmModal
            strTitle={ getDeleteLaunchOptionLabel(deleteGroup) }
            strDescription={
                deleteGroup
                    ? deleteGroupDescription
                    : `Do you want to remove the "${ launchOption.name || "Unnamed" }" launch option?`
            }
            strOKButtonText="Confirm"
            strCancelButtonText="Cancel"
            onOK={ async () => {
                onDelete()
            } }
        />,
    )
}
