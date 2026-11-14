import type { LaunchOption } from "../../shared"
import type { GithubStore } from "./store"

export interface Recipe {
  name: string
  launchOptions: Partial<LaunchOption>[]
}

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
      !Array.isArray(item.launchOptions)
    ) {
      throw new Error("Each recipe must have a name and a launchOptions array.")
    }
    for (const option of item.launchOptions) {
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
    return { name: item.name, launchOptions: item.launchOptions }
  })
}
