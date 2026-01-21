import set from 'lodash.set'
import { callable } from '@decky/api'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {produce, WritableDraft} from 'immer'
export type LaunchOption = {
    id: string
    name: string
    onCommand: string
    offCommand: string
    enableGlobally: boolean
}
type Config = {
    profiles: Record<string, Record<string, boolean>>
    launchOptions: LaunchOption[]
}
const get_config = callable<[], Config | null>("get_config");
const set_config = callable<[Config], void>("set_config");
export function useConfig() {
    const [config, _setConfig] = useState<Config>({
        profiles: {},
        launchOptions: []
    })

    const getConfigQuery = useQuery({
        queryKey: ['config'],
        queryFn() {
            return get_config()
        }
    })
    const setConfigMutation = useMutation<void, Error, Config>({
        mutationFn(data){
            return set_config(data)
        }
    })

    const setConfig = (draftConfig:(draft: WritableDraft<Config>) => void) => {
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
        createLaunchOption: (launchOption: LaunchOption) => {
            setConfig((draft) => {
                draft.launchOptions.push(launchOption)
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
        }
    }
}