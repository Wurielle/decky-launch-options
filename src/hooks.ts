import { set } from 'es-toolkit/compat'
import { useEffect, useState } from 'react'
import { produce, WritableDraft } from 'immer'
import { LaunchOption, launchOptionFactory, profileFactory, Settings } from './shared'
import { useGetSettingsQuery, useSetSettingsMutation } from './query'

export function useSettings() {
    const [settings, _setSettings] = useState<Settings>({
        profiles: {},
        launchOptions: [],
    })

    const getSettingsQuery = useGetSettingsQuery()
    const setSettingsMutation = useSetSettingsMutation()

    const setSettings = (draftSettings: (draft: WritableDraft<Settings>) => void) => {
        const newSettings = produce(settings, draftSettings)
        _setSettings(newSettings)
        setSettingsMutation.mutate(newSettings)
    }

    useEffect(() => {
        if (getSettingsQuery.isFetched && getSettingsQuery.data) {
            _setSettings({
                profiles: getSettingsQuery.data.profiles || {},
                launchOptions: (getSettingsQuery.data.launchOptions || []).map((item) => ({
                    ...item,
                    valueId: item.valueId || '',
                    valueName: item.valueName || '',
                    unsetDefault: !!item.unsetDefault,
                })),
            })
        }
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

    const normalizeUnsetDefaultOptions = (draft: WritableDraft<Settings>) => {
        const groups = new Map<string, LaunchOption[]>()
        draft.launchOptions.forEach((item) => {
            if (!item.valueId) {
                item.unsetDefault = false
                return
            }
            const siblings = groups.get(item.valueId) || []
            siblings.push(item)
            groups.set(item.valueId, siblings)
        })

        groups.forEach((siblings) => {
            let hasUnsetDefault = false
            siblings.forEach((item) => {
                if (!item.unsetDefault) return
                if (hasUnsetDefault) {
                    item.unsetDefault = false
                    return
                }
                hasUnsetDefault = true
            })
        })
    }

    const getSelectedValueIdLaunchOptionId = (appid: string, valueId: string): string | null => {
        const siblings = settings.launchOptions.filter((item) => item.valueId === valueId)
        if (siblings.length === 0) return null

        const appProfile = settings.profiles[appid]

        // Explicit user choice wins.
        const explicitlyEnabled = siblings.find((item) => appProfile?.state?.[item.id] === true)
        if (explicitlyEnabled) return explicitlyEnabled.id

        // Any explicit state on this group without a true means user selected Disabled.
        const hasExplicitState = siblings.some((item) => appProfile?.state && item.id in appProfile.state)
        if (hasExplicitState) return null

        // Global fallback for valueId groups: the globally-enabled option, if any.
        const globallyEnabled = siblings.find((item) => item.enableGlobally)
        return globallyEnabled?.id || null
    }

    const getLaunchOptionState = (appid: string, launchOptionId: string): boolean => {
        const launchOption = settings.launchOptions.find((item) => item.id === launchOptionId)
        if (!launchOption) return false

        if (launchOption.valueId) {
            return getSelectedValueIdLaunchOptionId(appid, launchOption.valueId) === launchOptionId
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
                normalizeUnsetDefaultOptions(draft)
            })
        },
        batchCreateLaunchOptions: (launchOptions: LaunchOption[]) => {
            setSettings((draft) => {
                launchOptions.forEach((launchOption) => {
                    const nextLaunchOption = launchOptionFactory(launchOption)
                    const existingLaunchOptionIndex = draft.launchOptions.findIndex((item) => item.id === nextLaunchOption.id)
                    if (existingLaunchOptionIndex !== -1) {
                        draft.launchOptions[existingLaunchOptionIndex] = nextLaunchOption
                    } else {
                        draft.launchOptions.unshift(nextLaunchOption)
                    }
                })
                normalizeUnsetDefaultOptions(draft)
            })
        },
        updateLaunchOption: (
            launchOption: LaunchOption,
            path: string,
            value: any,
            syncCommonFields = true,
        ) => {
            const commonFields = ['name', 'group', 'valueId']
            setSettings((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === launchOption.id)
                if (index === -1) return
                set(draft, ['launchOptions', index, path], value)

                // Propagate common field changes to all siblings sharing the same valueId
                if (syncCommonFields && launchOption.valueId && commonFields.includes(path)) {
                    for (let i = 0; i < draft.launchOptions.length; i++) {
                        if (i !== index && draft.launchOptions[i].valueId === launchOption.valueId) {
                            set(draft, ['launchOptions', i, path], value)
                        }
                    }
                }

                if (path === 'unsetDefault') {
                    const updatedLaunchOption = draft.launchOptions[index]
                    if (!updatedLaunchOption.valueId || !value) {
                        updatedLaunchOption.unsetDefault = false
                    } else {
                        draft.launchOptions.forEach((item) => {
                            if (item.valueId === updatedLaunchOption.valueId) {
                                item.unsetDefault = item.id === updatedLaunchOption.id
                            }
                        })
                    }
                }

                // For valueId groups, global state is represented by exactly one sibling
                // having enableGlobally=true, or none (None).
                if (path === 'enableGlobally' && launchOption.valueId) {
                    const siblings = draft.launchOptions.filter((item) => item.valueId === launchOption.valueId)
                    const siblingIds = siblings.map((item) => item.id)

                    if (value) {
                        // Always prefer unsetDefault (None) as the global default for a clean slate.
                        // Fall back to the edited option only if no unsetDefault exists.
                        const unsetDefault = siblings.find((item) => item.unsetDefault)
                        const selectedId = unsetDefault?.id ?? launchOption.id

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
                if (path === 'enableGlobally' && !launchOption.valueId) {
                    clearProfileState(draft, [launchOption.id])
                }

                normalizeUnsetDefaultOptions(draft)
            })
        },
        deleteLaunchOption: (id: LaunchOption['id']) => {
            setSettings((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === id)
                if (index !== -1) draft.launchOptions.splice(index, 1)
                normalizeUnsetDefaultOptions(draft)
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
                draft.launchOptions = draft.launchOptions.filter((item) => !idsToDelete.has(item.id))
                Object.values(draft.profiles).forEach((profile) => {
                    Object.keys(profile.state).forEach((id) => {
                        if (idsToDelete.has(id)) {
                            delete profile.state[id]
                        }
                    })
                })
                normalizeUnsetDefaultOptions(draft)
            })
        },
        setAppLaunchOptionState: (appid: string, launchOptionId: string, value: boolean) => {
            setSettings((draft) => {
                const launchOption = draft.launchOptions.find((item) => item.id === launchOptionId)
                if (!launchOption) return

                if (launchOption.valueId) {
                    const siblings = draft.launchOptions.filter((item) => item.valueId === launchOption.valueId)
                    const unsetDefaultOption = siblings.find((item) => item.unsetDefault)
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
                        if (unsetDefaultOption) {
                            appProfile.state[unsetDefaultOption.id] = true
                        } else {
                            // Marker: explicit group disabled
                            appProfile.state[siblings[0].id] = false
                        }
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
        setAppValueIdState: (appid: string, valueId: string, selectedLaunchOptionId: string | null, setAsDefault = false) => {
            setSettings((draft) => {
                const siblings = draft.launchOptions.filter((item) => item.valueId === valueId)
                const unsetDefaultOption = siblings.find((item) => item.unsetDefault)
                const effectiveSelectedLaunchOptionId = selectedLaunchOptionId ?? unsetDefaultOption?.id ?? null
                if (siblings.length === 0) return

                if (setAsDefault) {
                    siblings.forEach((item) => {
                        item.enableGlobally = effectiveSelectedLaunchOptionId !== null && item.id === effectiveSelectedLaunchOptionId
                    })
                    // Clear per-app state across all profiles so the global default takes effect
                    // (explicit app state has higher priority than enableGlobally)
                    clearProfileState(draft, siblings.map((item) => item.id))
                    return
                }

                if (!draft.profiles[appid]) {
                    draft.profiles[appid] = profileFactory()
                }
                const appProfile = draft.profiles[appid]
                // Remove all siblings from state (fall back to enableGlobally defaults)
                for (const sibling of siblings) {
                    delete appProfile.state[sibling.id]
                }

                // If a specific option was selected, set it explicitly.
                if (effectiveSelectedLaunchOptionId !== null) {
                    const selected = siblings.find((item) => item.id === effectiveSelectedLaunchOptionId)
                    if (selected) {
                        appProfile.state[effectiveSelectedLaunchOptionId] = true
                    }
                    return
                }

                // Marker: explicit group disabled
                appProfile.state[siblings[0].id] = false
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
        getAppOriginalLaunchOptions: (appid: string) => settings.profiles[appid]?.originalLaunchOptions || '',
        setAppOriginalLaunchOptions: (appid: string, command: string) => {
            setSettings((draft) => {
                draft.profiles[appid] = profileFactory({
                    ...draft.profiles[appid],
                    originalLaunchOptions: command,
                })
            })
        },
    }
}
