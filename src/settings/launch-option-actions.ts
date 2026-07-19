import { set } from "es-toolkit/compat"
import { LaunchOption, launchOptionFactory } from "../shared"
import {
  clearProfileState,
  getCopyLabel,
  getCopyValueId,
  normalizeFallbackValues,
} from "../utils"
import { SetSettings } from "./types"

export function createLaunchOptionActions(setSettings: SetSettings) {
  return {
    createLaunchOption: (launchOption: LaunchOption) => {
      setSettings((draft) => {
        const nextLaunchOption = launchOptionFactory(launchOption)
        draft.launchOptions.unshift(nextLaunchOption)
        normalizeFallbackValues(draft)
      })
    },
    batchCreateLaunchOptions: (launchOptions: LaunchOption[]) => {
      setSettings((draft) => {
        const nextLaunchOptions = launchOptions.map(launchOptionFactory)
        const existingGlobalIds = new Set(
          draft.launchOptions
            .filter((item) => item.enableGlobally)
            .map((item) => item.id),
        )
        // Keep the current global valueId choice during reimport. Apps without
        // explicit profile state inherit enableGlobally, so replacing it would
        // reset their visible selection.
        const preservedGlobalIdByValueId = new Map(
          nextLaunchOptions
            .filter((item) => item.valueId && existingGlobalIds.has(item.id))
            .map((item) => [item.valueId, item.id]),
        )

        nextLaunchOptions.forEach((nextLaunchOption) => {
          if (existingGlobalIds.has(nextLaunchOption.id)) {
            nextLaunchOption.enableGlobally = true
          } else if (
            nextLaunchOption.valueId &&
            preservedGlobalIdByValueId.has(nextLaunchOption.valueId)
          ) {
            nextLaunchOption.enableGlobally = false
          }

          const existingLaunchOptionIndex = draft.launchOptions.findIndex(
            (item) => item.id === nextLaunchOption.id,
          )
          if (existingLaunchOptionIndex !== -1) {
            draft.launchOptions[existingLaunchOptionIndex] = nextLaunchOption
          } else {
            draft.launchOptions.unshift(nextLaunchOption)
          }
        })
        draft.launchOptions.forEach((item) => {
          const preservedGlobalId = preservedGlobalIdByValueId.get(item.valueId)
          if (preservedGlobalId) {
            item.enableGlobally = item.id === preservedGlobalId
          }
        })
        normalizeFallbackValues(draft)
      })
    },
    updateLaunchOption: (
      launchOption: LaunchOption,
      path: string,
      value: any,
      syncCommonFields = true,
      syncLaunchOptionIds?: string[],
    ) => {
      const commonFields = ["name", "group", "valueId", "priority"]
      setSettings((draft) => {
        const index = draft.launchOptions.findIndex(
          (item) => item.id === launchOption.id,
        )
        if (index === -1) return
        const syncLaunchOptionIdSet = syncLaunchOptionIds
          ? new Set(syncLaunchOptionIds)
          : null
        set(draft, ["launchOptions", index, path], value)

        // Propagate common field changes to either a frozen caller-provided group
        // or all siblings sharing the same valueId.
        if (
          syncCommonFields &&
          (syncLaunchOptionIdSet || launchOption.valueId) &&
          commonFields.includes(path)
        ) {
          for (let i = 0; i < draft.launchOptions.length; i++) {
            if (
              i !== index &&
              (syncLaunchOptionIdSet
                ? syncLaunchOptionIdSet.has(draft.launchOptions[i].id)
                : draft.launchOptions[i].valueId === launchOption.valueId)
            ) {
              set(draft, ["launchOptions", i, path], value)
            }
          }
        }

        if (path === "fallbackValue") {
          const updatedLaunchOption = draft.launchOptions[index]
          if (!updatedLaunchOption.valueId || !value) {
            updatedLaunchOption.fallbackValue = false
          } else {
            draft.launchOptions.forEach((item) => {
              if (item.valueId === updatedLaunchOption.valueId) {
                item.fallbackValue = item.id === updatedLaunchOption.id
              }
            })
          }
        }

        // For valueId groups, global state is represented by exactly one sibling
        // having enableGlobally=true, or none (None).
        if (
          path === "enableGlobally" &&
          (syncLaunchOptionIdSet || launchOption.valueId)
        ) {
          const siblings = syncLaunchOptionIdSet
            ? draft.launchOptions.filter((item) =>
                syncLaunchOptionIdSet.has(item.id),
              )
            : draft.launchOptions.filter(
                (item) => item.valueId === launchOption.valueId,
              )
          const siblingIds = siblings.map((item) => item.id)

          if (value) {
            // Prefer the fallbackValue option as the global default.
            // Fall back to the edited option only if no fallbackValue exists.
            const fallbackOption = siblings.find((item) => item.fallbackValue)
            const selectedId = fallbackOption?.id ?? launchOption.id
            siblings.forEach((item) => {
              item.enableGlobally = item.id === selectedId
            })
          } else {
            siblings.forEach((item) => {
              item.enableGlobally = false
            })
          }

          clearProfileState(draft, siblingIds)
        }

        // For non-valueId options, clear per-app state whenever enableGlobally changes
        if (path === "enableGlobally" && !launchOption.valueId) {
          clearProfileState(draft, [launchOption.id])
        }

        normalizeFallbackValues(draft)
      })
    },
    deleteLaunchOption: (id: LaunchOption["id"]) => {
      setSettings((draft) => {
        const index = draft.launchOptions.findIndex((item) => item.id === id)
        if (index !== -1) draft.launchOptions.splice(index, 1)
        normalizeFallbackValues(draft)
      })
    },
    deleteLaunchOptionsByValueId: (valueId: string) => {
      setSettings((draft) => {
        const idsToDelete = new Set(
          draft.launchOptions
            .filter((item) => item.valueId === valueId)
            .map((item) => item.id),
        )
        if (idsToDelete.size === 0) return
        draft.launchOptions = draft.launchOptions.filter(
          (item) => !idsToDelete.has(item.id),
        )
        Object.values(draft.profiles).forEach((profile) => {
          Object.keys(profile.state).forEach((id) => {
            if (idsToDelete.has(id)) {
              delete profile.state[id]
            }
          })
        })
        normalizeFallbackValues(draft)
      })
    },
    deleteLaunchOptionsByIds: (ids: string[]) => {
      setSettings((draft) => {
        const idsToDelete = new Set(ids)
        if (idsToDelete.size === 0) return
        draft.launchOptions = draft.launchOptions.filter(
          (item) => !idsToDelete.has(item.id),
        )
        Object.values(draft.profiles).forEach((profile) => {
          Object.keys(profile.state).forEach((id) => {
            if (idsToDelete.has(id)) {
              delete profile.state[id]
            }
          })
        })
        normalizeFallbackValues(draft)
      })
    },
    duplicateLaunchOption: (id: LaunchOption["id"]) => {
      setSettings((draft) => {
        const launchOption = draft.launchOptions.find((item) => item.id === id)
        if (!launchOption) return

        if (!launchOption.valueId) {
          const name = getCopyLabel(
            launchOption.name,
            draft.launchOptions.map((item) => item.name),
          )
          draft.launchOptions.unshift(
            launchOptionFactory({
              ...launchOption,
              id: undefined,
              name,
            }),
          )
          normalizeFallbackValues(draft)
          return
        }

        const siblings = draft.launchOptions.filter(
          (item) => item.valueId === launchOption.valueId,
        )
        const valueId = getCopyValueId(
          launchOption.valueId,
          draft.launchOptions.map((item) => item.valueId).filter(Boolean),
        )
        const namesByOriginalName = new Map<string, string>()

        ;[...siblings].reverse().forEach((sibling) => {
          if (!namesByOriginalName.has(sibling.name)) {
            namesByOriginalName.set(
              sibling.name,
              getCopyLabel(
                sibling.name,
                draft.launchOptions.map((item) => item.name),
              ),
            )
          }

          draft.launchOptions.unshift(
            launchOptionFactory({
              ...sibling,
              id: undefined,
              name: namesByOriginalName.get(sibling.name) || sibling.name,
              valueId,
            }),
          )
        })

        normalizeFallbackValues(draft)
      })
    },
  }
}
