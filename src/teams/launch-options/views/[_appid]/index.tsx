import { toaster } from "@decky/api"
import {
  ButtonItem,
  ConfirmModal,
  Field,
  findModule,
  Focusable,
  NavEntryPositionPreferences,
  PanelSectionRow,
  showModal,
  Tabs,
  TextField,
  ToggleField,
  useParams,
} from "@decky/ui"
import { useStore } from "@tanstack/react-store"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CreateLaunchOptionForm } from "../../../../components/create-launch-option-form"
import { showDeleteLaunchOptionModal } from "../../../../components/delete-launch-option-modal"
import { UpdateLaunchOptionForm } from "../../../../components/update-launch-option-form"
import { useSettings } from "../../../../hooks"
import {
  useDeleteOriginalLaunchOptionsBackupsMutation,
  useGetInfoQuery,
  useSetDloLaunchOptionsMutation,
} from "../../../../query"
import { LaunchOption } from "../../../../shared"
import { settingsStore } from "../../../../stores"
import {
  appLaunchOptionsIncludesSupportedDloCommand,
  appLaunchOptionsIsDloCommand,
  countActiveLaunchOptions,
  HierarchicalLaunchOption,
  LaunchOptionScope,
  setAppLaunchOptions,
  toHierarchicalLaunchOptions,
} from "../../../../utils"
import { BackupActionButton } from "../../components/backup-action-button"
import { InactiveAutoManageWarning } from "../../components/inactive-auto-manage-warning"
import { renderLaunchOptionItems } from "../../components/launch-option-list"
import { LaunchOptionsBackupsModal } from "../../components/launch-options-backups-modal"
import { ModalWrapper } from "../../components/modal-wrapper"
import { useAppLaunchOptionsState } from "../../hooks/use-app-launch-options-state"

const advancedTabId = "__advanced"

interface FocusTarget {
  id: string
  version: number
}

type GroupedLaunchOptions = Record<
  string,
  {
    local: HierarchicalLaunchOption[]
    global: HierarchicalLaunchOption[]
  }
>

export function AppLaunchOptionsPage() {
  const { appid } = useParams<{ appid: string }>()
  const [tab, setTab] = useState<string>("local")
  const { currentLaunchOptions, loadedLaunchOptionsAppid, isNonSteamApp } =
    useAppLaunchOptionsState(appid)
  const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
  const autoManageLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageLaunchOptions,
  )
  const autoManageNonSteamLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageNonSteamLaunchOptions,
  )
  const showCommands = useStore(settingsStore, (state) => state.showCommands)
  const launchOptionSort = useStore(
    settingsStore,
    (state) => state.launchOptionSort,
  )
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const focusTargetId = focusTarget?.id ?? null
  const setFocusTargetId = useCallback((id: string) => {
    setFocusTarget((target) => ({
      id,
      version: (target?.version ?? 0) + 1,
    }))
  }, [])
  const {
    settings,
    getAppLaunchOptionState,
    setAppLaunchOptionState,
    setAppValueIdState,
    getAppOriginalLaunchOptions,
    setAppOriginalLaunchOptions,
    getAppDisableAutoManageLaunchOptions,
    setAppDisableAutoManageLaunchOptions,
    getAppOverrideCommandEnabled,
    setAppOverrideCommandEnabled,
    getAppOverrideCommand,
    setAppOverrideCommand,
    duplicateLaunchOption,
    deleteLaunchOption,
    deleteLaunchOptionsByValueId,
  } = useSettings()
  const getInfoQuery = useGetInfoQuery()
  const setDloLaunchOptionsMutation = useSetDloLaunchOptionsMutation()
  const deleteOriginalLaunchOptionsBackupsMutation =
    useDeleteOriginalLaunchOptionsBackupsMutation()
  const autoManageCurrentApp = isNonSteamApp
    ? autoManageNonSteamLaunchOptions
    : autoManageLaunchOptions
  const appLaunchOptionsHasDloCommand = getInfoQuery.data
    ? appLaunchOptionsIncludesSupportedDloCommand(
        currentLaunchOptions,
        getInfoQuery.data,
      )
    : true
  const showInactiveAutoManageWarning =
    (!autoManageCurrentApp || getAppDisableAutoManageLaunchOptions(appid)) &&
    !appLaunchOptionsHasDloCommand
  const canManuallyChangeAppLaunchOptions =
    !autoManageCurrentApp || getAppDisableAutoManageLaunchOptions(appid)
  const showResetAppLaunchOptions =
    !getAppOriginalLaunchOptions(appid).trim() &&
    appLaunchOptionsIsDloCommand(currentLaunchOptions, getInfoQuery.data)
  const globalValueIds = useMemo(() => {
    const valueIds = new Set<string>()
    settings.launchOptions.forEach((item) => {
      if (item.valueId && item.enableGlobally) {
        valueIds.add(item.valueId)
      }
    })
    return valueIds
  }, [settings.launchOptions])

  const isLaunchOptionGlobal = useCallback(
    (item: LaunchOption) => {
      if (item.valueId) {
        return globalValueIds.has(item.valueId)
      }
      return item.enableGlobally
    },
    [globalValueIds],
  )

  const groups = useMemo(() => {
    const groupSet = new Set<string>()
    settings.launchOptions.forEach((item) => {
      if (item.group) groupSet.add(item.group)
    })
    return Array.from(groupSet).sort((a, b) => a.localeCompare(b))
  }, [settings])
  const groupedLaunchOptions = useMemo(() => {
    const map: GroupedLaunchOptions = {}
    for (const group of groups) {
      const inGroup = settings.launchOptions.filter(
        (item) => item.group === group,
      )
      const localFiltered = inGroup.filter(
        (item) => !isLaunchOptionGlobal(item),
      )
      const globalFiltered = inGroup.filter((item) =>
        isLaunchOptionGlobal(item),
      )
      map[group] = {
        local: toHierarchicalLaunchOptions(
          localFiltered,
          useHierarchy,
          launchOptionSort,
          appid,
          getAppLaunchOptionState,
        ),
        global: toHierarchicalLaunchOptions(
          globalFiltered,
          useHierarchy,
          launchOptionSort,
          appid,
          getAppLaunchOptionState,
        ),
      }
    }
    return map
  }, [
    settings,
    groups,
    useHierarchy,
    launchOptionSort,
    appid,
    getAppLaunchOptionState,
    isLaunchOptionGlobal,
  ])
  const localLaunchOptions = useMemo(() => {
    const filtered = settings.launchOptions.filter(
      (item) => !isLaunchOptionGlobal(item) && !item.group,
    )
    return toHierarchicalLaunchOptions(
      filtered,
      useHierarchy,
      launchOptionSort,
      appid,
      getAppLaunchOptionState,
    )
  }, [
    settings,
    useHierarchy,
    launchOptionSort,
    appid,
    getAppLaunchOptionState,
    isLaunchOptionGlobal,
  ])
  const globalLaunchOptions = useMemo(() => {
    const filtered = settings.launchOptions.filter(
      (item) => isLaunchOptionGlobal(item) && !item.group,
    )
    return toHierarchicalLaunchOptions(
      filtered,
      useHierarchy,
      launchOptionSort,
      appid,
      getAppLaunchOptionState,
    )
  }, [
    settings,
    useHierarchy,
    launchOptionSort,
    appid,
    getAppLaunchOptionState,
    isLaunchOptionGlobal,
  ])
  const groupSectionOrder: LaunchOptionScope[] = launchOptionSort.startsWith(
    "global",
  )
    ? ["global", "local"]
    : ["local", "global"]
  const { TabCount } = findModule((mod) => {
    if (typeof mod !== "object") return false

    if (mod.TabCount && mod.TabTitle) {
      return true
    }

    return false
  })

  // this fixes weird issues when switching tab by forcing the blur on the active element (no document.activeElement.blur doesn't work)
  const [readyToShow, setReadyToShow] = useState(true)
  useEffect(() => {
    setReadyToShow(false)
    const timeout = window.setTimeout(() => {
      setReadyToShow(true)
    }, 100)

    return () => window.clearTimeout(timeout)
  }, [tab])
  const showCreateLaunchOptionFormModal = useCallback(() => {
    const isGroupTab =
      tab !== "local" && tab !== "global" && tab !== advancedTabId
    const modalResult = showModal(
      <ModalWrapper
        title="Add launch option"
        onClose={() => modalResult.Close()}
      >
        <CreateLaunchOptionForm
          defaultValue={{
            enableGlobally: tab === "global",
            ...(isGroupTab ? { group: tab } : {}),
          }}
          onSubmit={() => modalResult.Close()}
        />
      </ModalWrapper>,
    )
  }, [tab])

  const showUpdateLaunchOptionFormModal = useCallback(
    (id: string) => {
      const modalResult = showModal(
        <ModalWrapper
          title="Edit launch option"
          onClose={() => modalResult.Close()}
        >
          <UpdateLaunchOptionForm
            id={id}
            onDelete={() => modalResult.Close()}
            deleteByValueId
          />
        </ModalWrapper>,
      )
    },
    [appid],
  )
  const showLaunchOptionsBackupsModal = useCallback(() => {
    const modalResult = showModal(
      <ModalWrapper
        title="Original launch options backups"
        onClose={() => modalResult.Close()}
      >
        <LaunchOptionsBackupsModal
          appid={appid}
          onRestore={(command) => {
            setAppOriginalLaunchOptions(appid, command)
            modalResult.Close()
          }}
        />
      </ModalWrapper>,
    )
  }, [appid, setAppOriginalLaunchOptions])
  const confirmDeleteLaunchOptionsBackups = useCallback(() => {
    showModal(
      <ConfirmModal
        strTitle="Delete original launch options backups"
        strDescription="Do you want to delete all original launch options backups for this app?"
        strOKButtonText="Confirm"
        strCancelButtonText="Cancel"
        onOK={async () => {
          deleteOriginalLaunchOptionsBackupsMutation.mutate({ appid })
        }}
      />,
    )
  }, [appid, deleteOriginalLaunchOptionsBackupsMutation])
  const confirmDeleteLaunchOption = useCallback(
    (id: string) => {
      const launchOption = settings.launchOptions.find((item) => item.id === id)
      if (!launchOption) return

      const deleteGroup = !!launchOption.valueId
      const deleteCount = deleteGroup
        ? settings.launchOptions.filter(
            (item) => item.valueId === launchOption.valueId,
          ).length
        : undefined
      showDeleteLaunchOptionModal({
        launchOption,
        deleteGroup,
        deleteCount,
        onDelete: () => {
          if (deleteGroup) {
            deleteLaunchOptionsByValueId(launchOption.valueId)
          } else {
            deleteLaunchOption(launchOption.id)
          }
        },
      })
    },
    [deleteLaunchOption, deleteLaunchOptionsByValueId, settings.launchOptions],
  )
  const handleShowTab = useCallback((nextTab: string) => {
    setFocusTarget(null)
    setTab(nextTab)
  }, [])

  return (
    <div
      style={{
        marginTop: "40px",
        height: "calc(100% - 40px - 42px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs
          activeTab={tab}
          onShowTab={handleShowTab}
          autoFocusContents
          tabs={[
            {
              id: advancedTabId,
              title: "Advanced",
              content: readyToShow && (
                <Focusable
                  key="advanced"
                  navEntryPreferPosition={
                    NavEntryPositionPreferences.PREFERRED_CHILD
                  }
                  style={{ height: "100%" }}
                >
                  <ToggleField
                    checked={getAppDisableAutoManageLaunchOptions(appid)}
                    onChange={(value) =>
                      setAppDisableAutoManageLaunchOptions(appid, value)
                    }
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
                                if (!context.hasShellScript) {
                                  toaster.toast({
                                    title: "DLO command not applied",
                                    body: "The DLO launcher script is missing.",
                                    duration: 5000,
                                    critical: true,
                                  })
                                  return
                                }

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
                            {getAppOriginalLaunchOptions(appid).trim() ||
                              "(empty)"}
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
                  <ToggleField
                    checked={getAppOverrideCommandEnabled(appid)}
                    onChange={(value) =>
                      setAppOverrideCommandEnabled(appid, value)
                    }
                    description={"Replace Steam's command for this app"}
                    label={"Enable %command% override"}
                    bottomSeparator={"none"}
                  />
                  {getAppOverrideCommandEnabled(appid) && (
                    <Field
                      childrenLayout={"below"}
                      label={"Override command"}
                      description={
                        "A value is required to enable override"
                      }
                      indentLevel={1}
                    >
                      <TextField
                        {...{
                          placeholder:
                            "/path/to/another/app.extension",
                        }}
                        style={{ width: "100%" }}
                        value={getAppOverrideCommand(appid)}
                        onChange={(event) =>
                          setAppOverrideCommand(appid, event.target.value)
                        }
                      />
                    </Field>
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
                  <Field
                    childrenLayout={"below"}
                    label={"Original launch options"}
                  >
                    <TextField
                      value={getAppOriginalLaunchOptions(appid)}
                      onChange={(e) =>
                        setAppOriginalLaunchOptions(appid, e.target.value)
                      }
                    />
                  </Field>
                  {renderLaunchOptionItems({
                    items: localLaunchOptions,
                    savedLaunchOptions: settings.launchOptions,
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
                  settings.launchOptions,
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
                    savedLaunchOptions: settings.launchOptions,
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
                  settings.launchOptions,
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
                          <strong>
                            {scope === "local" ? "Local" : "Global"}
                          </strong>
                        </div>
                        {renderLaunchOptionItems({
                          items,
                          savedLaunchOptions: settings.launchOptions,
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
                  settings.launchOptions,
                  appid,
                  getAppLaunchOptionState,
                  (item) => item.group === group,
                )
                return <span className={TabCount}>{count}</span>
              },
            })),
          ]}
        />
      </div>
    </div>
  )
}
