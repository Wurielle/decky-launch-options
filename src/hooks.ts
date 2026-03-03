import {set} from 'es-toolkit/compat'
import {useEffect, useState} from 'react'
import {produce, WritableDraft} from 'immer'
import {LaunchOption, profileFactory, Settings} from './shared'
import {useGetSettingsQuery, useSetSettingsMutation} from './query'

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
            _setSettings(getSettingsQuery.data)
        }
    }, [getSettingsQuery.data, getSettingsQuery.isFetched])

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

        // Otherwise, pick the first globally-enabled option in the group as default.
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
                draft.launchOptions.unshift(launchOption)
            })
        },
        batchCreateLaunchOptions: (launchOptions: LaunchOption[]) => {
            setSettings((draft) => {
                launchOptions.forEach((launchOption) => {
                    const existingLaunchOptionIndex = draft.launchOptions.findIndex((item) => item.id === launchOption.id)
                    if (existingLaunchOptionIndex !== -1) {
                        draft.launchOptions[existingLaunchOptionIndex] = launchOption
                    } else {
                        draft.launchOptions.unshift(launchOption)
                    }
                })
            })
        },
        updateLaunchOption: (launchOption: LaunchOption, path: string, value: any, syncCommonFields = true) => {
            const commonFields = ['name', 'group', 'valueId', 'enableGlobally']
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
            })
        },
        deleteLaunchOption: (id: LaunchOption['id']) => {
            setSettings((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === id)
                if (index !== -1) draft.launchOptions.splice(index, 1)
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
            })
        },
        setAppLaunchOptionState: (appid: string, launchOptionId: string, value: boolean) => {
            setSettings((draft) => {
                const launchOption = draft.launchOptions.find((item) => item.id === launchOptionId)
                if (!launchOption) return

                if (launchOption.valueId) {
                    const siblings = draft.launchOptions.filter((item) => item.valueId === launchOption.valueId)
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
        setAppValueIdState: (appid: string, valueId: string, selectedLaunchOptionId: string | null) => {
            setSettings((draft) => {
                const siblings = draft.launchOptions.filter((item) => item.valueId === valueId)
                if (siblings.length === 0) return
                if (!draft.profiles[appid]) {
                    draft.profiles[appid] = profileFactory()
                }
                const appProfile = draft.profiles[appid]
                // Remove all siblings from state (fall back to enableGlobally defaults)
                for (const sibling of siblings) {
                    delete appProfile.state[sibling.id]
                }

                // If a specific option was selected, set it explicitly.
                if (selectedLaunchOptionId !== null) {
                    const selected = siblings.find((item) => item.id === selectedLaunchOptionId)
                    if (selected) {
                        appProfile.state[selectedLaunchOptionId] = true
                    }
                    return
                }

                // Marker: explicit group disabled
                appProfile.state[siblings[0].id] = false
            })
        },
        getAppActiveLocalLaunchOptions: (appid: string) => {
            const appProfile = settings.profiles[appid];
            return settings.launchOptions.filter((item) => {
                if (item.enableGlobally) return false;
                if (item.valueId) {
                    return getLaunchOptionState(appid, item.id) && !!item.on;
                }
                const state = appProfile?.state?.[item.id];
                const isActive = state !== undefined ? state : false;
                return isActive ? !!item.on : !!item.off;
            });
        },
        getAppActiveGlobalLaunchOptions: (appid: string) => {
            const appProfile = settings.profiles[appid];
            return settings.launchOptions.filter((item) => {
                if (!item.enableGlobally) return false;
                if (item.valueId) {
                    return getLaunchOptionState(appid, item.id) && !!item.on;
                }
                const state = appProfile?.state?.[item.id];
                const isActive = state !== undefined ? state : true;
                return isActive ? !!item.on : !!item.off;
            });
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
