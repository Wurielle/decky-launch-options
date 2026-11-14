import assert from "node:assert/strict"
import { test } from "node:test"
import {
  parseStore,
  saveStore,
  getStores,
  deleteStore,
  updateStore,
  moveStore,
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
    {
      url: "https://other.test/store.json",
      store: { ...manifest, name: "Other" },
    },
  ])
  deleteStore("https://other.test/store.json", storage)
  assert.deepEqual(getStores(storage), [])
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
  assert.equal(saved.length, 2)
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
  assert.deepEqual(stores, [{ url, store: updated }, before[1]])
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
  assert.deepEqual(updateStore(url, manifest, storage), [])
  assert.deepEqual(getStores(storage), [])
})

test("moving stores persists their order without changing metadata or crossing boundaries", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  for (const name of ["First", "Second", "Third"])
    saveStore(`https://example.test/${name}.json`, { ...manifest, name }, storage)
  const original = getStores(storage)
  const moved = moveStore(original[1].url, -1, storage)
  assert.deepEqual(moved, [original[1], original[0], original[2]])
  assert.deepEqual(getStores(storage), moved)
  assert.deepEqual(moveStore(original[1].url, -1, storage), moved)
  assert.deepEqual(moveStore(original[2].url, 1, storage), moved)
  assert.deepEqual(moveStore("missing", 1, storage), moved)
  assert.deepEqual(moveStore(original[1].url, 1, storage), original)
  assert.deepEqual(getStores(storage), original)
})
