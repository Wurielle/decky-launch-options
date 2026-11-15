import { AppDetails } from "@decky/ui/dist/globals/steam-client/App"
import { useMutation } from "@tanstack/react-query"
import { useStore } from "@tanstack/react-store"
import { get_shortcut_launch_options, has_shell_script } from "../api"
import { useSettings } from "../hooks"
import { settingsStore } from "../stores"
import { profileFactory } from "../shared"
import {
  appLaunchOptionsIncludesDloCommand,
  launchOptionsLifecycle,
  normalizeSettings,
  setAppLaunchOptions,
} from "../utils"
import {
  getSettingsQueryOptions,
  queryClient,
  useBackupOriginalLaunchOptionsMutation,
  useSetSettingsMutation,
} from "./settings"

type SetDloLaunchOptionsData = {
  appid: number
  currentLaunchOptions: string
  command: string
}

type SetDloLaunchOptionsContext = {
  currentLaunchOptions: string
  originalLaunchOptions: string | null
  hasShellScript: boolean
}

type PartialSetDloLaunchOptionsContext = Pick<
  SetDloLaunchOptionsContext,
  "currentLaunchOptions" | "originalLaunchOptions"
>

function getDloLaunchOptionsContext(
  currentLaunchOptions: string,
  command: string,
): PartialSetDloLaunchOptionsContext {
  if (appLaunchOptionsIncludesDloCommand(currentLaunchOptions, command)) {
    return {
      currentLaunchOptions,
      originalLaunchOptions: null,
    }
  }

  return {
    currentLaunchOptions: command,
    originalLaunchOptions: currentLaunchOptions,
  }
}

const useDloLaunchOptionsActions = () => {
  const { getAppOriginalLaunchOptions, getAppDisableAutoManageLaunchOptions } =
    useSettings()
  const backupOriginalLaunchOptionsMutation =
    useBackupOriginalLaunchOptionsMutation()
  const setSettingsMutation = useSetSettingsMutation()

  return {
    getAppDisableAutoManageLaunchOptions,
    async saveOriginalLaunchOptions(
      appid: number,
      partialContext: PartialSetDloLaunchOptionsContext,
      hasShellScript: boolean,
    ): Promise<SetDloLaunchOptionsContext> {
      const originalLaunchOptions = partialContext.originalLaunchOptions
      if (
        originalLaunchOptions !== null &&
        (hasShellScript || originalLaunchOptions.trim())
      ) {
        if (originalLaunchOptions.trim())
          backupOriginalLaunchOptionsMutation.mutate(
            {
              appid: String(appid),
              command: originalLaunchOptions,
            },
            { onError: () => undefined },
          )
        const settings = normalizeSettings(
          await queryClient.ensureQueryData(getSettingsQueryOptions),
        )
        await setSettingsMutation.mutateAsync({
          ...settings,
          profiles: {
            ...settings.profiles,
            [appid]: profileFactory({
              ...settings.profiles[String(appid)],
              originalLaunchOptions,
            }),
          },
        })
      }

      return {
        ...partialContext,
        hasShellScript,
      }
    },
    applyDloLaunchOptions(
      context: SetDloLaunchOptionsContext | void,
      data: Pick<SetDloLaunchOptionsData, "appid">,
      missingShellLaunchOptions?: string,
    ) {
      if (!context || !launchOptionsLifecycle.active) return

      if (context.hasShellScript) {
        setAppLaunchOptions(data.appid, context.currentLaunchOptions)
      } else {
        setAppLaunchOptions(
          data.appid,
          missingShellLaunchOptions ??
            context.originalLaunchOptions ??
            getAppOriginalLaunchOptions(String(data.appid)),
        )
      }
    },
  }
}

export const useSetDloLaunchOptionsMutation = () => {
  const { saveOriginalLaunchOptions, applyDloLaunchOptions } =
    useDloLaunchOptionsActions()

  return useMutation<
    SetDloLaunchOptionsContext,
    Error,
    SetDloLaunchOptionsData
  >({
    mutationFn(data) {
      return has_shell_script().then((hasShellScript) =>
        saveOriginalLaunchOptions(
          data.appid,
          getDloLaunchOptionsContext(data.currentLaunchOptions, data.command),
          hasShellScript,
        ),
      )
    },
    onSuccess(context, data) {
      applyDloLaunchOptions(context, data, data.currentLaunchOptions)
    },
  })
}

export const useApplyLaunchOptionsMutation = () => {
  const {
    getAppDisableAutoManageLaunchOptions,
    saveOriginalLaunchOptions,
    applyDloLaunchOptions,
  } = useDloLaunchOptionsActions()
  const autoManageLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageLaunchOptions,
  )
  const autoManageNonSteamLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageNonSteamLaunchOptions,
  )
  return useMutation<
    SetDloLaunchOptionsContext | void,
    Error,
    { appid: number; command: string }
  >({
    mutationFn(data) {
      if (getAppDisableAutoManageLaunchOptions(String(data.appid)))
        return Promise.resolve()

      return Promise.all([
        new Promise<PartialSetDloLaunchOptionsContext | null>((resolve) => {
          const resolveLaunchOptions = (currentLaunchOptions: string) => {
            resolve(
              getDloLaunchOptionsContext(currentLaunchOptions, data.command),
            )
          }

          const { unregister } = SteamClient.Apps.RegisterForAppDetails(
            data.appid,
            (details: AppDetails) => {
              const appDetails = details as AppDetails & {
                strLaunchOptions?: string
                strShortcutExe?: unknown
              }
              const currentLaunchOptions = appDetails.strLaunchOptions ?? ""
              const isNonSteamApp =
                typeof appDetails.strShortcutExe !== "undefined"
              const shouldAutoManage = isNonSteamApp
                ? autoManageNonSteamLaunchOptions
                : autoManageLaunchOptions

              if (!shouldAutoManage) {
                resolve(null)
                unregister()
                return
              }

              if (isNonSteamApp) {
                get_shortcut_launch_options(String(data.appid)).then(
                  (launchOptions) => {
                    if (launchOptions === null) {
                      resolve(null)
                      return
                    }

                    resolveLaunchOptions(launchOptions)
                  },
                  () => resolve(null),
                )
              } else {
                resolveLaunchOptions(currentLaunchOptions)
              }

              unregister()
            },
          )
        }),
        has_shell_script(),
      ]).then(([partialContext, hasShellScript]) => {
        if (!partialContext) return

        return saveOriginalLaunchOptions(
          data.appid,
          partialContext,
          hasShellScript,
        )
      })
    },
    onSuccess(context, data) {
      applyDloLaunchOptions(context, data)
    },
  })
}
