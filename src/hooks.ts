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
        updateLaunchOption: (launchOption: LaunchOption, path: string, value: any) => {
            const commonFields = ['name', 'group', 'valueId', 'enableGlobally']
            setSettings((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === launchOption.id)
                if (index === -1) return
                set(draft, ['launchOptions', index, path], value)
                // Propagate common field changes to all siblings sharing the same valueId
                if (launchOption.valueId && commonFields.includes(path)) {
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
        setAppLaunchOptionState: (appid: string, launchOptionId: string, value: boolean) => {
            setSettings((draft) => {
                const launchOption = draft.launchOptions.find((item) => item.id === launchOptionId)
                if (!launchOption) return
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
            const launchOption = settings.launchOptions.find((item) => item.id === launchOptionId)
            const appProfile = settings.profiles[appid]
            if (appProfile && launchOptionId in appProfile.state) {
                return appProfile.state[launchOptionId]
            }
            return !!launchOption?.enableGlobally
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
                // If a specific option was selected, set it to true
                // (unless it's enableGlobally, in which case deleting from state already defaults to true)
                if (selectedLaunchOptionId !== null) {
                    const selected = siblings.find((item) => item.id === selectedLaunchOptionId)
                    if (selected && !selected.enableGlobally) {
                        appProfile.state[selectedLaunchOptionId] = true
                    }
                }
            })
        },
        getAppActiveLocalLaunchOptions: (appid: string) => {
            const appProfile = settings.profiles[appid];
            return settings.launchOptions.filter((item) => {
                if (item.enableGlobally) return false;
                const state = appProfile?.state?.[item.id];
                const isActive = state !== undefined ? state : false;
                return isActive ? !!item.on : !!item.off;
            });
        },
        getAppActiveGlobalLaunchOptions: (appid: string) => {
            const appProfile = settings.profiles[appid];
            return settings.launchOptions.filter((item) => {
                if (!item.enableGlobally) return false;
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