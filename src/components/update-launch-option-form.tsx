import { usePlugin } from "./plugin-provider"
import {
  DialogBody,
  DialogButton,
  DialogHeader,
  Field,
  Focusable,
  ModalRoot,
  showModal,
  Toggle,
} from "@decky/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LaunchOptionFields } from "./launch-option-fields"
import {
  getDeleteLaunchOptionLabel,
  showDeleteLaunchOptionModal,
} from "./delete-launch-option-modal"
import { LaunchOptionActionButton } from "./launch-option-action-button"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "../query"
import { PluginProvider } from "./plugin-provider"
import { launchOptionFactory, type LaunchOption } from "../shared"

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

function showIndividualLaunchOptionModal(id: string, onUpdate: () => void) {
  const modalResult = showModal(
    <ModalRoot onCancel={() => modalResult.Close()}>
      <DialogHeader>Edit dropdown value</DialogHeader>
      <DialogBody>
        <QueryClientProvider client={queryClient}>
          <PluginProvider>
            <UpdateLaunchOptionForm
              id={id}
              onDelete={() => modalResult.Close()}
              onUpdate={onUpdate}
              commonOnly={false}
              syncCommonFields={false}
            />
          </PluginProvider>
        </QueryClientProvider>
      </DialogBody>
    </ModalRoot>,
  )
}

function DropdownValueList({
  launchOption,
  siblingIds,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  launchOption: LaunchOption
  siblingIds: string[]
  onUpdate: () => void
  onDuplicate: () => void
  onDelete: (id: string) => void
}) {
  const {
    settings,
    updateLaunchOption,
    createLaunchOption,
    deleteLaunchOption,
  } = usePlugin().settings
  const activeColor = "oklch(80.9% 0.105 251.813)"
  const siblings = useMemo(() => {
    const siblingIdSet = new Set(siblingIds)
    return settings.launchOptions
      .filter((item) => siblingIdSet.has(item.id))
      .sort((a, b) => {
        if (!!a.fallbackValue !== !!b.fallbackValue) {
          return a.fallbackValue ? -1 : 1
        }

        const aLabel = a.valueName || a.on || a.name
        const bLabel = b.valueName || b.on || b.name
        return aLabel.localeCompare(bLabel)
      })
  }, [settings.launchOptions, siblingIds])

  if (!launchOption.valueId || siblings.length <= 1) return null

  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontWeight: "bold" }}>Dropdown values</div>
      <div>
        {siblings.map((sibling) => {
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
                style={{ display: "flex", gap: 10, alignItems: "center" }}
              >
                {sibling.fallbackValue && <div>Default</div>}
                <Toggle
                  value={sibling.fallbackValue}
                  onChange={(value) =>
                    updateLaunchOption(sibling, "fallbackValue", value, false)
                  }
                />
                <LaunchOptionActionButton
                  onEdit={() =>
                    showIndividualLaunchOptionModal(sibling.id, onUpdate)
                  }
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
                        onDelete(sibling.id)
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

export function UpdateLaunchOptionForm({
  id,
  onDelete,
  onUpdate,
  commonOnly = true,
  syncCommonFields = true,
  deleteByValueId = false,
}: {
  id: string
  onDelete?: () => void
  onUpdate?: () => void
  commonOnly?: boolean
  syncCommonFields?: boolean
  deleteByValueId?: boolean
}) {
  const {
    updateLaunchOption,
    deleteLaunchOption,
    deleteLaunchOptionsByIds,
    settings,
  } = usePlugin().settings

  const data = useMemo(
    () => settings.launchOptions.find((launchOption) => launchOption.id === id),
    [settings.launchOptions, id],
  )

  const syncedLaunchOptionIdsRef = useRef<string[] | null>(null)
  const deleteGroupRef = useRef<boolean | null>(null)
  const pendingSyncedLaunchOptionIdsRefreshRef = useRef(false)
  const [, setSyncedLaunchOptionIdsVersion] = useState(0)

  const refreshSyncedLaunchOptionIds = useCallback(
    (launchOption: LaunchOption) => {
      deleteGroupRef.current = !!launchOption.valueId
      syncedLaunchOptionIdsRef.current = launchOption.valueId
        ? settings.launchOptions
            .filter((item) => item.valueId === launchOption.valueId)
            .map((item) => item.id)
        : [launchOption.id]
      setSyncedLaunchOptionIdsVersion((version) => version + 1)
    },
    [settings.launchOptions],
  )

  const requestSyncedLaunchOptionIdsRefresh = useCallback(() => {
    pendingSyncedLaunchOptionIdsRefreshRef.current = true
  }, [])

  if (data && syncedLaunchOptionIdsRef.current === null) {
    // Freeze the modal's sibling list for its lifetime. Otherwise editing Value ID
    // to match another group would make later synced edits/delete affect that group too.
    deleteGroupRef.current = !!data.valueId
    syncedLaunchOptionIdsRef.current = data.valueId
      ? settings.launchOptions
          .filter((launchOption) => launchOption.valueId === data.valueId)
          .map((launchOption) => launchOption.id)
      : [data.id]
  }

  useEffect(() => {
    if (!data || !pendingSyncedLaunchOptionIdsRefreshRef.current) return

    pendingSyncedLaunchOptionIdsRefreshRef.current = false
    refreshSyncedLaunchOptionIds(data)
  }, [data, refreshSyncedLaunchOptionIds])

  if (!data) return null
  const deleteGroup = !!deleteGroupRef.current

  function remove() {
    if (!data) return null
    return showDeleteLaunchOptionModal({
      launchOption: data,
      deleteGroup: deleteByValueId && deleteGroup,
      onDelete: () => {
        if (deleteByValueId && deleteGroup) {
          deleteLaunchOptionsByIds(syncedLaunchOptionIdsRef.current || [])
        } else {
          deleteLaunchOption(data.id)
        }
        onDelete?.()
      },
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <LaunchOptionFields
        data={data}
        onChange={(field, value) => {
          updateLaunchOption(
            data,
            field,
            value,
            syncCommonFields,
            syncedLaunchOptionIdsRef.current || undefined,
          )
          onUpdate?.()
        }}
        commonOnly={commonOnly}
      />
      {commonOnly && data.valueId && (
        <DropdownValueList
          launchOption={data}
          siblingIds={syncedLaunchOptionIdsRef.current || [data.id]}
          onUpdate={requestSyncedLaunchOptionIdsRefresh}
          onDuplicate={requestSyncedLaunchOptionIdsRefresh}
          onDelete={(deletedId) => {
            requestSyncedLaunchOptionIdsRefresh()
            if (deletedId === data.id) {
              onDelete?.()
            }
          }}
        />
      )}
      <DialogButton style={{ flex: 1 }} onClick={remove}>
        <div
          style={{
            color: "oklch(63.7% 0.237 25.331)",
            fontWeight: "bold",
          }}
        >
          {getDeleteLaunchOptionLabel(deleteByValueId && deleteGroup)}
        </div>
      </DialogButton>
    </div>
  )
}
