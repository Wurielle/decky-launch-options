import { DialogButton, Menu, MenuItem, showContextMenu } from "@decky/ui"
import { FaEllipsisV } from "react-icons/fa"

export interface BackupAction {
  label: string
  tone?: "destructive"
  onSelected: () => void
}

export function BackupActionButton({
  label,
  actions,
}: {
  label: string
  actions: BackupAction[]
}) {
  const showActions = (event: any) => {
    let menu: ReturnType<typeof showContextMenu>
    const runAction = (action: () => void) => () => {
      menu.Hide()
      action()
    }

    menu = showContextMenu(
      <Menu label={label} onCancel={() => menu.Hide()}>
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            tone={action.tone}
            onSelected={runAction(action.onSelected)}
          >
            {action.label}
          </MenuItem>
        ))}
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
