import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { parseRecipes } from "../src/teams/recipe-store/recipes.ts"
import { sourceModule } from "./source-module.mjs"
import { launchOptionFactory } from "../src/shared.ts"

const store = {
  url: "https://example.test/store.json",
  store: {
    name: "Example",
    description: "",
    type: "github",
    github: { repository: "example/recipes", branch: "feat/render" },
  },
}
const presetData = {
  id: "handheld",
  name: "Handheld",
  author: "Example",
  description: "Enable rendering",
  launchOptions: [{ recipeId: "renderer", launchOptionId: "install" }],
}
const model = () =>
  sourceModule("src/teams/app-presets/model.ts").then((url) => import(url))

test("preset author and optional notes survive parsing while malformed metadata is rejected", async () => {
  const { parsePreset } = await model()
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/app-presets/fsr4.json", import.meta.url), "utf8"),
  )
  const published = parsePreset(fixture, "fsr4.json", store, "42", "*")
  assert.equal(published.author, "Wurielle")
  assert.deepEqual(published.notes, fixture.notes)
  assert.equal(published.sourceAppid, "*")
  const data = {
    ...presetData,
    author: "Wurielle",
    notes: ["First note", "Second\nline"],
  }
  const preset = parsePreset(data, "handheld.json", store, "42")
  assert.equal(preset.author, "Wurielle")
  assert.deepEqual(preset.notes, data.notes)
  data.notes.push("Later edit")
  assert.equal(preset.notes.length, 2)
  assert.deepEqual(
    parsePreset(presetData, "handheld.json", store, "42").notes,
    [],
  )
  for (const author of [
    undefined,
    null,
    "",
    "@Wurielle",
    "https://github.com/Wurielle",
    "Two names",
  ])
    assert.throws(() =>
      parsePreset({ ...presetData, author }, "handheld.json", store, "42"),
    )
  for (const notes of [null, "Not an array", {}, [42]])
    assert.throws(() =>
      parsePreset({ ...presetData, notes }, "handheld.json", store, "42"),
    )
})

test("independent wildcard discovery binds cached definitions only to the current app", async () => {
  const { presetQueryOptions } = await import(
    await sourceModule("src/teams/app-presets/discovery.ts")
  )
  const { prepareRecipeImport, applyPreset, bindPresetToApp } = await model()
  const calls = []
  let mode = "both"
  const fetcher = async (url) => {
    calls.push(url)
    const wildcard = new URL(url).pathname.includes("/steam/%2A")
    const directory = url.includes("api.github.com")
    const status =
      directory && !wildcard && mode === "failed-app"
        ? 500
        : directory &&
            ((!wildcard && mode === "missing-app") ||
              (wildcard && mode === "missing-wildcard"))
          ? 404
          : 200
    return {
      ok: status === 200,
      status,
      json: async () =>
        directory
          ? [{ type: "file", name: "handheld.json" }]
          : wildcard
            ? {
                ...presetData,
                author: "Wurielle",
                name: "Universal",
                notes: ["All apps"],
              }
            : presetData,
    }
  }
  const discover = (scope) =>
    presetQueryOptions(store, scope, fetcher).queryFn({
      signal: new AbortController().signal,
    })
  const [game, global] = await Promise.all([discover("42"), discover("*")])
  assert.equal(game.presets.length, 1)
  assert.equal(global.presets.length, 1)
  assert.deepEqual(game.errors, [])
  assert.deepEqual(global.errors, [])
  assert.equal(global.presets[0].appid, undefined)
  const specific = bindPresetToApp(game.presets[0], store, "42")
  const universal = bindPresetToApp(global.presets[0], store, "42", "*")
  assert.equal(specific.sourceAppid, "42")
  assert.equal(universal.sourceAppid, "*")
  assert.equal(universal.appid, "42")
  assert.notEqual(specific.key, universal.key)
  assert.equal(universal.author, "Wurielle")
  assert.deepEqual(universal.notes, ["All apps"])
  assert.ok(
    calls.includes(
      "https://api.github.com/repos/example/recipes/contents/presets/steam/%2A?ref=feat%2Frender",
    ),
  )
  assert.ok(
    calls.includes(
      "https://raw.githubusercontent.com/example/recipes/refs/heads/feat%2Frender/presets/steam/%2A/handheld.json",
    ),
  )
  const settings = {
    profiles: {
      99: { state: { unchanged: true }, originalLaunchOptions: "other" },
    },
    launchOptions: prepareRecipeImport(
      { id: "renderer", name: "Renderer", launchOptions: [{ id: "install" }] },
      store,
    ).launchOptions.map(launchOptionFactory),
    environmentVariableMerges: [],
  }
  const other = structuredClone(settings.profiles[99])
  assert.equal(applyPreset(settings, universal).selected, 1)
  assert.equal(settings.profiles[42].state[settings.launchOptions[0].id], true)
  assert.deepEqual(settings.profiles[99], other)
  assert.equal(settings.profiles["*"], undefined)
  mode = "missing-app"
  assert.deepEqual(await discover("43"), { presets: [], errors: [] })
  const nextGame = bindPresetToApp(global.presets[0], store, "43", "*")
  assert.equal(nextGame.appid, "43")
  assert.notEqual(nextGame.key, universal.key)
  mode = "failed-app"
  await assert.rejects(
    discover("42"),
    /Could not download presets \(HTTP 500\)/,
  )
  assert.equal(universal.sourceAppid, "*")
  mode = "missing-wildcard"
  assert.deepEqual(await discover("*"), { presets: [], errors: [] })
  const onlySpecific = await discover("42")
  assert.equal(onlySpecific.presets.length, 1)
  assert.deepEqual(onlySpecific.errors, [])
})

test("a store-scoped preset resolves only its imported provenance and applies atomically to one app", async () => {
  const {
    parsePreset,
    prepareRecipeImport,
    resolvePreset,
    applyPreset,
    isPresetSelected,
  } = await model()
  const preset = parsePreset(presetData, "handheld.json", store, "42")
  const imported = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [
        { id: "install", name: "Install", on: "setup && %command%" },
      ],
    },
    store,
  )
  const other = prepareRecipeImport(
    {
      id: "renderer",
      name: "Other",
      launchOptions: [{ id: "install", on: "other %command%" }],
    },
    { ...store, url: "https://other.test/store.json" },
  )
  const settings = {
    launchOptions: [...imported.launchOptions, ...other.launchOptions].map(
      launchOptionFactory,
    ),
    profiles: {
      42: { state: { unrelated: true }, originalLaunchOptions: "original" },
      43: { state: {}, originalLaunchOptions: "other" },
    },
    environmentVariableMerges: [],
  }
  assert.notEqual(settings.launchOptions[0].id, settings.launchOptions[1].id)
  assert.equal(
    resolvePreset(preset, {
      ...settings,
      launchOptions: [settings.launchOptions[1]],
    }).missing.length,
    1,
  )
  assert.equal(isPresetSelected(preset, settings), false)
  const before = structuredClone(settings)
  assert.deepEqual(applyPreset(settings, preset), { selected: 1, skipped: [] })
  assert.equal(isPresetSelected(preset, settings), true)
  assert.equal(settings.profiles[42].state[settings.launchOptions[0].id], true)
  assert.deepEqual(settings.profiles[43], before.profiles[43])
  assert.deepEqual(settings.launchOptions, before.launchOptions)
  assert.equal(settings.profiles[42].state.unrelated, true)
  assert.equal(settings.profiles[42].originalLaunchOptions, "original")
})

test("malformed and duplicate preset references are rejected before any settings write", async () => {
  const { parsePreset, applyPreset } = await model()
  const invalid = [
    null,
    {},
    { ...presetData, id: "wrong" },
    { ...presetData, name: " " },
    { ...presetData, launchOptions: [] },
    { ...presetData, launchOptions: [null] },
    {
      ...presetData,
      launchOptions: [{ recipeId: "renderer", launchOptionId: 3 }],
    },
    {
      ...presetData,
      launchOptions: [...presetData.launchOptions, ...presetData.launchOptions],
    },
    {
      ...presetData,
      launchOptions: [{ ...presetData.launchOptions[0], on: "bad command" }],
    },
  ]
  for (const data of invalid)
    assert.throws(
      () => parsePreset(data, "handheld.json", store, "42"),
      /preset|reference/i,
    )
  const settings = {
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  }
  assert.throws(() =>
    applyPreset(settings, {
      ...parsePreset(presetData, "handheld.json", store, "42"),
      launchOptions: [null],
    }),
  )
  assert.deepEqual(settings.profiles, {})
})

test("dropdown application replaces only its siblings, inherits effective defaults, and rejects conflicting choices atomically", async () => {
  const { parsePreset, prepareRecipeImport, applyPreset, isPresetSelected } =
    await model()
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      {
        id: "low",
        name: "Quality",
        valueId: "quality",
        valueName: "Low",
        fallbackValue: true,
      },
      { id: "high", name: "Quality", valueId: "quality", valueName: "High" },
    ],
  }
  const options = prepareRecipeImport(recipe, store).launchOptions.map(
    launchOptionFactory,
  )
  const settings = {
    profiles: {},
    launchOptions: options,
    environmentVariableMerges: [],
  }
  const data = {
    ...presetData,
    launchOptions: [{ recipeId: "renderer", launchOptionId: "low" }],
  }
  const inherited = parsePreset(data, "handheld.json", store, "42")
  assert.equal(isPresetSelected(inherited, settings), true)
  const desired = parsePreset(
    {
      ...data,
      launchOptions: [{ recipeId: "renderer", launchOptionId: "high" }],
    },
    "handheld.json",
    store,
    "42",
  )
  applyPreset(settings, desired)
  assert.equal(isPresetSelected(inherited, settings), false)
  assert.equal(isPresetSelected(desired, settings), true)
  assert.equal(settings.launchOptions[0].enableGlobally, false)
  assert.equal(settings.launchOptions[1].enableGlobally, false)
  settings.profiles[42].state[options[1].id] = false
  assert.equal(isPresetSelected(desired, settings), false)
  const conflict = parsePreset(
    {
      ...data,
      launchOptions: [...data.launchOptions, ...desired.launchOptions],
    },
    "handheld.json",
    store,
    "42",
  )
  const before = structuredClone(settings)
  assert.throws(() => applyPreset(settings, conflict), /conflicting/i)
  assert.deepEqual(settings, before)
  const ambiguous = { ...settings, launchOptions: [...options, options[0]] }
  assert.throws(() => applyPreset(ambiguous, inherited), /ambiguous/i)
})

test("preset discovery uses the configured Contents path and ignores non-file/non-JSON entries", async () => {
  const { presetQueryOptions } = await import(
    await sourceModule("src/teams/app-presets/discovery.ts")
  )
  const calls = []
  const fetcher = async (url, init) => {
    assert.equal(
      init?.cache,
      "no-store",
      "explicit refresh must bypass the HTTP cache",
    )
    assert.equal(init?.credentials, "omit")
    calls.push(url)
    return {
      ok: true,
      status: 200,
      json: async () =>
        calls.length === 1
          ? [
              {
                type: "file",
                name: "handheld.json",
                download_url: "https://untrusted.test/payload",
              },
              { type: "dir", name: "nested.json" },
              { type: "file", name: "notes.md" },
            ]
          : presetData,
    }
  }
  const query = presetQueryOptions(store, "42", fetcher)
  const result = await query.queryFn({ signal: new AbortController().signal })
  assert.equal(result.presets.length, 1)
  assert.deepEqual(result.errors, [])
  assert.equal(
    calls[0],
    "https://api.github.com/repos/example/recipes/contents/presets/steam/42?ref=feat%2Frender",
  )
  assert.equal(
    calls[1],
    "https://raw.githubusercontent.com/example/recipes/refs/heads/feat%2Frender/presets/steam/42/handheld.json",
  )
  assert.equal(result.presets[0].id, "handheld")
  assert.equal(result.presets[0].appid, undefined)
  assert.notDeepEqual(
    query.queryKey,
    presetQueryOptions(store, "43", fetcher).queryKey,
  )
  assert.notDeepEqual(
    query.queryKey,
    presetQueryOptions(
      {
        ...store,
        store: {
          ...store.store,
          github: { ...store.store.github, branch: "main" },
        },
      },
      "42",
      fetcher,
    ).queryKey,
  )
})

test("discovery bounds requests across stores, preserves good files, and distinguishes absence from errors", async () => {
  const { presetQueryOptions } = await import(
    await sourceModule("src/teams/app-presets/discovery.ts")
  )
  let active = 0,
    peak = 0
  const fetcher = async (url) => {
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 2))
    active--
    if (url.includes("/steam/%2A"))
      return { ok: false, status: 404, json: async () => ({}) }
    return {
      ok: !url.includes("unavailable.json"),
      status: url.includes("unavailable.json") ? 500 : 200,
      json: async () =>
        url.includes("api.github")
          ? [
              { type: "file", name: "handheld.json" },
              { type: "file", name: "invalid.json" },
              { type: "file", name: "handheld.json" },
              { type: "file", name: "invalid/name.json" },
              { type: "file", name: "unavailable.json" },
            ]
          : url.includes("invalid.json")
            ? { bad: true }
            : presetData,
    }
  }
  const results = await Promise.all(
    Array.from({ length: 9 }, (_, i) =>
      presetQueryOptions(
        { ...store, url: `https://store${i}.test/store.json` },
        "42",
        fetcher,
      ).queryFn({ signal: new AbortController().signal }),
    ),
  )
  assert.ok(peak <= 4, `peak ${peak} exceeds four concurrent requests`)
  assert.ok(
    results.every(
      (result) =>
        result.presets.length === 1 &&
        result.errors.length === 1 &&
        result.errors[0] === "Could not download presets (HTTP 500).",
    ),
  )
  for (const entries of [{ invalid: true }, null]) {
    const query = presetQueryOptions(store, "42", async () => ({
      ok: true,
      status: 200,
      json: async () => entries,
    }))
    assert.deepEqual(
      await query.queryFn({ signal: new AbortController().signal }),
      { presets: [], errors: [] },
    )
  }
  for (const status of [404, 403, 429, 500]) {
    const query = presetQueryOptions(store, "42", async () => ({
      ok: false,
      status,
      json: async () => ({}),
    }))
    const operation = query.queryFn({ signal: new AbortController().signal })
    if (status === 404)
      assert.deepEqual(await operation, { presets: [], errors: [] })
    else
      await assert.rejects(
        operation,
        status === 403 || status === 429 ? /rate.limit|permission/i : /500/,
      )
  }
  const aborted = new AbortController()
  aborted.abort()
  let called = false
  await assert.rejects(
    presetQueryOptions(store, "42", async () => {
      called = true
    }).queryFn({ signal: aborted.signal }),
    /abort/i,
  )
  assert.equal(called, false)
})

test("reviewed preset imports persist scoped options before one atomic per-app save, without changing global choices", async () => {
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await model()
  let settings = {
    profiles: {
      43: { state: { untouched: true }, originalLaunchOptions: "other" },
    },
    launchOptions: [],
    environmentVariableMerges: [],
  }
  const writes = []
  const actions = createPresetActions(
    () => settings,
    async (next) => {
      settings = next
      writes.push(structuredClone(next))
    },
  )
  const recipe = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [
        { id: "install", on: "setup && %command%", enableGlobally: true },
      ],
    },
    store,
  )
  await actions.savePresetRecipe(
    recipe.launchOptions.map(launchOptionFactory),
    [],
  )
  assert.equal(settings.launchOptions[0].enableGlobally, false)
  assert.equal(writes.length, 1)
  const preset = parsePreset(presetData, "handheld.json", store, "42")
  assert.deepEqual(await actions.applyAppPreset(preset), {
    selected: 1,
    skipped: [],
  })
  assert.equal(writes.length, 2)
  assert.equal(isPresetSelected(preset, settings), true)
  const before = structuredClone(settings)
  await actions.applyAppPreset(preset)
  assert.deepEqual(settings, before)
  assert.deepEqual(settings.profiles[43], {
    state: { untouched: true },
    originalLaunchOptions: "other",
  })
  const failing = createPresetActions(
    () => settings,
    async () => {
      throw new Error("Disk full")
    },
  )
  await assert.rejects(failing.applyAppPreset(preset), /Disk full/)
})

test("ambiguous catalog option IDs and command-bearing preset data are rejected", async () => {
  const { parsePreset, prepareRecipeImport } = await model()
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      { id: "same", on: "first %command%" },
      { id: "same", on: "second %command%" },
    ],
  }
  assert.throws(() => parseRecipes([recipe]), /duplicate/i)
  assert.throws(() => prepareRecipeImport(recipe, store), /duplicate/i)
  assert.throws(
    () =>
      parsePreset(
        { ...presetData, on: "unexpected command" },
        "handheld.json",
        store,
        "42",
      ),
    /preset/i,
  )
  const legacy = prepareRecipeImport(
    {
      id: "renderer",
      name: "Legacy",
      launchOptions: [{ name: "One" }, { name: "Two" }],
    },
    store,
  )
  assert.notEqual(legacy.launchOptions[0].id, legacy.launchOptions[1].id)
})

test("real query caching avoids repeated requests, refreshes explicitly, and isolates cancelled app discovery", async () => {
  const { createRequire } = await import("node:module")
  const require = createRequire(import.meta.resolve("@tanstack/react-query"))
  const { QueryClient } = require("@tanstack/query-core")
  const client = new QueryClient()
  const { presetQueryOptions } = await import(
    await sourceModule("src/teams/app-presets/discovery.ts")
  )
  let calls = 0
  const fetcher = async () => {
    calls++
    return { ok: true, status: 200, json: async () => [] }
  }
  const options = presetQueryOptions(store, "42", fetcher)
  await client.fetchQuery(options)
  await client.fetchQuery(options)
  assert.equal(calls, 1)
  await client.invalidateQueries({ queryKey: options.queryKey })
  await client.fetchQuery(options)
  assert.equal(calls, 2)
  let release,
    parsed = false
  const delayed = presetQueryOptions(
    store,
    "99",
    () =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => {
              parsed = true
              return []
            },
          })
      }),
  )
  const pending = client.fetchQuery(delayed)
  const rejected = assert.rejects(pending, /Cancelled/)
  await new Promise((resolve) => setImmediate(resolve))
  await client.cancelQueries({ queryKey: delayed.queryKey })
  release()
  await rejected
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(parsed, false)
  assert.equal(client.getQueryData(delayed.queryKey), undefined)
  assert.deepEqual(client.getQueryData(options.queryKey), {
    presets: [],
    errors: [],
  })
  client.clear()
})

test("user copies of imported controls do not impersonate their recipe provenance", async () => {
  const { produce } = await import("immer")
  const { createLaunchOptionActions } = await import(
    await sourceModule("src/settings/launch-option-actions.ts")
  )
  const { prepareRecipeImport, parsePreset, resolvePreset } = await model()
  for (const valueId of ["", "quality"]) {
    const options = prepareRecipeImport(
      {
        id: "renderer",
        name: "Renderer",
        launchOptions: [{ id: "install", name: "Renderer", valueId }],
      },
      store,
    ).launchOptions.map(launchOptionFactory)
    let settings = {
      profiles: {},
      launchOptions: options,
      environmentVariableMerges: [],
    }
    createLaunchOptionActions((mutate) => {
      settings = produce(settings, mutate)
    }).duplicateLaunchOption(options[0].id)
    assert.equal(settings.launchOptions.length, 2)
    assert.equal(settings.launchOptions[0].source, undefined)
    assert.equal(
      resolvePreset(
        parsePreset(presetData, "handheld.json", store, "42"),
        settings,
      ).selected.length,
      1,
    )
  }
})

test("store catalogs retain stable recipe IDs for preset recovery", () => {
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [{ id: "install", on: "setup && %command%" }],
  }
  assert.deepEqual(parseRecipes([recipe]), [recipe])
  assert.throws(() => parseRecipes([{ ...recipe, id: 42 }]), /recipe/i)
  assert.throws(() => parseRecipes([recipe, recipe]), /duplicate/i)
})

test("presets never override global dropdown preferences or remove existing manual app choices", async () => {
  const { parsePreset, prepareRecipeImport, applyPreset, isPresetSelected } =
    await model()
  const options = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [
        {
          id: "low",
          name: "Quality",
          valueId: "quality",
          valueName: "Low",
          enableGlobally: true,
        },
        { id: "high", name: "Quality", valueId: "quality", valueName: "High" },
        { id: "available", name: "Available" },
      ],
    },
    store,
  ).launchOptions.map(launchOptionFactory)
  const reference = { recipeId: "renderer", launchOptionId: "high" }
  const preset = parsePreset(
    {
      ...presetData,
      launchOptions: [
        reference,
        { recipeId: "renderer", launchOptionId: "available" },
      ],
    },
    "handheld.json",
    store,
    "42",
  )
  for (const state of [
    { unrelated: true },
    { [options[0].id]: false, [options[1].id]: false, unrelated: true },
    { [options[1].id]: true, unrelated: true },
  ]) {
    const settings = {
      profiles: {
        42: { state, originalLaunchOptions: "kept" },
        77: { state: { unrelated: true }, originalLaunchOptions: "other" },
      },
      launchOptions: options,
      environmentVariableMerges: [],
    }
    const before = structuredClone(settings)
    const result = applyPreset(settings, preset)
    const alreadyEffective = state[options[1].id] === true
    assert.deepEqual(
      settings.profiles[42].state,
      { ...before.profiles[42].state, [options[2].id]: true },
      "protected group must have no selection mutations",
    )
    assert.deepEqual(settings.launchOptions, before.launchOptions)
    assert.deepEqual(settings.profiles[77], before.profiles[77])
    assert.equal(result.selected, 1)
    assert.deepEqual(
      result.skipped,
      alreadyEffective ? [] : [{ ...reference, reason: "global-preference" }],
    )
    assert.equal(isPresetSelected(preset, settings), alreadyEffective)
  }
})

test("matching inherited globals satisfy completion without writes while explicit user overrides remain protected", async () => {
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await model()
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const options = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [
        { id: "global", enableGlobally: true },
        { id: "low", valueId: "quality", enableGlobally: true },
        { id: "high", valueId: "quality" },
      ],
    },
    store,
  ).launchOptions.map(launchOptionFactory)
  const preset = parsePreset(
    {
      ...presetData,
      launchOptions: [
        { recipeId: "renderer", launchOptionId: "global" },
        { recipeId: "renderer", launchOptionId: "low" },
      ],
    },
    "handheld.json",
    store,
    "42",
  )
  for (const manualOverride of [false, true]) {
    let settings = {
      profiles: manualOverride
        ? {
            42: {
              state: { [options[0].id]: false, [options[2].id]: true },
              originalLaunchOptions: "kept",
            },
          }
        : {},
      launchOptions: options,
      environmentVariableMerges: [],
    }
    const before = structuredClone(settings)
    let writes = 0
    const actions = createPresetActions(
      () => settings,
      async (next) => {
        settings = next
        writes++
      },
    )
    assert.equal(isPresetSelected(preset, settings), !manualOverride)
    const result = await actions.applyAppPreset(preset)
    assert.deepEqual(settings, before)
    assert.equal(writes, 0)
    assert.equal(result.selected, 0)
    assert.equal(result.skipped.length, manualOverride ? 2 : 0)
    for (const skipped of result.skipped)
      assert.equal(skipped.reason, "global-preference")
  }
})
