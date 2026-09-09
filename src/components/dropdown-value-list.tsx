import { DialogButton, Field, Focusable, Toggle } from "@decky/ui"
import { useCallback, useMemo, useState } from "react"
import { FaArrowDown, FaArrowUp } from "react-icons/fa"
import { launchOptionFactory, LaunchOption } from "../shared"
import { showDeleteLaunchOptionModal } from "./delete-launch-option-modal"
import { LaunchOptionActionButton } from "./launch-option-action-button"
import { usePlugin } from "./plugin-provider"

interface FocusTarget {
  id: string
  version: number
}

function getCopyValueName(
  launchOption: LaunchOption,
  siblings: LaunchOption[],
) {
  const baseLabel =
    launchOption.valueName || launchOption.on || launchOption.name || "Unnamed"
  const labels = new Set(
    siblings.map((item) => item.valueName || item.on || item.name),
  )
  let nextLabel = `${baseLabel} (Copy)`
  let index = 2

  while (labels.has(nextLabel)) {
    nextLabel = `${baseLabel} (Copy ${index})`
    index++
  }

  return nextLabel
}

export function DropdownValueList({
  launchOption,
  siblingIds,
  onDuplicate,
  onDelete,
  onEdit,
}: {
  launchOption: LaunchOption
  siblingIds: string[]
  onDuplicate: () => void
  onDelete: (deletedId: string, siblings: LaunchOption[]) => void
  onEdit: (id: string) => void
}) {
  const {
    settings,
    updateLaunchOption,
    createLaunchOption,
    deleteLaunchOption,
    swapLaunchOptions,
  } = usePlugin().settings
  const activeColor = "oklch(80.9% 0.105 251.813)"
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const focusTargetId = focusTarget?.id ?? null
  const setFocusTargetId = useCallback((id: string) => {
    setFocusTarget((target) => ({
      id,
      version: (target?.version ?? 0) + 1,
    }))
  }, [])
  const siblings = useMemo(() => {
    const siblingIdSet = new Set(siblingIds)
    return settings.launchOptions
      .filter((item) => siblingIdSet.has(item.id))
      .reverse()
  }, [settings.launchOptions, siblingIds])

  if (!launchOption.valueId || siblings.length === 0) return null

  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontWeight: "bold" }}>Dropdown values</div>
      <div key={focusTarget?.version ?? 0}>
        {siblings.map((sibling, index) => {
          const focusId = `dropdown-value:${sibling.id}`
          const label =
            sibling.valueName || sibling.on || sibling.name || "Unnamed"
          const description = (
            <span style={{ color: "oklch(55.4% 0.046 257.417)" }}>
              {sibling.on && (
                <span
                  style={{
                    color: sibling.fallbackValue ? activeColor : undefined,
                  }}
                >
                  {sibling.on}
                </span>
              )}
              {!sibling.on && "None"}
            </span>
          )

          return (
            <Field
              key={sibling.id}
              label={label}
              description={description}
              childrenLayout={"inline"}
            >
              <Focusable
                autoFocus={focusTargetId === focusId}
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                {sibling.fallbackValue && <div>Default</div>}
                <Toggle
                  value={sibling.fallbackValue}
                  onChange={(value) => {
                    setFocusTargetId(focusId)
                    updateLaunchOption(sibling, "fallbackValue", value, false)
                  }}
                />
                {([-1, 1] as const).map((direction) => {
                  const target = siblings[index + direction]
                  const Icon = direction === -1 ? FaArrowUp : FaArrowDown
                  const action = direction === -1 ? "up" : "down"

                  return (
                    <DialogButton
                      key={direction}
                      disabled={!target}
                      style={{
                        minWidth: 40,
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => {
                        if (!target) return
                        setFocusTargetId(focusId)
                        swapLaunchOptions(sibling.id, target.id)
                      }}
                    >
                      <Icon />
                    </DialogButton>
                  )
                })}
                <LaunchOptionActionButton
                  onEdit={() => onEdit(sibling.id)}
                  onDuplicate={() => {
                    createLaunchOption(
                      launchOptionFactory({
                        ...sibling,
                        id: undefined,
                        valueName: getCopyValueName(sibling, siblings),
                      }),
                    )
                    onDuplicate()
                  }}
                  onDelete={() =>
                    showDeleteLaunchOptionModal({
                      launchOption: sibling,
                      deleteGroup: false,
                      onDelete: () => {
                        deleteLaunchOption(sibling.id)
                        onDelete(sibling.id, siblings)
                      },
                    })
                  }
                />
              </Focusable>
            </Field>
          )
        })}
      </div>
    </Focusable>
  )
}
