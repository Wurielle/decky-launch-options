import { profileFactory, Settings } from "../shared"
import { clearProfileState, getLaunchOptionState } from "../utils"
import { SetSettings } from "./types"

export function createProfileActions(
  settings: Settings,
  setSettings: SetSettings,
) {
  return {
    setAppLaunchOptionState: (
      appid: string,
      launchOptionId: string,
      value: boolean,
    ) => {
      setSettings((draft) => {
        const launchOption = draft.launchOptions.find(
          (item) => item.id === launchOptionId,
        )
        if (!launchOption) return

        if (launchOption.valueId) {
          const siblings = draft.launchOptions.filter(
            (item) => item.valueId === launchOption.valueId,
          )
          if (siblings.length === 0) return
          if (!draft.profiles[appid]) {
            draft.profiles[appid] = profileFactory()
          }
          const appProfile = draft.profiles[appid]
          for (const sibling of siblings) {
            delete appProfile.state[sibling.id]
          }
          if (value) {
            appProfile.state[launchOptionId] = true
          } else {
            // Marker: explicit group disabled
            appProfile.state[siblings[0].id] = false
          }
          return
        }

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
      return getLaunchOptionState(settings, appid, launchOptionId)
    },
    setAppValueIdState: (
      appid: string,
      valueId: string,
      selectedLaunchOptionId: string,
      setAsDefault = false,
    ) => {
      setSettings((draft) => {
        const siblings = draft.launchOptions.filter(
          (item) => item.valueId === valueId,
        )
        if (siblings.length === 0) return

        if (setAsDefault) {
          siblings.forEach((item) => {
            item.enableGlobally = item.id === selectedLaunchOptionId
          })
          // Clear per-app state across all profiles so the global default takes effect
          // (explicit app state has higher priority than enableGlobally)
          clearProfileState(
            draft,
            siblings.map((item) => item.id),
          )
          return
        }

        if (!draft.profiles[appid]) {
          draft.profiles[appid] = profileFactory()
        }
        const appProfile = draft.profiles[appid]
        // Remove all siblings from state (fall back to enableGlobally/fallbackValue defaults)
        for (const sibling of siblings) {
          delete appProfile.state[sibling.id]
        }
        appProfile.state[selectedLaunchOptionId] = true
      })
    },
    getAppActiveLocalLaunchOptions: (appid: string) => {
      const appProfile = settings.profiles[appid]
      return settings.launchOptions.filter((item) => {
        if (item.enableGlobally) return false
        if (item.valueId) {
          return getLaunchOptionState(settings, appid, item.id) && !!item.on
        }
        const state = appProfile?.state?.[item.id]
        const isActive = state !== undefined ? state : false
        return isActive ? !!item.on : !!item.off
      })
    },
    getAppActiveGlobalLaunchOptions: (appid: string) => {
      const appProfile = settings.profiles[appid]
      return settings.launchOptions.filter((item) => {
        if (!item.enableGlobally) return false
        if (item.valueId) {
          return getLaunchOptionState(settings, appid, item.id) && !!item.on
        }
        const state = appProfile?.state?.[item.id]
        const isActive = state !== undefined ? state : true
        return isActive ? !!item.on : !!item.off
      })
    },
    getAppOriginalLaunchOptions: (appid: string) =>
      settings.profiles[appid]?.originalLaunchOptions || "",
    setAppOriginalLaunchOptions: (appid: string, command: string) => {
      setSettings((draft) => {
        draft.profiles[appid] = profileFactory({
          ...draft.profiles[appid],
          originalLaunchOptions: command,
        })
      })
    },
    getAppDisableAutoManageLaunchOptions: (appid: string) =>
      settings.profiles[appid]?.disableAutoManageLaunchOptions === true,
    setAppDisableAutoManageLaunchOptions: (appid: string, value: boolean) => {
      setSettings((draft) => {
        if (!value) {
          if (!draft.profiles[appid]) return
          delete draft.profiles[appid].disableAutoManageLaunchOptions
          return
        }

        draft.profiles[appid] = profileFactory({
          ...draft.profiles[appid],
        })
        draft.profiles[appid].disableAutoManageLaunchOptions = true
      })
    },
  }
}
