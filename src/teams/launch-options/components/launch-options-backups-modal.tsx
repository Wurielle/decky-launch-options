import { toaster } from "@decky/api"
import { ConfirmModal, Field, Focusable, showModal } from "@decky/ui"
import {
  useDeleteOriginalLaunchOptionsBackupMutation,
  useGetOriginalLaunchOptionsBackupsQuery,
} from "../../../query"
import { copyTextToClipboard } from "../../../utils"
import { BackupActionButton } from "./backup-action-button"

interface LaunchOptionsBackupsModalProps {
  appid: string
  onRestore: (command: string) => void
}

function formatBackupDate(date: string): string {
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return date

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate)
}

export function LaunchOptionsBackupsModal({
  appid,
  onRestore,
}: LaunchOptionsBackupsModalProps) {
  const backupsQuery = useGetOriginalLaunchOptionsBackupsQuery(appid)
  const deleteBackupMutation = useDeleteOriginalLaunchOptionsBackupMutation()
  const backups = backupsQuery.data ?? []

  const confirmDeleteBackup = (backupId: string, date: string) => {
    showModal(
      <ConfirmModal
        strTitle="Delete original launch options backup"
        strDescription={`Do you want to delete the backup from ${formatBackupDate(date)}?`}
        strOKButtonText="Confirm"
        strCancelButtonText="Cancel"
        onOK={async () => {
          deleteBackupMutation.mutate({ appid, backupId })
        }}
      />,
    )
  }

  if (backupsQuery.isLoading) {
    return <div>Loading backups...</div>
  }

  if (!backups.length) {
    return <div>No original launch options backups found for this app.</div>
  }

  return (
    <Focusable style={{ maxHeight: "55vh", overflowY: "auto" }}>
      {backups.map((backup) => (
        <Field
          key={`${backup.date}:${backup.command}`}
          label={formatBackupDate(backup.date)}
          description={backup.command || "(empty)"}
          childrenLayout={"inline"}
        >
          <BackupActionButton
            label="Backup actions"
            actions={[
              {
                label: "Restore",
                onSelected: () => {
                  onRestore(backup.command)
                  toaster.toast({
                    title: "Backup restored",
                    body: backup.command || "(empty)",
                    duration: 5000,
                  })
                },
              },
              {
                label: "Copy to clipboard",
                onSelected: () => {
                  copyTextToClipboard(backup.command).then(
                    () => {
                      toaster.toast({
                        title: "Copied to clipboard",
                        body: backup.command || "(empty)",
                        duration: 5000,
                      })
                    },
                    () => {
                      toaster.toast({
                        title: "Copy failed",
                        body: "Clipboard unavailable.",
                        duration: 5000,
                        critical: true,
                      })
                    },
                  )
                },
              },
              {
                label: "Delete",
                tone: "destructive",
                onSelected: () => confirmDeleteBackup(backup.id, backup.date),
              },
            ]}
          />
        </Field>
      ))}
    </Focusable>
  )
}
