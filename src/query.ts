import { callable } from '@decky/api'
import { Settings } from './shared'
import { QueryClient, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { useSettings } from './hooks'
import { AppDetails } from '@decky/ui/dist/globals/steam-client/App'

export const queryClient = new QueryClient()

export const keys = {
    settings: () => ['settings'],
    info: () => ['info'],
}

export const get_info = callable<[], {
    "SETTINGS_FOLDER_NAME": string
    "SETTINGS_FOLDER_PATH": string
    "SETTINGS_PATH": string
    "SH_COMMAND_NAME": string
    "SHORT_SH_COMMAND_PATH": string
    "FULL_SH_COMMAND_PATH": string
    "COMMAND": string
}>("get_info")
export const get_settings = callable<[], Settings | null>("get_settings")
export const set_settings = callable<[Settings], void>("set_settings")
export const has_shell_script = callable<[], boolean>("has_shell_script")

export const useGetInfoQuery = () => useQuery({
    queryKey: keys.info(),
    queryFn() {
        return get_info()
    },
})

export const getSettingsQueryOptions = queryOptions({
    queryKey: keys.settings(),
    queryFn() {
        return get_settings()
    },
})

export const useGetSettingsQuery = () => useQuery(getSettingsQueryOptions)

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
    const { setAppOriginalLaunchOptions, getAppOriginalLaunchOptions } = useSettings()
    return useMutation<boolean, Error, { appid: number, command: string }>({
        mutationFn(data) {
            return Promise.all([
                new Promise<string | null>((resolve) => {
                    const { unregister } = SteamClient.Apps.RegisterForAppDetails(
                        data.appid,
                        (details: AppDetails) => {
                            const currentLaunchOptions = details.strLaunchOptions
                            const isNonSteamApp = 'strShortcutExe' in details
                            if (isNonSteamApp || currentLaunchOptions.includes(data.command)) {
                                resolve(null)
                            } else {
                                resolve(currentLaunchOptions)
                            }
                            unregister()
                        },
                    )
                }),
                has_shell_script(),
            ])
                .then(([originalLaunchOptions, hasShellScript]) => {
                    if (originalLaunchOptions !== null) setAppOriginalLaunchOptions(String(data.appid), originalLaunchOptions)
                    return hasShellScript
                })
        },
        onSuccess(hasShellScript, data) {
            if (hasShellScript) {
                SteamClient.Apps.SetAppLaunchOptions(data.appid, data.command)
            } else {
                SteamClient.Apps.SetAppLaunchOptions(data.appid, getAppOriginalLaunchOptions(String(data.appid)))
            }
        },
    })
}