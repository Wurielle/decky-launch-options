import type { Recipe } from "../../shared"
import type { GithubStore } from "./store"

export function getRecipesUrl(store: GithubStore): string {
  const repository = store.github.repository
    .split("/")
    .map(encodeURIComponent)
    .join("/")
  const branch = encodeURIComponent(store.github.branch)
  return `https://raw.githubusercontent.com/${repository}/refs/heads/${branch}/recipes.json`
}

export function parseRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value)) throw new Error("Expected a recipes.json array.")
  const strings = ["id", "name", "group", "on", "off", "valueId", "valueName"]
  const booleans = ["enableGlobally", "fallbackValue"]
  return value.map((recipe: unknown) => {
    const item = recipe as Partial<Recipe> | null
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      (item.launchOptions === undefined &&
        item.environmentVariableMerges === undefined) ||
      (item.launchOptions !== undefined &&
        !Array.isArray(item.launchOptions)) ||
      (item.environmentVariableMerges !== undefined &&
        !Array.isArray(item.environmentVariableMerges))
    ) {
      throw new Error(
        "Each recipe must have a name and a launchOptions or environmentVariableMerges array.",
      )
    }
    for (const option of item.launchOptions ?? []) {
      if (
        !option ||
        typeof option !== "object" ||
        Array.isArray(option) ||
        strings.some(
          (key) =>
            key in option &&
            typeof (option as Record<string, unknown>)[key] !== "string",
        ) ||
        booleans.some(
          (key) =>
            key in option &&
            typeof (option as Record<string, unknown>)[key] !== "boolean",
        ) ||
        ("priority" in option &&
          (typeof option.priority !== "number" ||
            !Number.isFinite(option.priority)))
      ) {
        throw new Error(`Invalid launch option in recipe "${item.name}".`)
      }
    }
    for (const merge of item.environmentVariableMerges ?? []) {
      if (
        !merge ||
        typeof merge !== "object" ||
        Array.isArray(merge) ||
        ("id" in merge && typeof merge.id !== "string") ||
        typeof merge.name !== "string" ||
        !merge.name.trim() ||
        typeof merge.delimiter !== "string"
      ) {
        throw new Error(
          `Invalid environment variable merge in recipe "${item.name}".`,
        )
      }
    }
    return {
      name: item.name,
      ...(item.launchOptions === undefined
        ? {}
        : { launchOptions: item.launchOptions }),
      ...(item.environmentVariableMerges === undefined
        ? {}
        : { environmentVariableMerges: item.environmentVariableMerges }),
    }
  })
}
