import { launchOptionFactory, profileFactory } from "../../shared"
import { parseRecipes } from "../recipe-store/recipes"
import type { LaunchOption, Recipe, Settings } from "../../shared"
import { getLaunchOptionState } from "../../utils/settings"
import type { SavedStore } from "../recipe-store/store"

export interface PresetReference {
  recipeId: string
  launchOptionId: string
}

export type PresetSkip = PresetReference & { reason?: "global-preference" }

export interface PresetDefinition {
  id: string
  name: string
  author: string
  description: string
  notes: string[]
  launchOptions: PresetReference[]
}

export interface AppPreset extends PresetDefinition {
  store: SavedStore
  appid: string
  sourceAppid: string
  key: string
}

export function storeKey(store: SavedStore): string {
  return JSON.stringify([
    store.url,
    store.store.github.repository,
    store.store.github.branch,
  ])
}

export function parsePreset(
  value: unknown,
  filename: string,
  store: SavedStore,
  appid: string,
  sourceAppid = appid,
): AppPreset {
  return bindPresetToApp(
    parsePresetDefinition(value, filename),
    store,
    appid,
    sourceAppid,
  )
}

export function parsePresetDefinition(
  value: unknown,
  filename: string,
): PresetDefinition {
  const data = value as PresetDefinition
  if (
    !data ||
    Object.keys(data).some(
      (key) =>
        ![
          "id",
          "name",
          "author",
          "description",
          "notes",
          "launchOptions",
        ].includes(key),
    ) ||
    typeof data.id !== "string" ||
    !data.id.trim() ||
    filename !== `${data.id}.json` ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    typeof data.author !== "string" ||
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(data.author) ||
    typeof data.description !== "string" ||
    (data.notes !== undefined &&
      (!Array.isArray(data.notes) ||
        data.notes.some((note) => typeof note !== "string"))) ||
    !Array.isArray(data.launchOptions) ||
    !data.launchOptions.length
  ) {
    throw new Error(`Invalid preset: ${filename}.`)
  }
  const references = new Set<string>()
  for (const reference of data.launchOptions) {
    if (
      !reference ||
      typeof reference !== "object" ||
      Array.isArray(reference) ||
      Object.keys(reference).some(
        (key) => key !== "recipeId" && key !== "launchOptionId",
      ) ||
      typeof reference.recipeId !== "string" ||
      !reference.recipeId.trim() ||
      typeof reference.launchOptionId !== "string" ||
      !reference.launchOptionId.trim()
    )
      throw new Error(`Invalid preset reference in ${filename}.`)
    const key = JSON.stringify([reference.recipeId, reference.launchOptionId])
    if (references.has(key))
      throw new Error(`Duplicate preset reference in ${filename}.`)
    references.add(key)
  }
  return {
    id: data.id,
    name: data.name,
    author: data.author,
    description: data.description,
    notes: [...(data.notes ?? [])],
    launchOptions: data.launchOptions.map(({ recipeId, launchOptionId }) => ({
      recipeId,
      launchOptionId,
    })),
  }
}

export function bindPresetToApp(
  definition: PresetDefinition,
  store: SavedStore,
  appid: string,
  sourceAppid = appid,
): AppPreset {
  if (
    !/^[1-9]\d*$/.test(appid) ||
    (sourceAppid !== "*" && sourceAppid !== appid)
  ) {
    throw new Error(`Invalid preset: ${definition.id}.json.`)
  }
  return {
    ...definition,
    store,
    appid,
    sourceAppid,
    key: JSON.stringify([
      storeKey(store),
      "steam",
      appid,
      sourceAppid,
      definition.id,
    ]),
  }
}

// DLO's runtime IDs and valueIds are global; namespace both before importing.
export function prepareRecipeImport(
  recipe: Recipe,
  store: SavedStore,
  preserveGlobals?: Settings,
): Recipe {
  parseRecipes([recipe])
  if (!recipe.id) throw new Error("This recipe has no stable ID.")
  const key = storeKey(store)
  const scoped = (kind: string, id: string) =>
    JSON.stringify(["store", key, recipe.id, kind, id])
  return {
    ...recipe,
    launchOptions: recipe.launchOptions?.map((input) => {
      const option = launchOptionFactory(input)
      const prepared = {
        ...option,
        id: scoped("option", option.id || ""),
        enableGlobally: preserveGlobals
          ? (preserveGlobals.launchOptions.find(
              (existing) => existing.id === scoped("option", option.id),
            )?.enableGlobally ?? false)
          : option.enableGlobally,
        valueId: option.valueId ? scoped("value", option.valueId) : "",
        source: {
          storeKey: key,
          recipeId: recipe.id!,
          launchOptionId: option.id || "",
        },
      }
      if (preserveGlobals && getGlobalPreference(preserveGlobals, prepared)) {
        const existing = preserveGlobals.launchOptions.find(
          (item) => item.id === prepared.id,
        )
        if (existing) return { ...existing }
      }
      return prepared
    }),
  }
}

export function resolvePreset(
  preset: AppPreset,
  settings: Settings,
  previews: LaunchOption[] = [],
) {
  const { id, name, author, description, notes, launchOptions } = preset
  parsePreset(
    { id, name, author, description, notes, launchOptions },
    `${id}.json`,
    preset.store,
    preset.appid,
    preset.sourceAppid,
  )
  const selected: LaunchOption[] = []
  const missing: PresetReference[] = []
  const protectedOptions: {
    reference: PresetReference
    option: LaunchOption
    globalOption: LaunchOption
  }[] = []
  const dropdowns = new Set<string>()
  for (const reference of preset.launchOptions) {
    const matches = settings.launchOptions.filter(
      (item) =>
        item.source?.storeKey === storeKey(preset.store) &&
        item.source.recipeId === reference.recipeId &&
        item.source.launchOptionId === reference.launchOptionId,
    )
    if (matches.length > 1)
      throw new Error(
        `Ambiguous preset reference: ${reference.recipeId}/${reference.launchOptionId}.`,
      )
    const imported = matches[0]
    const option =
      imported ??
      previews.find(
        (item) =>
          item.source?.storeKey === storeKey(preset.store) &&
          item.source.recipeId === reference.recipeId &&
          item.source.launchOptionId === reference.launchOptionId,
      )
    if (option) {
      if (option.valueId && dropdowns.has(option.valueId))
        throw new Error(
          `Conflicting preset choices for ${option.name || option.valueId}.`,
        )
      if (option.valueId) dropdowns.add(option.valueId)
      const globalOption = getGlobalPreference(settings, option)
      if (globalOption)
        protectedOptions.push({ reference, option, globalOption })
      if (imported) selected.push(imported)
      else if (!globalOption) missing.push(reference)
    } else missing.push(reference)
  }
  return { selected, missing, protectedOptions }
}

export function isPresetSelected(
  preset: AppPreset,
  settings: Settings,
): boolean {
  const { selected, missing } = resolvePreset(preset, settings)
  return (
    !missing.length &&
    selected.every((option) =>
      getLaunchOptionState(settings, preset.appid, option.id),
    )
  )
}

export function getGlobalPreference(settings: Settings, option: LaunchOption) {
  const existing = settings.launchOptions.find((item) => item.id === option.id)
  return settings.launchOptions.find(
    (item) =>
      item.enableGlobally &&
      (item.id === option.id ||
        (item.valueId &&
          (item.valueId === option.valueId ||
            item.valueId === existing?.valueId))),
  )
}

export function applyPreset(
  settings: Settings,
  preset: AppPreset,
  previews: LaunchOption[] = [],
) {
  const { selected, missing, protectedOptions } = resolvePreset(
    preset,
    settings,
    previews,
  )
  const skipped: PresetSkip[] = [
    ...missing,
    ...protectedOptions
      .filter(
        ({ option }) =>
          !getLaunchOptionState(settings, preset.appid, option.id),
      )
      .map(({ reference }) => ({
        ...reference,
        reason: "global-preference" as const,
      })),
  ]
  const profile = profileFactory(settings.profiles[preset.appid])
  profile.state = { ...profile.state }
  let changed = false
  for (const option of selected) {
    // Global preferences protect the entire control. Existing manual overrides
    // are left alone too; presets must neither replace nor erase them.
    if (getGlobalPreference(settings, option)) {
      continue
    }
    changed = true
    if (option.valueId) {
      for (const sibling of settings.launchOptions) {
        if (sibling.valueId === option.valueId) delete profile.state[sibling.id]
      }
    }
    profile.state[option.id] = true
  }
  if (changed) settings.profiles[preset.appid] = profile
  return {
    selected: selected.filter(
      (option) => !getGlobalPreference(settings, option),
    ).length,
    skipped,
  }
}
