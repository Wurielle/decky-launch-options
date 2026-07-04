import { DialogButton, Menu, MenuItem, showContextMenu } from "@decky/ui"
import { FaEllipsisV } from "react-icons/fa"

export function LaunchOptionActionButton({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const showActions = (event: any) => {
    let menu: ReturnType<typeof showContextMenu>
    const runAction = (action: () => void) => () => {
      menu.Hide()
      action()
    }

    menu = showContextMenu(
      <Menu label="Launch option actions" onCancel={() => menu.Hide()}>
        <MenuItem onSelected={runAction(onEdit)}>Edit</MenuItem>
        <MenuItem onSelected={runAction(onDuplicate)}>Duplicate</MenuItem>
        <MenuItem tone="destructive" onSelected={runAction(onDelete)}>
          Remove
        </MenuItem>
      </Menu>,
      event.currentTarget,
    )
  }

  return (
    <DialogButton
      style={{
        minWidth: 40,
        width: 40,
        height: 40,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={showActions}
    >
      <FaEllipsisV />
    </DialogButton>
  )
}
