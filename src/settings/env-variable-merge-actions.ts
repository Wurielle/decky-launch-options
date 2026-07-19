import { set } from "es-toolkit/compat"
import { EnvVariableMerge, envVariableMergeFactory } from "../shared"
import { SetSettings } from "./types"

export function createEnvVariableMergeActions(setSettings: SetSettings) {
  return {
    createEnvVariableMerge: (envVariableMerge: EnvVariableMerge) => {
      setSettings((draft) => {
        draft.envVariableMerges.unshift(
          envVariableMergeFactory(envVariableMerge),
        )
      })
    },
    updateEnvVariableMerge: (
      envVariableMerge: EnvVariableMerge,
      path: keyof EnvVariableMerge,
      value: EnvVariableMerge[keyof EnvVariableMerge],
    ) => {
      setSettings((draft) => {
        const index = draft.envVariableMerges.findIndex(
          (item) => item.id === envVariableMerge.id,
        )
        if (index === -1) return
        set(draft, ["envVariableMerges", index, path], value)
      })
    },
    deleteEnvVariableMerge: (id: EnvVariableMerge["id"]) => {
      setSettings((draft) => {
        const index = draft.envVariableMerges.findIndex(
          (item) => item.id === id,
        )
        if (index !== -1) draft.envVariableMerges.splice(index, 1)
      })
    },
  }
}
