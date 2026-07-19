import { ConfirmModal, showModal, useParams } from "@decky/ui"
import { AppDetails } from "@decky/ui/dist/globals/steam-client/App"
import { useStore } from "@tanstack/react-store"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CreateLaunchOptionForm } from "../../../../components/create-launch-option-form"
import { showDeleteLaunchOptionModal } from "../../../../components/delete-launch-option-modal"
import { UpdateLaunchOptionForm } from "../../../../components/update-launch-option-form"
import { useSettings } from "../../../../hooks"
import {
  get_shortcut_launch_options,
  useDeleteOriginalLaunchOptionsBackupsMutation,
  useGetInfoQuery,
  useSetDloLaunchOptionsMutation,
} from "../../../../query"
import { LaunchOption } from "../../../../shared"
import { settingsStore } from "../../../../stores"
import {
  AppLaunchOptionsUpdatedEvent,
  appLaunchOptionsIncludesSupportedDloCommand,
  appLaunchOptionsIsDloCommand,
  appLaunchOptionsUpdatedEventType,
  LaunchOptionScope,
  toHierarchicalLaunchOptions,
} from "../../../../utils"
import {
  AppLaunchOptionsTabs,
  FocusTarget,
  GroupedLaunchOptions,
} from "../../components/app-launch-options-tabs"
import { LaunchOptionsBackupsModal } from "../../components/launch-options-backups-modal"
import { ModalWrapper } from "../../components/modal-wrapper"

const advancedTabId = "__advanced"

export function AppLaunchOptionsPage() {
  const { appid } = useParams<{ appid: string }>()
  const [tab, setTab] = useState<string>("local")
  const [currentLaunchOptions, setCurrentLaunchOptions] = useState("")
  const [loadedLaunchOptionsAppid, setLoadedLaunchOptionsAppid] = useState<
    string | null
  >(null)
  const locallySetLaunchOptionsRef = useRef<string | undefined>(undefined)
  const [isNonSteamApp, setIsNonSteamApp] = useState(false)
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

  // this fixes weird issues when switching tab by forcing the blur on the active element (no document.activeElement.blur doesn't work)
  const [readyToShow, setReadyToShow] = useState(true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (timeoutRef.current) clearInterval(timeoutRef.current)
    timeoutRef.current = setInterval(() => {
      setReadyToShow(true)
    }, 100)
    setReadyToShow(false)
  }, [tab])
  useEffect(() => {
    locallySetLaunchOptionsRef.current = undefined
    setCurrentLaunchOptions("")
    setLoadedLaunchOptionsAppid(null)
    setIsNonSteamApp(false)
  }, [appid])
  useEffect(() => {
    const handleAppLaunchOptionsUpdated = (event: Event) => {
      const { detail } = event as AppLaunchOptionsUpdatedEvent
      if (detail.appid >>> 0 !== Number(appid) >>> 0) return

      locallySetLaunchOptionsRef.current = detail.launchOptions
      setCurrentLaunchOptions(detail.launchOptions)
      setLoadedLaunchOptionsAppid(appid)
    }

    window.addEventListener(
      appLaunchOptionsUpdatedEventType,
      handleAppLaunchOptionsUpdated,
    )

    return () => {
      window.removeEventListener(
        appLaunchOptionsUpdatedEventType,
        handleAppLaunchOptionsUpdated,
      )
    }
  }, [appid])
  useEffect(() => {
    let cancelled = false
    const { unregister } = SteamClient.Apps.RegisterForAppDetails(
      Number(appid),
      (details: AppDetails) => {
        const appDetails = details as AppDetails & {
          strLaunchOptions?: string
          strShortcutExe?: unknown
        }
        const currentSteamLaunchOptions = appDetails.strLaunchOptions ?? ""
        const isNonSteam = typeof appDetails.strShortcutExe !== "undefined"
        if (!cancelled) setIsNonSteamApp(isNonSteam)
        const setLaunchOptions = (
          launchOptions: string,
          hasAuthoritativeLaunchOptions: boolean = true,
        ) => {
          if (!cancelled) {
            const locallySetLaunchOptions = locallySetLaunchOptionsRef.current
            setCurrentLaunchOptions(
              isNonSteam
                ? (locallySetLaunchOptions ?? launchOptions)
                : launchOptions,
            )
            setLoadedLaunchOptionsAppid(
              hasAuthoritativeLaunchOptions ||
                locallySetLaunchOptions !== undefined
                ? appid
                : null,
            )
          }
        }

        if (isNonSteam) {
          get_shortcut_launch_options(appid).then(
            (launchOptions) => {
              if (launchOptions === null) {
                setLaunchOptions(currentSteamLaunchOptions, false)
                return
              }

              setLaunchOptions(launchOptions)
            },
            () => setLaunchOptions(currentSteamLaunchOptions, false),
          )
        } else {
          setLaunchOptions(currentSteamLaunchOptions)
        }
      },
    )

    return () => {
      cancelled = true
      unregister()
    }
  }, [appid])
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
        <AppLaunchOptionsTabs
          appid={appid}
          tab={tab}
          handleShowTab={handleShowTab}
          readyToShow={readyToShow}
          focusTarget={focusTarget}
          focusTargetId={focusTargetId}
          setFocusTargetId={setFocusTargetId}
          isNonSteamApp={isNonSteamApp}
          showInactiveAutoManageWarning={showInactiveAutoManageWarning}
          loadedLaunchOptionsAppid={loadedLaunchOptionsAppid}
          currentLaunchOptions={currentLaunchOptions}
          appLaunchOptionsHasDloCommand={appLaunchOptionsHasDloCommand}
          canManuallyChangeAppLaunchOptions={canManuallyChangeAppLaunchOptions}
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
          getAppLaunchOptionState={getAppLaunchOptionState}
          setAppLaunchOptionState={setAppLaunchOptionState}
          setAppValueIdState={setAppValueIdState}
          duplicateLaunchOption={duplicateLaunchOption}
          showCreateLaunchOptionFormModal={showCreateLaunchOptionFormModal}
          showUpdateLaunchOptionFormModal={showUpdateLaunchOptionFormModal}
          showLaunchOptionsBackupsModal={showLaunchOptionsBackupsModal}
          confirmDeleteLaunchOptionsBackups={confirmDeleteLaunchOptionsBackups}
          confirmDeleteLaunchOption={confirmDeleteLaunchOption}
          localLaunchOptions={localLaunchOptions}
          globalLaunchOptions={globalLaunchOptions}
          savedLaunchOptions={settings.launchOptions}
          showCommands={showCommands}
          groups={groups}
          groupedLaunchOptions={groupedLaunchOptions}
          groupSectionOrder={groupSectionOrder}
          isLaunchOptionGlobal={isLaunchOptionGlobal}
        />
      </div>
    </div>
  )
}
