import { set } from "es-toolkit/compat"
import { useEffect, useRef, useState } from "react"
import { produce, WritableDraft } from "immer"
import { v4 as uuid } from "uuid"
import {
  defaultEnvVariableMerges,
  EnvVariableMerge,
  envVariableMergeFactory,
  LaunchOption,
  launchOptionFactory,
  profileFactory,
  Settings,
} from "./shared"
import { useGetSettingsQuery, useSetSettingsMutation } from "./query"

export function useSettings() {
  const [settings, _setSettings] = useState<Settings>({
    profiles: {},
    launchOptions: [],
    envVariableMerges: [],
  })

  const getSettingsQuery = useGetSettingsQuery()
  const setSettingsMutation = useSetSettingsMutation()
  const initializedRef = useRef(false)

  const normalizeSettings = (nextSettings?: Settings | null): Settings => {
    const envVariableMerges =
      nextSettings?.envVariableMerges === undefined
        ? defaultEnvVariableMerges
        : nextSettings.envVariableMerges

    return {
      profiles: nextSettings?.profiles || {},
      launchOptions: (nextSettings?.launchOptions || []).map((item) => ({
        ...item,
        valueId: item.valueId || "",
        valueName: item.valueName || "",
        fallbackValue: !!item.fallbackValue,
        priority: item.priority || 0,
      })),
      envVariableMerges: envVariableMerges.map((item) =>
        envVariableMergeFactory(item),
      ),
    }
  }

  const setSettings = (
    draftSettings: (draft: WritableDraft<Settings>) => void,
  ) => {
    if (!initializedRef.current) return
    _setSettings((prev) => {
      const newSettings = produce(prev, draftSettings)
      setSettingsMutation.mutate(newSettings)
      return newSettings
    })
  }

  useEffect(() => {
    if (!getSettingsQuery.isFetched) return

    if (!initializedRef.current) {
      _setSettings(normalizeSettings(getSettingsQuery.data))
      initializedRef.current = true
      return
    }

    if (!getSettingsQuery.data) return

    _setSettings(normalizeSettings(getSettingsQuery.data))
  }, [getSettingsQuery.data, getSettingsQuery.isFetched])

  /**
   * Clear per-app profile state for the given launch option IDs across all profiles.
   * This ensures that when a launch option (or valueId group) is promoted to global,
   * no stale per-app state overrides the global default.
   */
  const clearProfileState = (draft: WritableDraft<Settings>, ids: string[]) => {
    for (const profile of Object.values(draft.profiles)) {
      for (const id of ids) {
        delete profile.state[id]
      }
    }
  }

  const normalizeFallbackValues = (draft: WritableDraft<Settings>) => {
    const groups = new Map<string, LaunchOption[]>()
    draft.launchOptions.forEach((item) => {
      if (!item.valueId) {
        item.fallbackValue = false
        return
      }
      const siblings = groups.get(item.valueId) || []
      siblings.push(item)
      groups.set(item.valueId, siblings)
    })

    groups.forEach((siblings) => {
      let hasFallbackValue = false
      siblings.forEach((item) => {
        if (!item.fallbackValue) return
        if (hasFallbackValue) {
          item.fallbackValue = false
          return
        }
        hasFallbackValue = true
      })
    })
  }

  const getCopyLabel = (label: string, existingLabels: Iterable<string>) => {
    const baseLabel = label || "Unnamed"
    const labels = new Set(existingLabels)
    let nextLabel = `${baseLabel} (Copy)`
    let index = 2

    while (labels.has(nextLabel)) {
      nextLabel = `${baseLabel} (Copy ${index})`
      index++
    }

    return nextLabel
  }

  const getCopyValueId = (
    valueId: string,
    existingValueIds: Iterable<string>,
  ) => {
    const baseValueId =
      valueId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "unnamed"
    const valueIds = new Set(existingValueIds)
    let nextValueId = ""

    do {
      const suffix = uuid().replace(/-/g, "").slice(0, 4)
      nextValueId = `${baseValueId}-copy-${suffix}`
    } while (valueIds.has(nextValueId))

    return nextValueId
  }

  const getSelectedValueIdLaunchOptionId = (
    appid: string,
    valueId: string,
  ): string | null => {
    const siblings = settings.launchOptions.filter(
      (item) => item.valueId === valueId,
    )
    if (siblings.length === 0) return null

    const appProfile = settings.profiles[appid]

    // Explicit user choice wins.
    const explicitlyEnabled = siblings.find(
      (item) => appProfile?.state?.[item.id] === true,
    )
    if (explicitlyEnabled) return explicitlyEnabled.id

    // Any explicit state on this group without a true means user selected Disabled.
    const hasExplicitState = siblings.some(
      (item) => appProfile?.state && item.id in appProfile.state,
    )
    if (hasExplicitState) return null

    // Global fallback for valueId groups: the globally-enabled option, if any.
    const globallyEnabled = siblings.find((item) => item.enableGlobally)
    if (globallyEnabled) return globallyEnabled.id

    // Last resort: the fallbackValue option, or the first sibling.
    const fallback = siblings.find((item) => item.fallbackValue)
    return fallback?.id || siblings[0].id
  }

  const getLaunchOptionState = (
    appid: string,
    launchOptionId: string,
  ): boolean => {
    const launchOption = settings.launchOptions.find(
      (item) => item.id === launchOptionId,
    )
    if (!launchOption) return false

    if (launchOption.valueId) {
      return (
        getSelectedValueIdLaunchOptionId(appid, launchOption.valueId) ===
        launchOptionId
      )
    }

    const appProfile = settings.profiles[appid]
    if (appProfile && launchOptionId in appProfile.state) {
      return appProfile.state[launchOptionId]
    }
    return !!launchOption.enableGlobally
  }

  return {
    settings,
    loading: getSettingsQuery.isLoading,
    createLaunchOption: (launchOption: LaunchOption) => {
      setSettings((draft) => {
        const nextLaunchOption = launchOptionFactory(launchOption)
        draft.launchOptions.unshift(nextLaunchOption)
        normalizeFallbackValues(draft)
      })
    },
    batchCreateLaunchOptions: (launchOptions: LaunchOption[]) => {
      setSettings((draft) => {
        launchOptions.forEach((launchOption) => {
          const nextLaunchOption = launchOptionFactory(launchOption)
          const existingLaunchOptionIndex = draft.launchOptions.findIndex(
            (item) => item.id === nextLaunchOption.id,
          )
          if (existingLaunchOptionIndex !== -1) {
            draft.launchOptions[existingLaunchOptionIndex] = nextLaunchOption
          } else {
            draft.launchOptions.unshift(nextLaunchOption)
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
    createEnvVariableMerge: (envVariableMerge: EnvVariableMerge) => {
      setSettings((draft) => {
        draft.envVariableMerges.unshift(
          envVariableMergeFactory(envVariableMerge),
        )
      })
    },
    updateEnvVariableMerge: (
      envVariableMerge: EnvVariableMerge,
      path: keyof EnvVariableMerge,
      value: EnvVariableMerge[keyof EnvVariableMerge],
    ) => {
      setSettings((draft) => {
        const index = draft.envVariableMerges.findIndex(
          (item) => item.id === envVariableMerge.id,
        )
        if (index === -1) return
        set(draft, ["envVariableMerges", index, path], value)
      })
    },
    deleteEnvVariableMerge: (id: EnvVariableMerge["id"]) => {
      setSettings((draft) => {
        const index = draft.envVariableMerges.findIndex(
          (item) => item.id === id,
        )
        if (index !== -1) draft.envVariableMerges.splice(index, 1)
      })
    },
    setAppLaunchOptionState: (
      appid: string,
      launchOptionId: string,
      value: boolean,
    ) => {
      setSettings((draft) => {
        const launchOption = draft.launchOptions.find(
          (item) => item.id === launchOptionId,
        )
        if (!launchOption) return

        if (launchOption.valueId) {
          const siblings = draft.launchOptions.filter(
            (item) => item.valueId === launchOption.valueId,
          )
          if (siblings.length === 0) return
          if (!draft.profiles[appid]) {
            draft.profiles[appid] = profileFactory()
          }
          const appProfile = draft.profiles[appid]
          for (const sibling of siblings) {
            delete appProfile.state[sibling.id]
          }
          if (value) {
            appProfile.state[launchOptionId] = true
          } else {
            // Marker: explicit group disabled
            appProfile.state[siblings[0].id] = false
          }
          return
        }

        if (!draft.profiles[appid]) {
          draft.profiles[appid] = profileFactory()
        }
        const appProfile = draft.profiles[appid]
        if (launchOption.enableGlobally && value) {
          delete appProfile.state[launchOptionId]
          return
        }
        appProfile.state[launchOptionId] = value
      })
    },
    getAppLaunchOptionState: (appid: string, launchOptionId: string) => {
      return getLaunchOptionState(appid, launchOptionId)
    },
    setAppValueIdState: (
      appid: string,
      valueId: string,
      selectedLaunchOptionId: string,
      setAsDefault = false,
    ) => {
      setSettings((draft) => {
        const siblings = draft.launchOptions.filter(
          (item) => item.valueId === valueId,
        )
        if (siblings.length === 0) return

        if (setAsDefault) {
          siblings.forEach((item) => {
            item.enableGlobally = item.id === selectedLaunchOptionId
          })
          // Clear per-app state across all profiles so the global default takes effect
          // (explicit app state has higher priority than enableGlobally)
          clearProfileState(
            draft,
            siblings.map((item) => item.id),
          )
          return
        }

        if (!draft.profiles[appid]) {
          draft.profiles[appid] = profileFactory()
        }
        const appProfile = draft.profiles[appid]
        // Remove all siblings from state (fall back to enableGlobally/fallbackValue defaults)
        for (const sibling of siblings) {
          delete appProfile.state[sibling.id]
        }
        appProfile.state[selectedLaunchOptionId] = true
      })
    },
    getAppActiveLocalLaunchOptions: (appid: string) => {
      const appProfile = settings.profiles[appid]
      return settings.launchOptions.filter((item) => {
        if (item.enableGlobally) return false
        if (item.valueId) {
          return getLaunchOptionState(appid, item.id) && !!item.on
        }
        const state = appProfile?.state?.[item.id]
        const isActive = state !== undefined ? state : false
        return isActive ? !!item.on : !!item.off
      })
    },
    getAppActiveGlobalLaunchOptions: (appid: string) => {
      const appProfile = settings.profiles[appid]
      return settings.launchOptions.filter((item) => {
        if (!item.enableGlobally) return false
        if (item.valueId) {
          return getLaunchOptionState(appid, item.id) && !!item.on
        }
        const state = appProfile?.state?.[item.id]
        const isActive = state !== undefined ? state : true
        return isActive ? !!item.on : !!item.off
      })
    },
    getAppOriginalLaunchOptions: (appid: string) =>
      settings.profiles[appid]?.originalLaunchOptions || "",
    setAppOriginalLaunchOptions: (appid: string, command: string) => {
      setSettings((draft) => {
        draft.profiles[appid] = profileFactory({
          ...draft.profiles[appid],
          originalLaunchOptions: command,
        })
      })
    },
    getAppDisableAutoManageLaunchOptions: (appid: string) =>
      settings.profiles[appid]?.disableAutoManageLaunchOptions === true,
    setAppDisableAutoManageLaunchOptions: (appid: string, value: boolean) => {
      setSettings((draft) => {
        if (!value) {
          if (!draft.profiles[appid]) return
          delete draft.profiles[appid].disableAutoManageLaunchOptions
          return
        }

        draft.profiles[appid] = profileFactory({
          ...draft.profiles[appid],
        })
        draft.profiles[appid].disableAutoManageLaunchOptions = true
      })
    },
  }
}
