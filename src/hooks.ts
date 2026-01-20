import { useImmer } from 'use-immer'
import set from 'lodash.set'

export type LaunchOption = {
    id: string
    name: string
    onCommand: string
    offCommand: string
}
type Config = {
    profiles: Record<string, Record<string, boolean>>
    launchOptions: LaunchOption[]
}
export function useConfig() {
    const [config, setConfig] = useImmer<Config>({
        profiles: {},
        launchOptions: []
    })
    return {
        config,
        createLaunchOption: (launchOption: LaunchOption) => {
            console.log(launchOption)
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