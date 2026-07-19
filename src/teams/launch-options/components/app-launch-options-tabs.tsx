import {
  ButtonItem,
  Field,
  findModule,
  Focusable,
  NavEntryPositionPreferences,
  PanelSectionRow,
  Tabs,
  TextField,
} from "@decky/ui"
import type { useSettings } from "../../../hooks"
import type {
  useGetInfoQuery,
  useSetDloLaunchOptionsMutation,
} from "../../../query"
import { LaunchOption } from "../../../shared"
import {
  countActiveLaunchOptions,
  HierarchicalLaunchOption,
  LaunchOptionScope,
} from "../../../utils"
import { AppLaunchOptionsAdvancedTab } from "./app-launch-options-advanced-tab"
import { InactiveAutoManageWarning } from "./inactive-auto-manage-warning"
import { renderLaunchOptionItems } from "./launch-option-list"

type SettingsActions = ReturnType<typeof useSettings>

export interface FocusTarget {
  id: string
  version: number
}

export type GroupedLaunchOptions = Record<
  string,
  {
    local: HierarchicalLaunchOption[]
    global: HierarchicalLaunchOption[]
  }
>

interface AppLaunchOptionsTabsProps {
  appid: string
  tab: string
  handleShowTab: (nextTab: string) => void
  readyToShow: boolean
  focusTarget: FocusTarget | null
  focusTargetId: string | null
  setFocusTargetId: (id: string) => void
  isNonSteamApp: boolean
  showInactiveAutoManageWarning: boolean
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
  getAppLaunchOptionState: SettingsActions["getAppLaunchOptionState"]
  setAppLaunchOptionState: SettingsActions["setAppLaunchOptionState"]
  setAppValueIdState: SettingsActions["setAppValueIdState"]
  duplicateLaunchOption: SettingsActions["duplicateLaunchOption"]
  showCreateLaunchOptionFormModal: () => void
  showUpdateLaunchOptionFormModal: (id: string) => void
  showLaunchOptionsBackupsModal: () => void
  confirmDeleteLaunchOptionsBackups: () => void
  confirmDeleteLaunchOption: (id: string) => void
  localLaunchOptions: HierarchicalLaunchOption[]
  globalLaunchOptions: HierarchicalLaunchOption[]
  savedLaunchOptions: LaunchOption[]
  showCommands: boolean
  groups: string[]
  groupedLaunchOptions: GroupedLaunchOptions
  groupSectionOrder: LaunchOptionScope[]
  isLaunchOptionGlobal: (item: LaunchOption) => boolean
}

export function AppLaunchOptionsTabs({
  appid,
  tab,
  handleShowTab,
  readyToShow,
  focusTarget,
  focusTargetId,
  setFocusTargetId,
  isNonSteamApp,
  showInactiveAutoManageWarning,
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
  getAppLaunchOptionState,
  setAppLaunchOptionState,
  setAppValueIdState,
  duplicateLaunchOption,
  showCreateLaunchOptionFormModal,
  showUpdateLaunchOptionFormModal,
  showLaunchOptionsBackupsModal,
  confirmDeleteLaunchOptionsBackups,
  confirmDeleteLaunchOption,
  localLaunchOptions,
  globalLaunchOptions,
  savedLaunchOptions,
  showCommands,
  groups,
  groupedLaunchOptions,
  groupSectionOrder,
  isLaunchOptionGlobal,
}: AppLaunchOptionsTabsProps) {
  const { TabCount } = findModule((mod) => {
    if (typeof mod !== "object") return false

    if (mod.TabCount && mod.TabTitle) {
      return true
    }

    return false
  })

  return (
    <Tabs
      activeTab={tab}
      onShowTab={handleShowTab}
      autoFocusContents
      tabs={[
        {
          id: "__advanced",
          title: "Advanced",
          content: readyToShow && (
            <AppLaunchOptionsAdvancedTab
              appid={appid}
              loadedLaunchOptionsAppid={loadedLaunchOptionsAppid}
              currentLaunchOptions={currentLaunchOptions}
              appLaunchOptionsHasDloCommand={appLaunchOptionsHasDloCommand}
              canManuallyChangeAppLaunchOptions={
                canManuallyChangeAppLaunchOptions
              }
              showResetAppLaunchOptions={showResetAppLaunchOptions}
              getInfoQuery={getInfoQuery}
              setDloLaunchOptionsMutation={setDloLaunchOptionsMutation}
              getAppDisableAutoManageLaunchOptions={
                getAppDisableAutoManageLaunchOptions
              }
              setAppDisableAutoManageLaunchOptions={
                setAppDisableAutoManageLaunchOptions
              }
              getAppOriginalLaunchOptions={getAppOriginalLaunchOptions}
              setAppOriginalLaunchOptions={setAppOriginalLaunchOptions}
              showLaunchOptionsBackupsModal={showLaunchOptionsBackupsModal}
              confirmDeleteLaunchOptionsBackups={
                confirmDeleteLaunchOptionsBackups
              }
            />
          ),
        },
        {
          id: "local",
          title: "Local",
          content: readyToShow && (
            <Focusable
              key={`local-${focusTarget?.version ?? 0}`}
              navEntryPreferPosition={
                NavEntryPositionPreferences.PREFERRED_CHILD
              }
              style={{ height: "100%" }}
            >
              {showInactiveAutoManageWarning && (
                <InactiveAutoManageWarning isNonSteamApp={isNonSteamApp} />
              )}
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={() => {
                    showCreateLaunchOptionFormModal()
                  }}
                >
                  Add launch option
                </ButtonItem>
              </PanelSectionRow>
              <Field childrenLayout={"below"} label={"Original launch options"}>
                <TextField
                  value={getAppOriginalLaunchOptions(appid)}
                  onChange={(e) =>
                    setAppOriginalLaunchOptions(appid, e.target.value)
                  }
                />
              </Field>
              {renderLaunchOptionItems({
                items: localLaunchOptions,
                savedLaunchOptions,
                appid,
                showCommands,
                getAppLaunchOptionState,
                setAppLaunchOptionState,
                setAppValueIdState,
                setValueAsDefault: false,
                focusTargetId,
                setFocusTargetId,
                onEdit: showUpdateLaunchOptionFormModal,
                onDuplicate: duplicateLaunchOption,
                onDelete: confirmDeleteLaunchOption,
              })}
            </Focusable>
          ),
          renderTabAddon: () => {
            const count = countActiveLaunchOptions(
              savedLaunchOptions,
              appid,
              getAppLaunchOptionState,
              (item) => !isLaunchOptionGlobal(item) && !item.group,
            )
            return (
              <span className={TabCount}>
                {count + Number(!!getAppOriginalLaunchOptions(appid))}
              </span>
            )
          },
        },
        {
          id: "global",
          title: "Global",
          content: readyToShow && (
            <Focusable
              key={`global-${focusTarget?.version ?? 0}`}
              navEntryPreferPosition={
                NavEntryPositionPreferences.PREFERRED_CHILD
              }
              style={{ height: "100%" }}
            >
              {showInactiveAutoManageWarning && (
                <InactiveAutoManageWarning isNonSteamApp={isNonSteamApp} />
              )}
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={() => {
                    showCreateLaunchOptionFormModal()
                  }}
                >
                  Add launch option
                </ButtonItem>
              </PanelSectionRow>
              {renderLaunchOptionItems({
                items: globalLaunchOptions,
                savedLaunchOptions,
                appid,
                showCommands,
                getAppLaunchOptionState,
                setAppLaunchOptionState,
                setAppValueIdState,
                setValueAsDefault: true,
                focusTargetId,
                setFocusTargetId,
                onEdit: showUpdateLaunchOptionFormModal,
                onDuplicate: duplicateLaunchOption,
                onDelete: confirmDeleteLaunchOption,
              })}
            </Focusable>
          ),
          renderTabAddon: () => {
            const count = countActiveLaunchOptions(
              savedLaunchOptions,
              appid,
              getAppLaunchOptionState,
              (item) => isLaunchOptionGlobal(item) && !item.group,
            )
            return <span className={TabCount}>{count}</span>
          },
        },
        ...groups.map((group) => ({
          id: group,
          title: group,
          content: readyToShow && (
            <Focusable
              key={`group-${group}-${focusTarget?.version ?? 0}`}
              navEntryPreferPosition={
                NavEntryPositionPreferences.PREFERRED_CHILD
              }
              style={{ height: "100%" }}
            >
              {showInactiveAutoManageWarning && (
                <InactiveAutoManageWarning isNonSteamApp={isNonSteamApp} />
              )}
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={() => {
                    showCreateLaunchOptionFormModal()
                  }}
                >
                  Add launch option
                </ButtonItem>
              </PanelSectionRow>
              {groupSectionOrder.map((scope) => {
                const items = groupedLaunchOptions[group]?.[scope] ?? []
                if (items.length === 0) return null

                return (
                  <div key={scope}>
                    <div style={{ marginTop: "16px" }}>
                      <strong>{scope === "local" ? "Local" : "Global"}</strong>
                    </div>
                    {renderLaunchOptionItems({
                      items,
                      savedLaunchOptions,
                      appid,
                      showCommands,
                      getAppLaunchOptionState,
                      setAppLaunchOptionState,
                      setAppValueIdState,
                      setValueAsDefault: scope === "global",
                      focusTargetId,
                      setFocusTargetId,
                      onEdit: showUpdateLaunchOptionFormModal,
                      onDuplicate: duplicateLaunchOption,
                      onDelete: confirmDeleteLaunchOption,
                    })}
                  </div>
                )
              })}
            </Focusable>
          ),
          renderTabAddon: () => {
            const count = countActiveLaunchOptions(
              savedLaunchOptions,
              appid,
              getAppLaunchOptionState,
              (item) => item.group === group,
            )
            return <span className={TabCount}>{count}</span>
          },
        })),
      ]}
    />
  )
}
