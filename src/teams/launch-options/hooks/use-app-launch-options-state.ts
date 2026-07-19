import { AppDetails } from "@decky/ui/dist/globals/steam-client/App"
import { useEffect, useRef, useState } from "react"
import { get_shortcut_launch_options } from "../../../query"
import {
  AppLaunchOptionsUpdatedEvent,
  appLaunchOptionsUpdatedEventType,
} from "../../../utils"

export function useAppLaunchOptionsState(appid: string) {
  const [currentLaunchOptions, setCurrentLaunchOptions] = useState("")
  const [loadedLaunchOptionsAppid, setLoadedLaunchOptionsAppid] = useState<
    string | null
  >(null)
  const locallySetLaunchOptionsRef = useRef<string | undefined>(undefined)
  const [isNonSteamApp, setIsNonSteamApp] = useState(false)

  useEffect(() => {
    locallySetLaunchOptionsRef.current = undefined
    setCurrentLaunchOptions("")
    setLoadedLaunchOptionsAppid(null)
    setIsNonSteamApp(false)
  }, [appid])

  useEffect(() => {
    const handleAppLaunchOptionsUpdated = (event: Event) => {
      const { detail } = event as AppLaunchOptionsUpdatedEvent
      if (detail.appid >>> 0 !== Number(appid) >>> 0) return

      locallySetLaunchOptionsRef.current = detail.launchOptions
      setCurrentLaunchOptions(detail.launchOptions)
      setLoadedLaunchOptionsAppid(appid)
    }

    window.addEventListener(
      appLaunchOptionsUpdatedEventType,
      handleAppLaunchOptionsUpdated,
    )

    return () => {
      window.removeEventListener(
        appLaunchOptionsUpdatedEventType,
        handleAppLaunchOptionsUpdated,
      )
    }
  }, [appid])

  useEffect(() => {
    let cancelled = false
    const { unregister } = SteamClient.Apps.RegisterForAppDetails(
      Number(appid),
      (details: AppDetails) => {
        const appDetails = details as AppDetails & {
          strLaunchOptions?: string
          strShortcutExe?: unknown
        }
        const currentSteamLaunchOptions = appDetails.strLaunchOptions ?? ""
        const isNonSteam = typeof appDetails.strShortcutExe !== "undefined"
        if (!cancelled) setIsNonSteamApp(isNonSteam)
        const setLaunchOptions = (
          launchOptions: string,
          hasAuthoritativeLaunchOptions: boolean = true,
        ) => {
          if (!cancelled) {
            const locallySetLaunchOptions = locallySetLaunchOptionsRef.current
            setCurrentLaunchOptions(
              isNonSteam
                ? (locallySetLaunchOptions ?? launchOptions)
                : launchOptions,
            )
            setLoadedLaunchOptionsAppid(
              hasAuthoritativeLaunchOptions ||
                locallySetLaunchOptions !== undefined
                ? appid
                : null,
            )
          }
        }

        if (isNonSteam) {
          get_shortcut_launch_options(appid).then(
            (launchOptions) => {
              if (launchOptions === null) {
                setLaunchOptions(currentSteamLaunchOptions, false)
                return
              }

              setLaunchOptions(launchOptions)
            },
            () => setLaunchOptions(currentSteamLaunchOptions, false),
          )
        } else {
          setLaunchOptions(currentSteamLaunchOptions)
        }
      },
    )

    return () => {
      cancelled = true
      unregister()
    }
  }, [appid])

  return {
    currentLaunchOptions,
    loadedLaunchOptionsAppid,
    isNonSteamApp,
  }
}
