import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { sourceModule } from "./source-module.mjs"

const require = createRequire(import.meta.resolve("@tanstack/react-query"))
const { QueryClient, QueryObserver } = require("@tanstack/query-core")
const { presetQueryOptions } = await import(
  await sourceModule("src/teams/app-presets/discovery.ts")
)
const { bindPresetToApp, prepareRecipeImport, applyPreset } = await import(
  await sourceModule("src/teams/app-presets/model.ts")
)
const { launchOptionFactory } = await import("../src/shared.ts")
const store = {
  url: "https://example.test/store.json",
  store: {
    name: "Example",
    description: "",
    type: "github",
    github: { repository: "example/recipes", branch: "main" },
  },
}
const definition = {
  id: "universal",
  name: "Universal",
  author: "Example",
  description: "",
  launchOptions: [{ recipeId: "renderer", launchOptionId: "install" }],
}
const response = (data, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
})
const tick = () => new Promise((resolve) => setImmediate(resolve))

test("fresh global cache is shared across games and explicit refresh still binds to the current app", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })
  const calls = []
  const fetcher = async (url) => {
    calls.push(url)
    if (!url.includes("/steam/%2A")) return response(null, 404)
    return response(
      url.includes("api.github.com")
        ? [{ type: "file", name: "universal.json" }]
        : definition,
    )
  }
  const options = presetQueryOptions(store, "*", fetcher)
  let observer = new QueryObserver(client, options)
  let unsubscribe = observer.subscribe(() => {})
  try {
    const global = await client.fetchQuery(options)
    assert.equal(calls.length, 2)
    const first = bindPresetToApp(global.presets[0], store, "42", "*")
    unsubscribe()
    await tick()
    assert.equal(client.getQueryData(options.queryKey), global)
    observer = new QueryObserver(client, options)
    unsubscribe = observer.subscribe(() => {})
    await Promise.all([
      client.fetchQuery(presetQueryOptions(store, "43", fetcher)),
      client.fetchQuery(presetQueryOptions(store, "44", fetcher)),
    ])
    client.getQueryCache().onFocus()
    client.getQueryCache().onOnline()
    await tick()
    assert.equal(calls.filter((url) => url.includes("/steam/%2A")).length, 2)
    const next = bindPresetToApp(
      client.getQueryData(options.queryKey).presets[0],
      store,
      "43",
      "*",
    )
    assert.notEqual(first.key, next.key)
    assert.equal(first.appid, "42")
    assert.equal(next.appid, "43")
    assert.equal(global.presets[0].appid, undefined)
    const settings = {
      profiles: {
        42: { state: { untouched: true }, originalLaunchOptions: "keep" },
      },
      launchOptions: prepareRecipeImport(
        {
          id: "renderer",
          name: "Renderer",
          launchOptions: [{ id: "install" }],
        },
        store,
      ).launchOptions.map(launchOptionFactory),
      environmentVariableMerges: [],
    }
    applyPreset(settings, next)
    assert.deepEqual(settings.profiles["42"].state, { untouched: true })
    assert.equal(
      settings.profiles["43"].state[settings.launchOptions[0].id],
      true,
    )
    assert.equal(settings.profiles["*"], undefined)
    await observer.refetch()
    assert.equal(calls.filter((url) => url.includes("/steam/%2A")).length, 4)

    const branch = {
      ...store,
      store: {
        ...store.store,
        github: { ...store.store.github, branch: "other" },
      },
    }
    await client.fetchQuery(presetQueryOptions(branch, "*", fetcher))
    assert.equal(calls.filter((url) => url.includes("/steam/%2A")).length, 6)
    await client.fetchQuery(options)
    assert.equal(calls.filter((url) => url.includes("/steam/%2A")).length, 6)
  } finally {
    unsubscribe()
    client.clear()
  }
})

test("global discovery stays in flight across unmount and is shared by the next game", async () => {
  const client = new QueryClient()
  let calls = 0,
    release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const options = presetQueryOptions(store, "*", async (url) => {
    calls++
    if (url.includes("api.github.com")) {
      await gate
      return response([{ type: "file", name: "universal.json" }])
    }
    return response(definition)
  })
  const first = new QueryObserver(client, options)
  const stopFirst = first.subscribe(() => {})
  await tick()
  assert.equal(calls, 1)
  stopFirst()
  const second = new QueryObserver(client, options)
  const stopSecond = second.subscribe(() => {})
  try {
    await tick()
    assert.equal(calls, 1)
    release()
    const result = await client.fetchQuery(options)
    assert.equal(calls, 2)
    assert.equal(result.presets.length, 1)
    assert.equal(second.getCurrentResult().status, "success")
  } finally {
    release()
    stopSecond()
    client.clear()
  }
})

test("empty game and global results stay cached while fresh", async () => {
  for (const scope of ["42", "*"]) {
    const client = new QueryClient()
    let calls = 0
    const options = presetQueryOptions(store, scope, async () => {
      calls++
      return response([], 404)
    })
    let observer = new QueryObserver(client, options)
    let unsubscribe = observer.subscribe(() => {})
    try {
      await client.fetchQuery(options)
      unsubscribe()
      observer = new QueryObserver(client, options)
      unsubscribe = observer.subscribe(() => {})
      client.getQueryCache().onFocus()
      client.getQueryCache().onOnline()
      await tick()
      assert.equal(calls, 1)
      await observer.refetch()
      assert.equal(calls, 2)
    } finally {
      unsubscribe()
      client.clear()
    }
  }
})

test("preset files download concurrently within the shared four-request limit and retain directory order", async () => {
  let active = 0,
    peak = 0
  const ids = Array.from({ length: 7 }, (_, i) => `preset-${i}`)
  const options = presetQueryOptions(store, "42", async (url) => {
    if (url.includes("api.github.com"))
      return response(ids.map((id) => ({ type: "file", name: `${id}.json` })))
    const id = ids.find((id) => url.endsWith(`${id}.json`))
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) =>
      setTimeout(resolve, (8 - ids.indexOf(id)) * 2),
    )
    active--
    return response({ ...definition, id })
  })
  const result = await options.queryFn({ signal: new AbortController().signal })
  assert.equal(peak, 4)
  assert.deepEqual(
    result.presets.map((preset) => preset.id),
    ids,
  )
})
