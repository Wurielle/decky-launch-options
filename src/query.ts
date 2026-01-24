import { callable } from '@decky/api'
import { Settings } from './shared'
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { useSettings } from './hooks'

export const queryClient = new QueryClient()

const keys = {
    settings: () => ['settings'],
    info: () => ['info'],
}

const get_info = callable<[], {
    "SETTINGS_FOLDER_NAME": string
    "SETTINGS_FOLDER_PATH": string
    "SETTINGS_PATH": string
    "SH_COMMAND_NAME": string
    "SHORT_SH_COMMAND_PATH": string
    "FULL_SH_COMMAND_PATH": string
    "COMMAND": string
}>("get_info")
const get_settings = callable<[], Settings | null>("get_settings")
const set_settings = callable<[Settings], void>("set_settings")
const get_original_command = callable<[string], string | null>("get_original_command")

export const useGetInfoQuery = () => useQuery({
    queryKey: keys.info(),
    queryFn() {
        return get_info()
    },
})

export const useGetSettingsQuery = () => useQuery({
    queryKey: keys.settings(),
    queryFn() {
        return get_settings()
    },
})

export const useSetSettingsMutation = () => useMutation<void, Error, Settings>({
    mutationFn(data) {
        return set_settings(data)
    },
    onSuccess() {
        queryClient.refetchQueries({
            queryKey: keys.settings(),
        })
    },
})

export const useApplyLaunchOptionsMutation = () => {
    const { setAppOriginalLaunchOptions } = useSettings()
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