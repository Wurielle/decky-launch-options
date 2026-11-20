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

export async function readRecipeCatalog(
  response: Pick<Response, "json">,
): Promise<Recipe[]> {
  let value: unknown
  try {
    value = await response.json()
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const recipes: Recipe[] = []
  const ids = new Set<string>()
  for (const item of value) {
    try {
      const [recipe] = parseRecipes([item])
      if (recipe.id && ids.has(recipe.id)) continue
      if (recipe.id) ids.add(recipe.id)
      recipes.push(recipe)
    } catch {
      // Skip invalid recipes without hiding valid entries in the catalog.
    }
  }
  return recipes
}

export function parseRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value)) throw new Error("Expected a recipes.json array.")
  const strings = ["id", "name", "group", "on", "off", "valueId", "valueName"]
  const booleans = ["enableGlobally", "fallbackValue"]
  const ids = new Set<string>()
  return value.map((recipe: unknown) => {
    const item = recipe as Partial<Recipe> | null
    if (
      !item ||
      (item.id !== undefined &&
        (typeof item.id !== "string" || !item.id.trim())) ||
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
    if (item.id) {
      if (ids.has(item.id)) throw new Error(`Duplicate recipe ID: ${item.id}.`)
      ids.add(item.id)
    }
    const optionIds = new Set<string>()
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
      if (option.id) {
        if (optionIds.has(option.id))
          throw new Error(
            `Duplicate launch option ID in recipe "${item.name}": ${option.id}.`,
          )
        optionIds.add(option.id)
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
      ...(item.id === undefined ? {} : { id: item.id }),
      name: item.name,
      ...(item.launchOptions === undefined
        ? {}
        : {
            // Provenance and activation policy are trusted local metadata,
            // never assertions accepted from a remote catalog (even legacy IDs).
            launchOptions: item.launchOptions.map(
              ({
                source: _source,
                requireExplicitSelection: _policy,
                ...option
              }) => option,
            ),
          }),
      ...(item.environmentVariableMerges === undefined
        ? {}
        : { environmentVariableMerges: item.environmentVariableMerges }),
    }
  })
}
