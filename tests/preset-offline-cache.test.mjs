import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { sourceModule } from "./source-module.mjs"

const require = createRequire(import.meta.resolve("@tanstack/react-query"))
const { QueryClient, QueryObserver } = require("@tanstack/query-core")
const { presetQueryOptions } = await import(
  await sourceModule("src/teams/app-presets/discovery.ts")
)
const { readPresetCache, writePresetCache } = await import(
  await sourceModule("src/teams/app-presets/cache.ts")
)
const store = {
  url: "https://example.test/store.json",
  store: {
    name: "Store",
    description: "",
    type: "github",
    github: { repository: "example/store", branch: "main" },
  },
}
const definition = {
  id: "preset",
  name: "Preset",
  author: "Example",
  description: "",
  notes: [],
  launchOptions: [{ recipeId: "renderer", launchOptionId: "install" }],
}
const response = (data, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
})
const tick = () => new Promise((resolve) => setImmediate(resolve))
function memoryStorage() {
  const values = new Map()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test("both scopes stay in memory, refresh after five minutes without dropping cached data, and reload offline from storage", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const storage = memoryStorage()
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  })
  try {
    for (const scope of ["42", "*"]) {
      let offline = false,
        calls = 0,
        release
      const gate = new Promise((resolve) => {
        release = resolve
      })
      const fetcher = async (url) => {
        calls++
        if (offline) {
          await gate
          throw new Error("Offline")
        }
        return response(
          url.includes("api.github.com")
            ? [{ type: "file", name: "preset.json" }]
            : definition,
        )
      }
      let client = new QueryClient({
        defaultOptions: { queries: { gcTime: 0 } },
      })
      let options = presetQueryOptions(store, scope, fetcher)
      assert.equal(options.staleTime, 5 * 60_000)
      assert.equal(options.gcTime, Infinity)
      let observer = new QueryObserver(client, options)
      let unsubscribe = observer.subscribe(() => {})
      try {
        const data = await client.fetchQuery(options)
        assert.equal(calls, 2)
        unsubscribe()
        await tick()
        assert.deepEqual(client.getQueryData(options.queryKey), data)
        assert.deepEqual(readPresetCache(options.queryKey).data, data)
        client.setQueryData(options.queryKey, data, {
          updatedAt: Date.now() - 6 * 60_000,
        })
        offline = true
        observer = new QueryObserver(client, options)
        unsubscribe = observer.subscribe(() => {})
        await tick()
        assert.equal(observer.getCurrentResult().isFetching, true)
        assert.equal(observer.getCurrentResult().isPending, false)
        assert.deepEqual(observer.getCurrentResult().data, data)
        const failed = client.fetchQuery(options)
        release()
        await assert.rejects(failed, /Offline/)
        assert.equal(observer.getCurrentResult().isRefetchError, true)
        assert.deepEqual(client.getQueryData(options.queryKey), data)
        assert.equal(calls, 3)

        unsubscribe()
        client.clear()
        // Simulate a plugin restart with an old saved copy and no network.
        for (const [key, value] of storage.values) {
          const saved = JSON.parse(value)
          saved.updatedAt = Date.now() - 60 * 60_000
          storage.setItem(key, JSON.stringify(saved))
        }
        client = new QueryClient()
        options = presetQueryOptions(store, scope, fetcher)
        observer = new QueryObserver(client, options)
        assert.deepEqual(observer.getCurrentResult().data, data)
        unsubscribe = observer.subscribe(() => {})
        await assert.rejects(client.fetchQuery(options), /Offline/)
        assert.deepEqual(observer.getCurrentResult().data, data)
      } finally {
        release()
        unsubscribe()
        client.clear()
      }
    }
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor)
    else delete globalThis.localStorage
  }
})

test("a failed preset file refresh preserves its last downloaded definition", async () => {
  const storage = memoryStorage()
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  })
  const client = new QueryClient()
  try {
    const initial = presetQueryOptions(store, "42", () => {})
    const data = { presets: [definition], errors: [] }
    writePresetCache(initial.queryKey, data)
    const options = presetQueryOptions(store, "42", async (url) =>
      url.includes("api.github.com")
        ? response([{ type: "file", name: "preset.json" }])
        : response(null, 500),
    )
    client.setQueryData(options.queryKey, data)
    const updated = await options.queryFn({
      signal: new AbortController().signal,
      client,
    })
    assert.deepEqual(updated.presets, [definition])
    assert.match(updated.errors[0], /500/)
    assert.deepEqual(readPresetCache(options.queryKey).data, data)
  } finally {
    client.clear()
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor)
    else delete globalThis.localStorage
  }
})

test("saved caches are scoped to the exact store, branch and game, and unusable storage never blocks loading", () => {
  const storage = memoryStorage()
  const key = presetQueryOptions(store, "*", () => {}).queryKey
  const data = { presets: [definition], errors: ["Transient network error"] }
  writePresetCache(key, data, storage)
  assert.deepEqual(readPresetCache(key, storage).data, {
    presets: [definition],
    errors: [],
  })
  for (const scope of ["42", "43"])
    assert.equal(
      readPresetCache(
        presetQueryOptions(store, scope, () => {}).queryKey,
        storage,
      ),
      undefined,
    )
  const otherBranch = {
    ...store,
    store: {
      ...store.store,
      github: { ...store.store.github, branch: "other" },
    },
  }
  assert.equal(
    readPresetCache(
      presetQueryOptions(otherBranch, "*", () => {}).queryKey,
      storage,
    ),
    undefined,
  )
  const savedKey = [...storage.values.keys()][0]
  for (const value of [
    "bad JSON",
    "null",
    JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      presets: [{ ...definition, author: "bad author" }],
    }),
  ]) {
    storage.setItem(savedKey, value)
    assert.equal(readPresetCache(key, storage), undefined)
  }
  const unavailable = {
    getItem: () => {
      throw new Error("Unavailable")
    },
    setItem: () => {
      throw new Error("Full")
    },
  }
  assert.equal(readPresetCache(key, unavailable), undefined)
  assert.doesNotThrow(() => writePresetCache(key, data, unavailable))
})
