import {
  ButtonItem,
  DialogBody,
  DialogHeader,
  Dropdown,
  Field,
  findModule,
  Focusable,
  ModalRoot,
  NavEntryPositionPreferences,
  PanelSectionRow,
  showModal,
  Tabs,
  TextField,
  Toggle,
  ToggleField,
  useParams,
} from "@decky/ui"
import { SingleDropdownOption } from "@decky/ui/dist/components/Dropdown"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSettings } from "../../../../hooks"
import { UpdateLaunchOptionForm } from "../../../../components/update-launch-option-form"
import { showDeleteLaunchOptionModal } from "../../../../components/delete-launch-option-modal"
import { PluginProvider } from "../../../../components/plugin-provider"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  queryClient,
  useGetOriginalLaunchOptionsBackupsQuery,
} from "../../../../query"
import { CreateLaunchOptionForm } from "../../../../components/create-launch-option-form"
import { LaunchOption } from "../../../../shared"
import { settingsStore, type LaunchOptionSort } from "../../../../stores"
import { useStore } from "@tanstack/react-store"
import { LaunchOptionActionButton } from "../../../../components/launch-option-action-button"

type LaunchOptionScope = "local" | "global"

const advancedTabId = "__advanced"

interface FocusTarget {
  id: string
  version: number
}

interface HierarchicalLaunchOption {
  launchOption: LaunchOption
  displayName: string
  indentLevel: number
}

interface HierarchicalLaunchOptionNode {
  item: HierarchicalLaunchOption
  children: HierarchicalLaunchOptionNode[]
  isActive: boolean
  originalIndex: number
}

function compareLaunchOptionsAlphabetically(
  a: LaunchOption,
  b: LaunchOption,
): number {
  const name = a.name.localeCompare(b.name)
  if (name !== 0) return name

  const valueName = (a.valueName ?? "").localeCompare(b.valueName ?? "")
  if (valueName !== 0) return valueName

  const on = (a.on ?? "").localeCompare(b.on ?? "")
  if (on !== 0) return on

  return a.id.localeCompare(b.id)
}

function isLaunchOptionActive(
  item: LaunchOption,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): boolean {
  const isActive = getAppLaunchOptionState(appid, item.id)
  return isActive ? !!item.on : !!item.off
}

function sortLaunchOptions(
  options: LaunchOption[],
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
  sortActive: boolean = sortMode.endsWith("-active"),
): LaunchOption[] {
  return [...options].sort((a, b) => {
    if (sortActive) {
      const active =
        Number(isLaunchOptionActive(b, appid, getAppLaunchOptionState)) -
        Number(isLaunchOptionActive(a, appid, getAppLaunchOptionState))
      if (active !== 0) return active
    }

    return compareLaunchOptionsAlphabetically(a, b)
  })
}

function sortHierarchicalLaunchOptions(
  items: HierarchicalLaunchOption[],
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): HierarchicalLaunchOption[] {
  if (!sortMode.endsWith("-active")) return items

  const roots: HierarchicalLaunchOptionNode[] = []
  const stack: HierarchicalLaunchOptionNode[] = []

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const node: HierarchicalLaunchOptionNode = {
      item,
      children: [],
      isActive: isLaunchOptionActive(
        item.launchOption,
        appid,
        getAppLaunchOptionState,
      ),
      originalIndex: index,
    }

    while (
      stack.length > 0 &&
      stack[stack.length - 1].item.indentLevel >= item.indentLevel
    ) {
      stack.pop()
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  const sortNodes = (nodes: HierarchicalLaunchOptionNode[]): boolean => {
    let hasActiveNode = false

    for (const node of nodes) {
      node.isActive = sortNodes(node.children) || node.isActive
      hasActiveNode = node.isActive || hasActiveNode
    }

    nodes.sort((a, b) => {
      const active = Number(b.isActive) - Number(a.isActive)
      if (active !== 0) return active

      const alphabetical = compareLaunchOptionsAlphabetically(
        a.item.launchOption,
        b.item.launchOption,
      )
      if (alphabetical !== 0) return alphabetical

      return a.originalIndex - b.originalIndex
    })

    return hasActiveNode
  }

  const flattenNodes = (
    nodes: HierarchicalLaunchOptionNode[],
  ): HierarchicalLaunchOption[] => {
    const result: HierarchicalLaunchOption[] = []

    for (const node of nodes) {
      result.push(node.item)
      result.push(...flattenNodes(node.children))
    }

    return result
  }

  sortNodes(roots)
  return flattenNodes(roots)
}

function toHierarchicalLaunchOptions(
  options: LaunchOption[],
  useHierarchy: boolean,
  sortMode: LaunchOptionSort,
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
): HierarchicalLaunchOption[] {
  if (!useHierarchy) {
    return sortLaunchOptions(
      options,
      sortMode,
      appid,
      getAppLaunchOptionState,
    ).map((item) => ({
      launchOption: item,
      displayName: item.name,
      indentLevel: 0,
    }))
  }

  const alphabetical = sortLaunchOptions(
    options,
    sortMode,
    appid,
    getAppLaunchOptionState,
    false,
  )
  return sortHierarchicalLaunchOptions(
    buildHierarchy(alphabetical),
    sortMode,
    appid,
    getAppLaunchOptionState,
  )
}

function buildHierarchy(options: LaunchOption[]): HierarchicalLaunchOption[] {
  const result: HierarchicalLaunchOption[] = []

  // Track which options have been processed as children
  const processed = new Set<string>()

  function findChildren(
    parent: LaunchOption,
    parentIndent: number,
    parentPrefix: string,
  ): HierarchicalLaunchOption[] {
    const children: HierarchicalLaunchOption[] = []

    for (const option of options) {
      if (processed.has(option.id) || option.id === parent.id) continue

      // Check if this option starts with the parent's name (plus a space)
      if (option.name.startsWith(parentPrefix + " ")) {
        processed.add(option.id)
        const displayName = option.name
          .substring(parentPrefix.length + 1)
          .trim()

        children.push({
          launchOption: option,
          displayName,
          indentLevel: parentIndent + 1,
        })

        // Recursively find children of this child
        const grandchildren = findChildren(
          option,
          parentIndent + 1,
          option.name,
        )
        children.push(...grandchildren)
      }
    }

    return children
  }

  // First pass: identify root-level items and build hierarchy
  for (const option of options) {
    if (processed.has(option.id)) continue

    // Add the root item
    result.push({
      launchOption: option,
      displayName: option.name,
      indentLevel: 0,
    })
    processed.add(option.id)

    // Find and add all children recursively
    const children = findChildren(option, 0, option.name)
    result.push(...children)
  }

  return result
}

interface ModalWrapperProps {
  title: string
  children: React.ReactNode
  onClose: () => void
}

function ModalWrapper({ title, children, onClose }: ModalWrapperProps) {
  return (
    <ModalRoot onCancel={onClose}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <QueryClientProvider client={queryClient}>
          <PluginProvider>{children}</PluginProvider>
        </QueryClientProvider>
      </DialogBody>
    </ModalRoot>
  )
}

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

function LaunchOptionsBackupsModal({
  appid,
  onRestore,
}: LaunchOptionsBackupsModalProps) {
  const backupsQuery = useGetOriginalLaunchOptionsBackupsQuery(appid)
  const backups = backupsQuery.data ?? []

  if (backupsQuery.isLoading) {
    return <div>Loading backups...</div>
  }

  if (!backups.length) {
    return <div>No launch option backups found for this app.</div>
  }

  return (
    <Focusable>
      {backups.map((backup) => (
        <ButtonItem
          key={`${backup.date}:${backup.command}`}
          label={formatBackupDate(backup.date)}
          description={backup.command || "(empy)"}
          onClick={() => onRestore(backup.command)}
        >
          Restore
        </ButtonItem>
      ))}
    </Focusable>
  )
}

interface LaunchOptionItemProps {
  launchOption: LaunchOption
  displayName: string
  indentLevel: number
  isChecked: boolean
  showCommands: boolean
  focusTargetId: string | null
  setFocusTargetId: (id: string) => void
  onToggle: (value: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function LaunchOptionItem({
  launchOption,
  displayName,
  indentLevel,
  isChecked,
  showCommands,
  focusTargetId,
  setFocusTargetId,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: LaunchOptionItemProps) {
  const activeColor = "oklch(80.9% 0.105 251.813)"
  const focusId = `launch-option:${launchOption.id}`
  const description = showCommands ? (
    <span style={{ color: "oklch(55.4% 0.046 257.417)" }}>
      {launchOption.on && (
        <span style={{ color: isChecked ? activeColor : undefined }}>
          ON: {launchOption.on}
        </span>
      )}
      {launchOption.on && launchOption.off && " | "}
      {launchOption.off && (
        <span style={{ color: !isChecked ? activeColor : undefined }}>
          OFF: {launchOption.off}
        </span>
      )}
      {!launchOption.on && !launchOption.off && "None"}
    </span>
  ) : undefined

  return (
    <Field
      indentLevel={indentLevel}
      label={displayName}
      description={description}
      childrenLayout={"inline"}
    >
      <Focusable
        autoFocus={focusTargetId === focusId}
        style={{ display: "flex", gap: 10, alignItems: "center" }}
      >
        <Toggle
          value={isChecked}
          onChange={(value) => {
            setFocusTargetId(focusId)
            onToggle(value)
          }}
        />
        <LaunchOptionActionButton
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </Focusable>
    </Field>
  )
}

interface ValueIdSelectItemProps {
  valueId: string
  launchOptions: LaunchOption[]
  displayName: string
  indentLevel: number
  appid: string
  showCommands: boolean
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean
  setAppValueIdState: (
    appid: string,
    valueId: string,
    selectedLaunchOptionId: string,
    setAsDefault?: boolean,
  ) => void
  setValueAsDefault: boolean
  focusTargetId: string | null
  setFocusTargetId: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function ValueIdSelectItem({
  valueId,
  launchOptions,
  displayName,
  indentLevel,
  appid,
  showCommands,
  getAppLaunchOptionState,
  setAppValueIdState,
  setValueAsDefault,
  focusTargetId,
  setFocusTargetId,
  onEdit,
  onDuplicate,
  onDelete,
}: ValueIdSelectItemProps) {
  const activeColor = "oklch(80.9% 0.105 251.813)"
  const focusId = `value-id:${valueId}`

  const selectedOption = launchOptions.find((lo) =>
    getAppLaunchOptionState(appid, lo.id),
  )
  const selectedId = selectedOption?.id ?? launchOptions[0]?.id ?? null

  const rgOptions = launchOptions
    .map((lo) => ({
      data: lo.id,
      label: (lo.valueName || lo.on || lo.name) + "\u00A0\u00A0",
      _emptyOn: !lo.on,
      _fallback: !!lo.fallbackValue,
    }))
    .sort((a, b) => {
      if (a._emptyOn !== b._emptyOn) return a._emptyOn ? -1 : 1
      if (a._fallback !== b._fallback) return a._fallback ? -1 : 1
      return a.label.localeCompare(b.label)
    })

  const description = showCommands ? (
    <span style={{ color: "oklch(55.4% 0.046 257.417)" }}>
      {selectedOption?.on ? (
        <span style={{ color: activeColor }}>ON: {selectedOption.on}</span>
      ) : (
        selectedOption?.valueName || selectedOption?.name || "None"
      )}
    </span>
  ) : undefined

  return (
    <Field
      indentLevel={indentLevel}
      label={displayName}
      description={description}
      childrenLayout={"inline"}
    >
      <Focusable
        autoFocus={focusTargetId === focusId}
        style={{ display: "flex", gap: 10, alignItems: "center" }}
      >
        <Focusable style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "stretch",
              minWidth: 200,
            }}
          >
            <Dropdown
              rgOptions={rgOptions}
              selectedOption={selectedId}
              onChange={(option: SingleDropdownOption) => {
                setFocusTargetId(focusId)
                setAppValueIdState(
                  appid,
                  valueId,
                  option.data,
                  setValueAsDefault,
                )
              }}
            />
          </div>
        </Focusable>
        <LaunchOptionActionButton
          onEdit={() => onEdit(selectedOption?.id ?? launchOptions[0].id)}
          onDuplicate={() =>
            onDuplicate(selectedOption?.id ?? launchOptions[0].id)
          }
          onDelete={() => onDelete(selectedOption?.id ?? launchOptions[0].id)}
        />
      </Focusable>
    </Field>
  )
}

interface RenderItemsParams {
  items: HierarchicalLaunchOption[]
  appid: string
  showCommands: boolean
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean
  setAppLaunchOptionState: (
    appid: string,
    launchOptionId: string,
    value: boolean,
  ) => void
  setAppValueIdState: (
    appid: string,
    valueId: string,
    selectedLaunchOptionId: string,
    setAsDefault?: boolean,
  ) => void
  setValueAsDefault: boolean
  focusTargetId: string | null
  setFocusTargetId: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function renderLaunchOptionItems({
  items,
  appid,
  showCommands,
  getAppLaunchOptionState,
  setAppLaunchOptionState,
  setAppValueIdState,
  setValueAsDefault,
  focusTargetId,
  setFocusTargetId,
  onEdit,
  onDuplicate,
  onDelete,
}: RenderItemsParams) {
  const result: React.ReactNode[] = []
  const processedValueIds = new Set<string>()

  for (const item of items) {
    const { launchOption } = item

    // If this item has a valueId, render it as part of a dropdown group
    if (launchOption.valueId) {
      if (processedValueIds.has(launchOption.valueId)) continue
      processedValueIds.add(launchOption.valueId)

      // Collect all items in this list that share the same valueId
      const siblings = items
        .filter((i) => i.launchOption.valueId === launchOption.valueId)
        .map((i) => i.launchOption)

      result.push(
        <ValueIdSelectItem
          key={`valueId-${launchOption.valueId}`}
          valueId={launchOption.valueId}
          launchOptions={siblings}
          displayName={item.displayName}
          indentLevel={item.indentLevel}
          appid={appid}
          showCommands={showCommands}
          getAppLaunchOptionState={getAppLaunchOptionState}
          setAppValueIdState={setAppValueIdState}
          setValueAsDefault={setValueAsDefault}
          focusTargetId={focusTargetId}
          setFocusTargetId={setFocusTargetId}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />,
      )
    } else {
      // Normal toggle item
      result.push(
        <LaunchOptionItem
          key={launchOption.id}
          launchOption={launchOption}
          displayName={item.displayName}
          indentLevel={item.indentLevel}
          isChecked={getAppLaunchOptionState(appid, launchOption.id)}
          showCommands={showCommands}
          focusTargetId={focusTargetId}
          setFocusTargetId={setFocusTargetId}
          onToggle={(value) =>
            setAppLaunchOptionState(appid, launchOption.id, value)
          }
          onEdit={() => onEdit(launchOption.id)}
          onDuplicate={() => onDuplicate(launchOption.id)}
          onDelete={() => onDelete(launchOption.id)}
        />,
      )
    }
  }

  return result
}

/**
 * Count active launch options, treating valueId groups as at most 1.
 */
function countActiveLaunchOptions(
  launchOptions: LaunchOption[],
  appid: string,
  getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean,
  filter?: (item: LaunchOption) => boolean,
): number {
  const filtered = filter ? launchOptions.filter(filter) : launchOptions
  const countedValueIds = new Set<string>()
  let count = 0

  for (const item of filtered) {
    if (!isLaunchOptionActive(item, appid, getAppLaunchOptionState)) continue

    if (item.valueId) {
      if (countedValueIds.has(item.valueId)) continue
      countedValueIds.add(item.valueId)
    }

    count++
  }

  return count
}

export function AppLaunchOptionsPage() {
  const { appid } = useParams<{ appid: string }>()
  const [tab, setTab] = useState<string>("local")
  const [revertedLaunchOptions, setRevertedLaunchOptions] = useState(false)
  const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
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
    const map: Record<
      string,
      { local: HierarchicalLaunchOption[]; global: HierarchicalLaunchOption[] }
    > = {}
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (timeoutRef.current) clearInterval(timeoutRef.current)
    timeoutRef.current = setInterval(() => {
      setReadyToShow(true)
    }, 100)
    setReadyToShow(false)
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
        title="Launch option backups"
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
  const confirmDeleteLaunchOption = useCallback(
    (id: string) => {
      const launchOption = settings.launchOptions.find((item) => item.id === id)
      if (!launchOption) return

      const deleteGroup = !!launchOption.valueId
      showDeleteLaunchOptionModal({
        launchOption,
        deleteGroup,
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
      }}
    >
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
                {getAppOriginalLaunchOptions(appid) && (
                  <ButtonItem
                    label={"Revert to original launch options"}
                    description={getAppOriginalLaunchOptions(appid)}
                    indentLevel={1}
                    disabled={!getAppDisableAutoManageLaunchOptions(appid)}
                    onClick={() => {
                      SteamClient.Apps.SetAppLaunchOptions(
                        Number(appid),
                        getAppOriginalLaunchOptions(appid),
                      )
                      setRevertedLaunchOptions(true)
                      window.setTimeout(
                        () => setRevertedLaunchOptions(false),
                        3000,
                      )
                    }}
                  >
                    {revertedLaunchOptions
                      ? "✅ Reverted to original launch options"
                      : "Revert to original launch options"}
                  </ButtonItem>
                )}
                <ButtonItem
                  label={"Original launch option backups"}
                  description={"Show backed up original launch options"}
                  onClick={showLaunchOptionsBackupsModal}
                >
                  Show
                </ButtonItem>
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
  )
}
