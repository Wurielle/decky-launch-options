import assert from "node:assert/strict"
import { test } from "node:test"
import {
  parseStore,
  saveStore,
  getStores,
  deleteStore,
  updateStore,
  moveStore,
  defaultRecipeStore,
  recipeStoresStorageKey,
} from "../src/teams/recipe-store/store.ts"
import {
  getRecipesUrl,
  parseRecipes,
} from "../src/teams/recipe-store/recipes.ts"

const manifest = {
  name: "Decky Launch Options Recipes",
  description:
    "A collection of launch option recipes for Decky Launch Options.",
  type: "github",
  github: {
    repository: "Wurielle/decky-launch-options-recipes",
    branch: "feat/store",
  },
}

test("accepts the provided GitHub store shape", () => {
  assert.deepEqual(parseStore(manifest), manifest)
})

test("recipe URLs use each GitHub store's repository and exact branch", () => {
  assert.equal(
    getRecipesUrl(manifest),
    "https://raw.githubusercontent.com/Wurielle/decky-launch-options-recipes/refs/heads/feat%2Fstore/recipes.json",
  )
  assert.equal(
    getRecipesUrl({
      ...manifest,
      github: { repository: "another-owner/another-repo", branch: "main" },
    }),
    "https://raw.githubusercontent.com/another-owner/another-repo/refs/heads/main/recipes.json",
  )
})

test("recipe parsing keeps launch options unchanged and rejects malformed catalogs", () => {
  const recipes = [
    { name: "Example", launchOptions: [{ on: "FLAG=1 %command%" }] },
  ]
  assert.deepEqual(parseRecipes(recipes), recipes)
  assert.deepEqual(parseRecipes([]), [])
  for (const invalid of [
    null,
    {},
    [null],
    [{ name: "" }],
    [{ name: "Example", launchOptions: "invalid" }],
    [{ name: "Example", launchOptions: [null] }],
    [{ name: "Example", launchOptions: [{ on: {} }] }],
    [{ name: "Example", launchOptions: [{ enableGlobally: "false" }] }],
  ]) {
    assert.throws(() => parseRecipes(invalid))
  }
})

test("recipe parsing preserves both lists, either list alone, and literal delimiters", () => {
  const rule = { id: "config", name: "CUSTOM_CONFIG", delimiter: "" }
  const recipes = [
    {
      name: "Both",
      launchOptions: [{ on: 'CUSTOM_CONFIG="first" %command%' }],
      environmentVariableMerges: [rule],
    },
    {
      name: "Merges only",
      environmentVariableMerges: [
        rule,
        { name: "CUSTOM_PATHS", delimiter: "::" },
      ],
    },
    {
      name: "Options only",
      launchOptions: [{ on: "%command% --flag", priority: -1 }],
    },
    { name: "Empty", launchOptions: [], environmentVariableMerges: [] },
  ]
  assert.deepEqual(parseRecipes(recipes), recipes)
})

test("malformed merge declarations are rejected instead of silently importing partial recipes", () => {
  for (const rules of [
    null,
    {},
    "invalid",
    [null],
    [[]],
    [{}],
    [{ name: "CONFIG" }],
    [{ name: "", delimiter: ";" }],
    [{ name: "  ", delimiter: ";" }],
    [{ name: "CONFIG", delimiter: 1 }],
    [{ id: 1, name: "CONFIG", delimiter: ";" }],
  ]) {
    assert.throws(() =>
      parseRecipes([
        {
          name: "Invalid",
          launchOptions: [],
          environmentVariableMerges: rules,
        },
      ]),
    )
  }
  assert.throws(() => parseRecipes([{ name: "Missing lists" }]))
  assert.throws(() =>
    parseRecipes([
      {
        name: "Invalid options",
        launchOptions: null,
        environmentVariableMerges: [],
      },
    ]),
  )
})

test("deleting a store persists the change and keeps other saved stores", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  saveStore("https://example.test/store.json", manifest, storage)
  saveStore(
    "https://other.test/store.json",
    { ...manifest, name: "Other" },
    storage,
  )
  const remaining = deleteStore("https://example.test/store.json", storage)
  assert.deepEqual(getStores(storage), remaining)
  assert.deepEqual(remaining, [
    defaultRecipeStore,
    {
      url: "https://other.test/store.json",
      store: { ...manifest, name: "Other" },
    },
  ])
  deleteStore("https://other.test/store.json", storage)
  assert.deepEqual(getStores(storage), [defaultRecipeStore])
})

test("rejects incomplete stores and old manifest formats", () => {
  for (const invalid of [
    null,
    [],
    {},
    { ...manifest, type: "other" },
    {
      ...manifest,
      github: {
        repository: "https://github.com/example/recipes",
        branch: "main",
      },
    },
    { ...manifest, github: { repository: "example/recipes", branch: "" } },
    {
      name: "Old store",
      description: "",
      repositoryUrl: "https://github.com/example/recipes",
      branch: "main",
    },
  ]) {
    assert.throws(() => parseStore(invalid))
  }
})

test("saves stores by URL and keeps other saved stores", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  saveStore("https://example.test/store.json", manifest, storage)
  saveStore("https://other.test/store.json", manifest, storage)
  saveStore(
    "https://example.test/store.json",
    { ...manifest, name: "Updated" },
    storage,
  )
  const saved = JSON.parse(values.get(recipeStoresStorageKey))
  assert.equal(saved.length, 3)
  assert.equal(
    saved.find((item) => item.url === "https://example.test/store.json").store
      .name,
    "Updated",
  )
  assert.ok(saved.some((item) => item.url === "https://other.test/store.json"))
})

test("updating metadata preserves the saved URL, store order, and other stores", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const url = "https://example.test/store.json"
  saveStore(url, manifest, storage)
  saveStore("https://other.test/store.json", manifest, storage)
  const before = getStores(storage)
  const updated = {
    ...manifest,
    name: "Updated store",
    description: "New description",
    github: { ...manifest.github, branch: "main" },
  }
  const stores = updateStore(url, updated, storage)
  assert.deepEqual(
    stores,
    before.map((item) => (item.url === url ? { url, store: updated } : item)),
  )
  assert.deepEqual(getStores(storage), stores)
})

test("an update completing after deletion does not add the store back", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const url = "https://example.test/store.json"
  saveStore(url, manifest, storage)
  deleteStore(url, storage)
  assert.deepEqual(updateStore(url, manifest, storage), [defaultRecipeStore])
  assert.deepEqual(getStores(storage), [defaultRecipeStore])
})

test("moving stores persists their order without changing metadata or crossing boundaries", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  for (const name of ["First", "Second", "Third"])
    saveStore(
      `https://example.test/${name}.json`,
      { ...manifest, name },
      storage,
    )
  const original = getStores(storage)
  const moved = moveStore(original[1].url, -1, storage)
  assert.deepEqual(moved, [original[1], original[0], ...original.slice(2)])
  assert.deepEqual(getStores(storage), moved)
  assert.deepEqual(moveStore(original[1].url, -1, storage), moved)
  assert.deepEqual(moveStore(original.at(-1).url, 1, storage), moved)
  assert.deepEqual(moveStore("missing", 1, storage), moved)
  assert.deepEqual(moveStore(original[1].url, 1, storage), original)
  assert.deepEqual(getStores(storage), original)
})

test("the built-in dev store is available without saved data and cannot be deleted", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  assert.deepEqual(getStores(storage), [defaultRecipeStore])
  assert.equal(defaultRecipeStore.store.github.branch, "dev")
  assert.deepEqual(deleteStore(defaultRecipeStore.url, storage), [
    defaultRecipeStore,
  ])
  storage.setItem(recipeStoresStorageKey, "[]")
  assert.deepEqual(getStores(storage), [defaultRecipeStore])
})

test("the default is added to existing stores once and retains its reordered position and updates", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const custom = { url: "https://example.test/store.json", store: manifest }
  storage.setItem(recipeStoresStorageKey, JSON.stringify([custom]))
  assert.deepEqual(getStores(storage), [defaultRecipeStore, custom])
  moveStore(defaultRecipeStore.url, 1, storage)
  const updated = { ...defaultRecipeStore.store, description: "Updated info" }
  updateStore(defaultRecipeStore.url, updated, storage)
  const expected = [custom, { ...defaultRecipeStore, store: updated }]
  assert.deepEqual(getStores(storage), expected)
  assert.deepEqual(deleteStore(defaultRecipeStore.url, storage), expected)
  saveStore(defaultRecipeStore.url, updated, storage)
  assert.equal(
    getStores(storage).filter((item) => item.url === defaultRecipeStore.url)
      .length,
    1,
  )
})
