import {
  DialogBody,
  DialogButton,
  DialogHeader,
  ModalRoot,
  showModal,
} from "@decky/ui"
import { QueryClientProvider } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { queryClient } from "../query"
import { LaunchOption } from "../shared"
import {
  getDeleteLaunchOptionLabel,
  showDeleteLaunchOptionModal,
} from "./delete-launch-option-modal"
import { DropdownValueList } from "./dropdown-value-list"
import { LaunchOptionFields } from "./launch-option-fields"
import { PluginProvider, usePlugin } from "./plugin-provider"

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
  // The modal may be opened for the currently selected dropdown value, but that
  // value can later be deleted from the in-modal list. Keep a mutable active ID
  // so the modal can retarget another sibling instead of unmounting immediately.
  const [activeId, setActiveId] = useState(id)

  const data = useMemo(
    () =>
      settings.launchOptions.find(
        (launchOption) => launchOption.id === activeId,
      ),
    [settings.launchOptions, activeId],
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
    setActiveId(id)
    syncedLaunchOptionIdsRef.current = null
    deleteGroupRef.current = null
    pendingSyncedLaunchOptionIdsRefreshRef.current = false
  }, [id])

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
      deleteCount: syncedLaunchOptionIdsRef.current?.length,
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
          onDuplicate={requestSyncedLaunchOptionIdsRefresh}
          onEdit={(siblingId) =>
            showIndividualLaunchOptionModal(
              siblingId,
              requestSyncedLaunchOptionIdsRefresh,
            )
          }
          onDelete={(deletedId, siblings) => {
            const remainingSiblings = siblings.filter(
              (sibling) => sibling.id !== deletedId,
            )
            if (deletedId === data.id) {
              // If the form was showing the deleted value, keep editing the
              // same dropdown group by switching to another remaining value.
              const nextActiveSibling =
                remainingSiblings.find((sibling) => sibling.fallbackValue) ||
                remainingSiblings[0]

              if (nextActiveSibling) {
                setActiveId(nextActiveSibling.id)
              } else {
                onDelete?.()
                return
              }
            }

            requestSyncedLaunchOptionIdsRefresh()
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
