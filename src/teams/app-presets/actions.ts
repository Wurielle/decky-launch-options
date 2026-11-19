import { produce } from "immer"
import { createLaunchOptionActions } from "../../settings/launch-option-actions"
import type {
  EnvironmentVariableMerge,
  LaunchOption,
  Settings,
} from "../../shared"
import { applyPreset, getGlobalPreference } from "./model"
import type { AppPreset } from "./model"

export function createPresetActions(
  getSettings: () => Settings,
  save: (settings: Settings) => Promise<void>,
) {
  return {
    savePresetRecipe: async (
      options: LaunchOption[],
      merges: EnvironmentVariableMerge[],
    ) => {
      const current = getSettings()
      const next = produce(current, (draft) => {
        const localOptions = options
          .filter((option) => !getGlobalPreference(current, option))
          .map((option) => {
            const existing = current.launchOptions.find(
              (item) => item.id === option.id,
            )
            return {
              ...option,
              enableGlobally: existing?.enableGlobally ?? false,
              requireExplicitSelection: existing
                ? existing.requireExplicitSelection
                : true,
              // Preserve existing defaults, including implicit first-sibling
              // selection. New siblings must not displace an existing fallback.
              fallbackValue: existing
                ? existing.fallbackValue
                : current.launchOptions.some(
                      (item) =>
                        option.valueId && item.valueId === option.valueId,
                    )
                  ? false
                  : option.fallbackValue,
            }
          })
        createLaunchOptionActions((mutate) => {
          mutate(draft)
        }).batchCreateLaunchOptions(localOptions, merges)
        // Batch normalization must not repair or otherwise edit a protected
        // user's control while importing an unrelated part of the recipe.
        for (const existing of current.launchOptions) {
          if (!getGlobalPreference(current, existing)) continue
          const index = draft.launchOptions.findIndex(
            (item) => item.id === existing.id,
          )
          draft.launchOptions[index] = existing
        }
      })
      await save(next)
    },
    applyAppPreset: async (
      preset: AppPreset,
      previews: LaunchOption[] = [],
    ) => {
      let result!: ReturnType<typeof applyPreset>
      const current = getSettings()
      const next = produce(current, (draft) => {
        result = applyPreset(draft, preset, previews)
      })
      if (next !== current) await save(next)
      return result
    },
  }
}
