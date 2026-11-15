import { set } from "es-toolkit/compat"
import {
  EnvironmentVariableMerge,
  environmentVariableMergeFactory,
} from "../shared"
import { SetSettings } from "./types"

export function createEnvironmentVariableMergeActions(
  setSettings: SetSettings,
) {
  return {
    createEnvironmentVariableMerge: (
      environmentVariableMerge: EnvironmentVariableMerge,
    ) => {
      setSettings((draft) => {
        draft.environmentVariableMerges.unshift(
          environmentVariableMergeFactory(environmentVariableMerge),
        )
      })
    },
    updateEnvironmentVariableMerge: (
      environmentVariableMerge: EnvironmentVariableMerge,
      path: keyof EnvironmentVariableMerge,
      value: EnvironmentVariableMerge[keyof EnvironmentVariableMerge],
    ) => {
      setSettings((draft) => {
        const index = draft.environmentVariableMerges.findIndex(
          (item) => item.id === environmentVariableMerge.id,
        )
        if (index === -1) return
        set(draft, ["environmentVariableMerges", index, path], value)
      })
    },
    deleteEnvironmentVariableMerge: (id: EnvironmentVariableMerge["id"]) => {
      setSettings((draft) => {
        const index = draft.environmentVariableMerges.findIndex(
          (item) => item.id === id,
        )
        if (index !== -1) draft.environmentVariableMerges.splice(index, 1)
      })
    },
  }
}
