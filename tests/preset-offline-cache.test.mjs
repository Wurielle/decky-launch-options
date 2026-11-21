import assert from "node:assert/strict"
import { test } from "node:test"
import {
  QueryClient,
  QueryObserver,
  onlineManager,
} from "@tanstack/react-query"
import { sourceModule } from "./source-module.mjs"

const { presetQueryOptions } = await import(
  await sourceModule("src/teams/app-presets/discovery.ts")
)
const { createPresetPersistence, presetPersistenceKey } = await import(
  await sourceModule("src/queries/preset-persistence.ts")
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
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}
const snapshot = (storage) => JSON.parse(storage.getItem(presetPersistenceKey))
async function waitForSnapshot(storage, predicate) {
  // The official async persister coalesces concurrent saves into queued writes.
  for (let i = 0; i < 100; i++) {
    if (predicate(snapshot(storage))) return
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  assert.ok(
    predicate(snapshot(storage)),
    "the persisted snapshot was not updated",
  )
}

test("TanStack persistence keeps both scopes after failed refreshes and restores old offline data with infinite retention", async () => {
  const storage = memoryStorage()
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
    let client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })
    let persistence = createPresetPersistence(client, storage)
    await persistence.start()
    const options = presetQueryOptions(store, scope, fetcher)
    let observer = new QueryObserver(client, options)
    let unsubscribe = observer.subscribe(() => {})
    try {
      const data = await client.fetchQuery(options)
      assert.equal(calls, 2)
      unsubscribe()
      await tick()
      assert.deepEqual(client.getQueryData(options.queryKey), data)
      await persistence.save()
      await waitForSnapshot(storage, (saved) =>
        saved?.clientState.queries.some((q) => q.queryKey[2] === scope),
      )
      assert.ok(
        snapshot(storage).clientState.queries.some(
          (q) => q.queryKey[2] === scope,
        ),
      )
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
      await persistence.save()
      await waitForSnapshot(storage, (saved) =>
        saved?.clientState.queries.some(
          (q) =>
            q.queryKey[2] === scope &&
            q.state.dataUpdatedAt < Date.now() - 5 * 60_000,
        ),
      )
      const saved = snapshot(storage)
      const cached = saved.clientState.queries.find(
        (q) => q.queryKey[2] === scope,
      )
      assert.deepEqual(cached.state.data, data)
      assert.equal(cached.state.error, null)
      assert.equal(cached.state.status, "success")
      assert.equal(calls, 3)

      persistence.stop()
      unsubscribe()
      client.clear()
      saved.timestamp = Date.now() - 7 * 24 * 60 * 60_000
      storage.setItem(presetPersistenceKey, JSON.stringify(saved))
      client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })
      persistence = createPresetPersistence(client, storage)
      onlineManager.setOnline(false)
      await persistence.start()
      observer = new QueryObserver(client, options)
      assert.deepEqual(observer.getCurrentResult().data, data)
      assert.equal(
        client.getQueryCache().find({ queryKey: options.queryKey }).gcTime,
        Infinity,
      )
      unsubscribe = observer.subscribe(() => {})
      assert.equal(observer.getCurrentResult().isPending, false)
      assert.equal(observer.getCurrentResult().isPaused, true)
      assert.equal(calls, 3)
    } finally {
      release()
      persistence.stop()
      unsubscribe()
      client.clear()
      onlineManager.setOnline(true)
    }
  }
})

test("persistence excludes settings and mutations and clears transient download errors from the saved copy", async () => {
  const storage = memoryStorage()
  const client = new QueryClient()
  const persistence = createPresetPersistence(client, storage)
  await persistence.start()
  const options = presetQueryOptions(store, "42", () => {})
  try {
    client.setQueryData(["settings"], { privateSettings: true })
    client.getMutationCache().build(
      client,
      { mutationKey: ["save-settings"] },
      {
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isPaused: true,
        status: "pending",
        variables: {},
        submittedAt: Date.now(),
      },
    )
    const data = { presets: [definition], errors: ["Transient network error"] }
    client.setQueryData(options.queryKey, data)
    await persistence.save()
    await waitForSnapshot(
      storage,
      (saved) => saved?.clientState.queries.length === 1,
    )
    const saved = snapshot(storage)
    assert.equal(saved.clientState.queries.length, 1)
    assert.equal(saved.clientState.mutations.length, 0)
    assert.deepEqual(saved.clientState.queries[0].state.data, {
      presets: [definition],
      errors: [],
    })
    assert.deepEqual(
      client.getQueryData(options.queryKey),
      data,
      "saving does not change live UI state",
    )
    persistence.stop()
    await tick()
    const before = storage.getItem(presetPersistenceKey)
    client.setQueryData(options.queryKey, { presets: [], errors: [] })
    await tick()
    assert.equal(
      storage.getItem(presetPersistenceKey),
      before,
      "unload stops the subscription",
    )
  } finally {
    persistence.stop()
    client.clear()
  }
})

test("persistence waits for restoration and unloading during restoration cannot overwrite saved lists", async () => {
  const storage = memoryStorage()
  const original = storage.getItem
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  storage.getItem = async (key) => {
    await gate
    return original(key)
  }
  const client = new QueryClient()
  const persistence = createPresetPersistence(client, storage)
  let ready = false
  const restoration = persistence.start().then(() => {
    ready = true
  })
  await tick()
  assert.equal(ready, false)
  await persistence.save()
  assert.equal(storage.values.size, 0)
  persistence.stop()
  release()
  await restoration
  client.setQueryData(["app-presets", "store", "*"], {
    presets: [definition],
    errors: [],
  })
  await tick()
  assert.equal(
    storage.values.size,
    0,
    "late restoration cannot subscribe after unload",
  )
  client.clear()
})

test("failed file downloads keep their previous definitions and malformed saved definitions are skipped", async () => {
  const storage = memoryStorage()
  let client = new QueryClient()
  let persistence = createPresetPersistence(client, storage)
  await persistence.start()
  const data = { presets: [definition], errors: [] }
  const options = presetQueryOptions(store, "42", async (url) =>
    url.includes("api.github.com")
      ? response([{ type: "file", name: "preset.json" }])
      : response(null, 500),
  )
  try {
    client.setQueryData(options.queryKey, data)
    const updated = await options.queryFn({
      signal: new AbortController().signal,
      client,
    })
    assert.deepEqual(updated.presets, [definition])
    assert.match(updated.errors[0], /500/)
    client.setQueryData(options.queryKey, updated)
    await persistence.save()
    await waitForSnapshot(
      storage,
      (saved) => saved?.clientState.queries.length === 1,
    )
    persistence.stop()
    const saved = snapshot(storage)
    saved.clientState.queries[0].state.data.presets[0].author = "Invalid author"
    storage.setItem(presetPersistenceKey, JSON.stringify(saved))
    client.clear()
    client = new QueryClient()
    persistence = createPresetPersistence(client, storage)
    await persistence.start()
    assert.equal(client.getQueryData(options.queryKey), undefined)
  } finally {
    persistence.stop()
    client.clear()
  }
})
