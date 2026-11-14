export interface GithubStore {
  name: string
  description: string
  type: "github"
  github: {
    repository: string
    branch: string
  }
}

export interface SavedStore {
  url: string
  store: GithubStore
}

export const recipeStoresStorageKey = "decky-launch-options-recipe-stores"

type StoreStorage = Pick<Storage, "getItem" | "setItem">

export function parseStore(value: unknown): GithubStore {
  const data = value as Partial<GithubStore> | null
  if (
    !data ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    typeof data.description !== "string" ||
    data.type !== "github" ||
    !data.github ||
    typeof data.github.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(data.github.repository) ||
    typeof data.github.branch !== "string" ||
    !data.github.branch.trim()
  ) {
    throw new Error(
      "Expected store JSON with name, description, type: github, and github.repository and github.branch.",
    )
  }
  return {
    name: data.name,
    description: data.description,
    type: "github",
    github: {
      repository: data.github.repository,
      branch: data.github.branch,
    },
  }
}

export function getStores(storage: StoreStorage = localStorage): SavedStore[] {
  const saved: SavedStore[] = JSON.parse(
    storage.getItem(recipeStoresStorageKey) ?? "[]",
  )
  if (!Array.isArray(saved)) throw new Error("Saved stores could not be read.")
  for (const item of saved) {
    if (!item || typeof item.url !== "string")
      throw new Error("Saved stores could not be read.")
    parseStore(item.store)
  }
  return saved
}

export function saveStore(
  url: string,
  store: GithubStore,
  storage: StoreStorage = localStorage,
) {
  const saved = getStores(storage)
  const stores = saved.filter((item) => item.url !== url)
  stores.push({ url, store })
  storage.setItem(recipeStoresStorageKey, JSON.stringify(stores))
}

export function deleteStore(url: string, storage: StoreStorage = localStorage) {
  const stores = getStores(storage).filter((item) => item.url !== url)
  storage.setItem(recipeStoresStorageKey, JSON.stringify(stores))
  return stores
}

export function updateStore(
  url: string,
  store: GithubStore,
  storage: StoreStorage = localStorage,
) {
  const stores = getStores(storage).map((item) =>
    item.url === url ? { ...item, store } : item,
  )
  storage.setItem(recipeStoresStorageKey, JSON.stringify(stores))
  return stores
}

export function moveStore(
  url: string,
  direction: -1 | 1,
  storage: StoreStorage = localStorage,
) {
  const stores = getStores(storage)
  const index = stores.findIndex((item) => item.url === url)
  const target = index + direction
  if (index < 0 || target < 0 || target >= stores.length) return stores
  ;[stores[index], stores[target]] = [stores[target], stores[index]]
  storage.setItem(recipeStoresStorageKey, JSON.stringify(stores))
  return stores
}
