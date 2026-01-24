import { callable } from '@decky/api'
import { Config } from './shared'
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { useConfig } from './hooks'

export const queryClient = new QueryClient()

const keys = {
    config: () => ['config'],
    info: () => ['info'],
}

const get_info = callable<[], {
    "CONFIG_FOLDER_NAME": string
    "CONFIG_FOLDER_PATH": string
    "CONFIG_PATH": string
    "SH_COMMAND_NAME": string
    "SHORT_SH_COMMAND_PATH": string
    "FULL_SH_COMMAND_PATH": string
    "COMMAND": string
}>("get_info")
const get_config = callable<[], Config | null>("get_config")
const set_config = callable<[Config], void>("set_config")
const get_original_command = callable<[string], string | null>("get_original_command")

export const useGetInfoQuery = () => useQuery({
    queryKey: keys.info(),
    queryFn() {
        return get_info()
    },
})

export const useGetConfigQuery = () => useQuery({
    queryKey: keys.config(),
    queryFn() {
        return get_config()
    },
})

export const useSetConfigMutation = () => useMutation<void, Error, Config>({
    mutationFn(data) {
        return set_config(data)
    },
    onSuccess() {
        queryClient.refetchQueries({
            queryKey: keys.config(),
        })
    },
})

export const useApplyLaunchOptionsMutation = () => {
    const { setAppOriginalLaunchOptions } = useConfig()
    return useMutation<void, Error, { appid: number, command: string }>({
        mutationFn(data) {
            return get_original_command(String(data.appid)).then((launchOptions) => {
                if (launchOptions !== null) setAppOriginalLaunchOptions(String(data.appid), launchOptions)
            })
        },
        onSuccess(_, data) {
            SteamClient.Apps.SetAppLaunchOptions(data.appid, data.command)
        },
    })
}