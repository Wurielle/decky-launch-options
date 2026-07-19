import { produce } from "immer"
import { useEffect, useRef, useState } from "react"
import { useGetSettingsQuery, useSetSettingsMutation } from "./queries/settings"
import { createEnvVariableMergeActions } from "./settings/env-variable-merge-actions"
import { createLaunchOptionActions } from "./settings/launch-option-actions"
import { createProfileActions } from "./settings/profile-actions"
import { SetSettings } from "./settings/types"
import { Settings } from "./shared"
import { normalizeSettings } from "./utils"

export function useSettings() {
  const [settings, _setSettings] = useState<Settings>({
    profiles: {},
    launchOptions: [],
    envVariableMerges: [],
  })

  const getSettingsQuery = useGetSettingsQuery()
  const setSettingsMutation = useSetSettingsMutation()
  const initializedRef = useRef(false)

  const setSettings: SetSettings = (draftSettings) => {
    if (!initializedRef.current) return
    _setSettings((prev) => {
      const newSettings = produce(prev, draftSettings)
      setSettingsMutation.mutate(newSettings)
      return newSettings
    })
  }

  useEffect(() => {
    if (!getSettingsQuery.isFetched) return

    if (!initializedRef.current) {
      _setSettings(normalizeSettings(getSettingsQuery.data))
      initializedRef.current = true
      return
    }

    if (!getSettingsQuery.data) return

    _setSettings(normalizeSettings(getSettingsQuery.data))
  }, [getSettingsQuery.data, getSettingsQuery.isFetched])

  return {
    settings,
    loading: getSettingsQuery.isLoading,
    ...createLaunchOptionActions(setSettings),
    ...createEnvVariableMergeActions(setSettings),
    ...createProfileActions(settings, setSettings),
  }
}
