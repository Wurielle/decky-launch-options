import { Dropdown, Field, Focusable, Toggle } from "@decky/ui"
import { SingleDropdownOption } from "@decky/ui/dist/components/Dropdown"
import { ReactNode } from "react"
import { LaunchOptionActionButton } from "../../../components/launch-option-action-button"
import { LaunchOption } from "../../../shared"
import { HierarchicalLaunchOption } from "../../../utils"

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

  const rgOptions = launchOptions.map((lo) => ({
    data: lo.id,
    label: (lo.valueName || lo.on || lo.name) + "\u00A0\u00A0",
  }))

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
  savedLaunchOptions: LaunchOption[]
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

export function renderLaunchOptionItems({
  items,
  savedLaunchOptions,
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
  const result: ReactNode[] = []
  const processedValueIds = new Set<string>()

  for (const item of items) {
    const { launchOption } = item

    // If this item has a valueId, render it as part of a dropdown group
    if (launchOption.valueId) {
      if (processedValueIds.has(launchOption.valueId)) continue
      processedValueIds.add(launchOption.valueId)

      // Collect all items in this list that share the same valueId
      const siblingIds = new Set(
        items
          .filter((i) => i.launchOption.valueId === launchOption.valueId)
          .map((i) => i.launchOption.id),
      )
      const siblings = savedLaunchOptions
        .filter((savedLaunchOption) => siblingIds.has(savedLaunchOption.id))
        .reverse()

      // Fall back to the current display order if saved settings are missing.
      const launchOptions = siblings.length
        ? siblings
        : items
            .filter((i) => i.launchOption.valueId === launchOption.valueId)
            .map((i) => i.launchOption)

      result.push(
        <ValueIdSelectItem
          key={`valueId-${launchOption.valueId}`}
          valueId={launchOption.valueId}
          launchOptions={launchOptions}
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
