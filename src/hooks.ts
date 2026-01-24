import set from 'lodash.set'
import { useEffect, useState } from 'react'
import { produce, WritableDraft } from 'immer'
import { Config, LaunchOption, profileFactory } from './shared'
import { useGetConfigQuery, useSetConfigMutation } from './query'

export function useConfig() {
    const [config, _setConfig] = useState<Config>({
        profiles: {},
        launchOptions: [],
    })

    const getConfigQuery = useGetConfigQuery()
    const setConfigMutation = useSetConfigMutation()

    const setConfig = (draftConfig: (draft: WritableDraft<Config>) => void) => {
        const newConfig = produce(config, draftConfig)
        _setConfig(newConfig)
        setConfigMutation.mutate(newConfig)
    }

    useEffect(() => {
        if (getConfigQuery.isFetched && getConfigQuery.data) {
            _setConfig(getConfigQuery.data)
        }
    }, [getConfigQuery.data, getConfigQuery.isFetched])

    return {
        config,
        loading: getConfigQuery.isLoading,
        createLaunchOption: (launchOption: LaunchOption) => {
            setConfig((draft) => {
                draft.launchOptions.unshift(launchOption)
            })
        },
        updateLaunchOption: (launchOption: LaunchOption, path: string, value: any) => {
            setConfig((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === launchOption.id)
                if (index !== -1) set(draft, ['launchOptions', index, path], value)
            })
        },
        deleteLaunchOption: (id: LaunchOption['id']) => {
            setConfig((draft) => {
                const index = draft.launchOptions.findIndex((item) => item.id === id)
                if (index !== -1) draft.launchOptions.splice(index, 1)
            })
        },
        setAppLaunchOptionState: (appid: string, launchOptionId: string, value: boolean) => {
            setConfig((draft) => {
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
            const launchOption = config.launchOptions.find((item) => item.id === launchOptionId)
            const appProfile = config.profiles[appid]
            if (appProfile && launchOptionId in appProfile.state) {
                return appProfile.state[launchOptionId]
            }
            return !!launchOption?.enableGlobally
        },
        getAppOriginalLaunchOptions: (appid: string) => config.profiles[appid]?.originalLaunchOptions || '',
        setAppOriginalLaunchOptions: (appid: string, command: string) => {
            setConfig((draft) => {
                draft.profiles[appid] = profileFactory({
                    ...draft.profiles[appid],
                    originalLaunchOptions: command,
                })
            })
        },
    }
}