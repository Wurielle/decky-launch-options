import set from 'lodash.set'
import { useEffect, useState } from 'react'
import { produce, WritableDraft } from 'immer'
import { Config, LaunchOption } from './shared'
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
    }
}