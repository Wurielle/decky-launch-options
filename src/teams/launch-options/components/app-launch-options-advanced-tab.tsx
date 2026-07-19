import { toaster } from "@decky/api"
import {
  ButtonItem,
  Field,
  Focusable,
  NavEntryPositionPreferences,
  ToggleField,
} from "@decky/ui"
import type { useSettings } from "../../../hooks"
import type {
  useGetInfoQuery,
  useSetDloLaunchOptionsMutation,
} from "../../../query"
import { setAppLaunchOptions } from "../../../utils"
import { BackupActionButton } from "./backup-action-button"

type SettingsActions = ReturnType<typeof useSettings>

interface AppLaunchOptionsAdvancedTabProps {
  appid: string
  loadedLaunchOptionsAppid: string | null
  currentLaunchOptions: string
  appLaunchOptionsHasDloCommand: boolean
  canManuallyChangeAppLaunchOptions: boolean
  showResetAppLaunchOptions: boolean
  getInfoQuery: ReturnType<typeof useGetInfoQuery>
  setDloLaunchOptionsMutation: ReturnType<typeof useSetDloLaunchOptionsMutation>
  getAppDisableAutoManageLaunchOptions: SettingsActions["getAppDisableAutoManageLaunchOptions"]
  setAppDisableAutoManageLaunchOptions: SettingsActions["setAppDisableAutoManageLaunchOptions"]
  getAppOriginalLaunchOptions: SettingsActions["getAppOriginalLaunchOptions"]
  setAppOriginalLaunchOptions: SettingsActions["setAppOriginalLaunchOptions"]
  showLaunchOptionsBackupsModal: () => void
  confirmDeleteLaunchOptionsBackups: () => void
}

export function AppLaunchOptionsAdvancedTab({
  appid,
  loadedLaunchOptionsAppid,
  currentLaunchOptions,
  appLaunchOptionsHasDloCommand,
  canManuallyChangeAppLaunchOptions,
  showResetAppLaunchOptions,
  getInfoQuery,
  setDloLaunchOptionsMutation,
  getAppDisableAutoManageLaunchOptions,
  setAppDisableAutoManageLaunchOptions,
  getAppOriginalLaunchOptions,
  setAppOriginalLaunchOptions,
  showLaunchOptionsBackupsModal,
  confirmDeleteLaunchOptionsBackups,
}: AppLaunchOptionsAdvancedTabProps) {
  return (
    <Focusable
      key="advanced"
      navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD}
      style={{ height: "100%" }}
    >
      <ToggleField
        checked={getAppDisableAutoManageLaunchOptions(appid)}
        onChange={(value) => setAppDisableAutoManageLaunchOptions(appid, value)}
        description={
          'Decky Launch Options will not manage the "Launch Options" field for this app'
        }
        label={'Disable "Auto-manage Launch Options" for this app'}
        bottomSeparator={"none"}
      />
      {loadedLaunchOptionsAppid === appid &&
        getInfoQuery.data &&
        !appLaunchOptionsHasDloCommand && (
          <ButtonItem
            label={"Apply DLO command for this app"}
            description={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div>
                  <strong>Current:</strong>{" "}
                  {currentLaunchOptions.trim() || "(empty)"}
                </div>
              </div>
            }
            indentLevel={1}
            disabled={setDloLaunchOptionsMutation.isPending}
            onClick={() => {
              const info = getInfoQuery.data
              if (!info) return

              setDloLaunchOptionsMutation.mutate(
                {
                  appid: Number(appid),
                  currentLaunchOptions,
                  command: info.COMMAND,
                },
                {
                  onSuccess: (context) => {
                    toaster.toast({
                      title: "Applied DLO command",
                      body: context.currentLaunchOptions,
                      duration: 5000,
                    })
                  },
                  onError: (error) => {
                    toaster.toast({
                      title: "Failed to apply DLO command",
                      body: error.message,
                      duration: 5000,
                    })
                  },
                },
              )
            }}
          >
            Apply
          </ButtonItem>
        )}
      {getAppOriginalLaunchOptions(appid) && (
        <ButtonItem
          label={"Revert app launch options to original value"}
          description={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div>
                <strong>Current:</strong>{" "}
                {currentLaunchOptions.trim() || "(empty)"}
              </div>
              <div>
                <strong>Original:</strong>{" "}
                {getAppOriginalLaunchOptions(appid).trim() || "(empty)"}
              </div>
            </div>
          }
          indentLevel={1}
          disabled={!canManuallyChangeAppLaunchOptions}
          onClick={() => {
            setAppLaunchOptions(
              Number(appid),
              getAppOriginalLaunchOptions(appid),
            )
            setAppOriginalLaunchOptions(appid, "")
            toaster.toast({
              title: "App launch options reverted",
              body: getAppOriginalLaunchOptions(appid),
              duration: 5000,
            })
          }}
        >
          Revert
        </ButtonItem>
      )}
      {showResetAppLaunchOptions && (
        <ButtonItem
          label={"Reset app launch options to empty value"}
          description={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div>
                <strong>Current:</strong>{" "}
                {currentLaunchOptions.trim() || "(empty)"}
              </div>
              <div>
                <strong>Original:</strong> (empty)
              </div>
            </div>
          }
          indentLevel={1}
          disabled={!canManuallyChangeAppLaunchOptions}
          onClick={() => {
            setAppLaunchOptions(Number(appid), "")
            setAppOriginalLaunchOptions(appid, "")
            toaster.toast({
              title: "App launch options reset",
              body: "(empty)",
              duration: 5000,
            })
          }}
        >
          Reset
        </ButtonItem>
      )}
      <Field
        label={"Original launch options backups"}
        description={"Show backed up original launch options"}
        childrenLayout={"inline"}
      >
        <BackupActionButton
          label="Backups actions"
          actions={[
            {
              label: "Show",
              onSelected: showLaunchOptionsBackupsModal,
            },
            {
              label: "Delete all",
              tone: "destructive",
              onSelected: confirmDeleteLaunchOptionsBackups,
            },
          ]}
        />
      </Field>
    </Focusable>
  )
}
