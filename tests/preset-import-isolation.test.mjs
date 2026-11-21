import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { sourceModule } from "./source-module.mjs"

const { launchOptionFactory } = await import(
  await sourceModule("src/shared.ts")
)
const { createPresetActions } = await import(
  await sourceModule("src/teams/app-presets/actions.ts")
)
const { createLaunchOptionActions } = await import(
  await sourceModule("src/settings/launch-option-actions.ts")
)
const { prepareRecipeImport, parsePreset, isPresetSelected } = await import(
  await sourceModule("src/teams/app-presets/model.ts")
)
const {
  getLaunchOptionState,
  getSelectedValueIdLaunchOptionId,
  normalizeSettings,
} = await import(await sourceModule("src/utils/settings.ts"))
const store = {
  url: "https://example.test/store.json",
  store: {
    name: "Store",
    description: "",
    type: "github",
    github: { repository: "example/recipes", branch: "main" },
  },
}
const recipe = JSON.parse(
  await readFile(
    new URL("./fixtures/app-presets/renderer.json", import.meta.url),
    "utf8",
  ),
)
const presetData = JSON.parse(
  await readFile(
    new URL("./fixtures/app-presets/steam-deck.json", import.meta.url),
    "utf8",
  ),
)
const preset = parsePreset(
  presetData,
  `${presetData.id}.json`,
  store,
  "1903340",
)
const original = () => ({
  profiles: { 77: { state: { unrelated: true }, originalLaunchOptions: "" } },
  launchOptions: [
    launchOptionFactory({
      id: "unrelated",
      enableGlobally: true,
      on: "UNRELATED=kept",
    }),
  ],
  environmentVariableMerges: [],
})
function fixture(initial = original()) {
  let settings = initial
  const actions = createPresetActions(
    () => settings,
    async (next) => {
      settings = normalizeSettings(JSON.parse(JSON.stringify(next)))
    },
  )
  return {
    actions,
    get settings() {
      return settings
    },
    import: async (input = recipe) =>
      actions.savePresetRecipe(
        prepareRecipeImport(input, store, settings).launchOptions.map(
          launchOptionFactory,
        ),
        [],
      ),
  }
}
function runtime(settings, appid) {
  // Import the real runner as a module: resolve only; never invoke its executable entry point.
  const result = spawnSync(
    "python3",
    [
      "-B",
      "-c",
      `import json, sys\nfrom run import get_final_args_details\nsettings, appid = json.load(sys.stdin)\nsys.argv = ['run.py', '/owned/game']\nprint(json.dumps(get_final_args_details(settings, appid)))`,
    ],
    {
      input: JSON.stringify([settings, appid]),
      encoding: "utf8",
      timeout: 10000,
    },
  )
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test("catalog imports update existing IDs across stores and branches while preserving global and app selections", async () => {
  const { produce } = await import("immer")
  const input = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      {
        id: "low",
        name: "Quality",
        valueId: "quality",
        on: "QUALITY=low",
        enableGlobally: true,
      },
      { id: "high", name: "Quality", valueId: "quality", on: "QUALITY=high" },
    ],
  }
  let settings = original()
  settings.launchOptions.push(...input.launchOptions.map(launchOptionFactory))
  settings.profiles[77].state = { low: false, high: true, unrelated: true }
  const beforeProfiles = structuredClone(settings.profiles)
  const actions = createLaunchOptionActions((mutate) => {
    settings = produce(settings, mutate)
  })
  const origins = [
    store,
    {
      ...store,
      store: {
        ...store.store,
        github: { ...store.store.github, branch: "other" },
      },
    },
    {
      ...store,
      url: "https://different.test/store.json",
      store: {
        ...store.store,
        github: { repository: "different/recipes", branch: "dev" },
      },
    },
  ]
  for (const [index, origin] of origins.entries()) {
    const changed = {
      ...input,
      launchOptions: input.launchOptions.map((option) => ({
        ...option,
        on: `${option.on}-${index}`,
        enableGlobally: option.id === "high",
      })),
    }
    const prepared = prepareRecipeImport(changed, origin)
    actions.batchCreateLaunchOptions(
      prepared.launchOptions.map(launchOptionFactory),
    )
    assert.equal(settings.launchOptions.length, 3)
    assert.equal(
      settings.launchOptions.find((option) => option.id === "low").on,
      `QUALITY=low-${index}`,
    )
    assert.equal(
      settings.launchOptions.find((option) => option.id === "low").valueId,
      "quality",
    )
    assert.equal(
      settings.launchOptions.find((option) => option.id === "low")
        .enableGlobally,
      true,
    )
    assert.equal(
      settings.launchOptions.find((option) => option.id === "high")
        .enableGlobally,
      false,
    )
    assert.deepEqual(settings.profiles, beforeProfiles)
    assert.equal(
      getSelectedValueIdLaunchOptionId(settings, "77", "quality"),
      "high",
    )
    assert.equal(
      getSelectedValueIdLaunchOptionId(settings, "99999", "quality"),
      "low",
    )
    const otherPreset = parsePreset(
      {
        id: "high",
        name: "High",
        author: "Example",
        description: "",
        launchOptions: [{ recipeId: "renderer", launchOptionId: "high" }],
      },
      "high.json",
      store,
      "77",
    )
    assert.equal(isPresetSelected(otherPreset, settings), true)
  }
})

test("preset recipe recovery reuses imports from another store without adding controls or resetting app choices", async () => {
  const f = fixture()
  await f.import()
  await f.actions.applyAppPreset(preset)
  const beforeProfiles = structuredClone(f.settings.profiles)
  const beforeIds = f.settings.launchOptions.map((option) => option.id).sort()
  const otherStore = {
    ...store,
    url: "https://different.test/store.json",
    store: {
      ...store.store,
      github: { ...store.store.github, branch: "other" },
    },
  }
  const changed = {
    ...recipe,
    launchOptions: recipe.launchOptions.map((option) => ({
      ...option,
      on: `${option.on} UPDATED=1`,
    })),
  }
  await f.actions.savePresetRecipe(
    prepareRecipeImport(changed, otherStore, f.settings).launchOptions.map(
      launchOptionFactory,
    ),
    [],
  )
  assert.deepEqual(
    f.settings.launchOptions.map((option) => option.id).sort(),
    beforeIds,
  )
  assert.deepEqual(f.settings.profiles, beforeProfiles)
  assert.equal(isPresetSelected(preset, f.settings), true)
  assert.ok(
    f.settings.launchOptions
      .filter((option) => option.source)
      .every((option) => option.on.endsWith("UPDATED=1")),
  )
})

test("preset fixture import leaves effective UI selections inert for current, unrelated and future apps through reimport", async () => {
  const f = fixture()
  await f.import()
  for (const appid of ["1903340", "77", "99999"]) {
    for (const option of f.settings.launchOptions.filter((o) => o.source)) {
      assert.equal(
        getLaunchOptionState(f.settings, appid, option.id),
        false,
        `${appid}: ${option.source.launchOptionId}`,
      )
      if (option.valueId)
        assert.equal(
          getSelectedValueIdLaunchOptionId(f.settings, appid, option.valueId),
          null,
        )
    }
  }
  assert.equal(isPresetSelected(preset, f.settings), false)
  await f.actions.applyAppPreset(preset)
  assert.equal(isPresetSelected(preset, f.settings), true)
  const selected = f.settings.profiles[1903340]
  await f.import()
  assert.deepEqual(f.settings.profiles[1903340], selected)
  assert.equal(isPresetSelected(preset, f.settings), true)
  for (const option of f.settings.launchOptions.filter((o) => o.source))
    assert.equal(getLaunchOptionState(f.settings, "99999", option.id), false)
  assert.deepEqual(f.settings.profiles[77], original().profiles[77])
  assert.equal(
    f.settings.launchOptions.find((o) => o.id === "unrelated").enableGlobally,
    true,
  )
})

test("real runtime receives no preset default contributions until explicit selection and keeps other apps inert after reimport", async () => {
  const f = fixture()
  await f.import()
  for (const appid of ["1903340", "77", "99999"])
    assert.deepEqual(runtime(f.settings, appid), [
      ["/owned/game"],
      { UNRELATED: "kept" },
    ])
  await f.actions.applyAppPreset(preset)
  assert.equal(
    runtime(f.settings, "1903340")[1].DLOR_OPTISCALER_FSR_PROFILE,
    "sdk-amd",
  )
  await f.import()
  assert.equal(
    runtime(f.settings, "1903340")[1].DLOR_OPTISCALER_FSR_PROFILE,
    "sdk-amd",
  )
  assert.deepEqual(runtime(f.settings, "99999"), [
    ["/owned/game"],
    { UNRELATED: "kept" },
  ])
  const globalChoice = f.settings.launchOptions.find(
    (o) => o.source?.launchOptionId === "dlor-optiscaler-fsr-override-sdk-amd",
  )
  globalChoice.enableGlobally = true
  await f.import()
  assert.equal(getLaunchOptionState(f.settings, "99999", globalChoice.id), true)
  assert.equal(
    runtime(f.settings, "99999")[1].DLOR_OPTISCALER_FSR_PROFILE,
    "sdk-amd",
    "explicit global selection still works and survives reimport",
  )
})

test("preset reimport preserves existing ordinary global and implicit defaults including a group without a fallback", async () => {
  for (const mode of ["global", "fallback", "first"]) {
    const initialRecipe = {
      id: "legacy",
      name: "Legacy",
      launchOptions: [
        {
          id: "a",
          valueId: "quality",
          on: "QUALITY=a",
          enableGlobally: mode === "global",
          fallbackValue: mode === "fallback",
        },
        { id: "b", valueId: "quality", on: "QUALITY=b" },
      ],
    }
    const initial = original()
    initial.launchOptions.push(
      ...prepareRecipeImport(initialRecipe, store).launchOptions.map(
        launchOptionFactory,
      ),
    )
    const f = fixture(initial)
    const before = runtime(f.settings, "99999")
    const selected = getSelectedValueIdLaunchOptionId(
      f.settings,
      "99999",
      f.settings.launchOptions[1].valueId,
    )
    await f.import({
      ...initialRecipe,
      launchOptions: [
        { ...initialRecipe.launchOptions[0], fallbackValue: false },
        { ...initialRecipe.launchOptions[1], fallbackValue: true },
        {
          id: "new",
          valueId: "quality",
          on: "QUALITY=new",
          fallbackValue: true,
        },
      ],
    })
    assert.equal(
      getSelectedValueIdLaunchOptionId(
        f.settings,
        "99999",
        f.settings.launchOptions.find((o) => o.source).valueId,
      ),
      selected,
      mode,
    )
    assert.deepEqual(runtime(f.settings, "99999"), before, mode)
  }
})

test("new preset boolean off commands remain inert while ordinary boolean off semantics are unchanged", async () => {
  const f = fixture()
  await f.import({
    id: "off",
    name: "Off",
    launchOptions: [{ id: "switch", on: "SWITCH=on", off: "SWITCH=off" }],
  })
  assert.deepEqual(runtime(f.settings, "99999"), [
    ["/owned/game"],
    { UNRELATED: "kept" },
  ])
  const option = f.settings.launchOptions.find((o) => o.source)
  const explicit = structuredClone(f.settings)
  explicit.profiles[77].state[option.id] = false
  assert.equal(runtime(explicit, "77")[1].SWITCH, "off")
  const ordinary = original()
  ordinary.launchOptions.push(
    launchOptionFactory({ id: "switch", off: "SWITCH=off" }),
  )
  assert.equal(runtime(ordinary, "99999")[1].SWITCH, "off")
})

test("ordinary batch imports retain legacy fallback behavior without a marker", () => {
  let settings = original()
  createLaunchOptionActions((mutate) =>
    mutate(settings),
  ).batchCreateLaunchOptions([
    launchOptionFactory({
      id: "default",
      valueId: "ordinary",
      fallbackValue: true,
      on: "ORDINARY=default",
    }),
    launchOptionFactory({
      id: "other",
      valueId: "ordinary",
      on: "ORDINARY=other",
    }),
  ])
  assert.equal(
    getSelectedValueIdLaunchOptionId(settings, "99999", "ordinary"),
    "default",
  )
  assert.equal(runtime(settings, "99999")[1].ORDINARY, "default")
})

test("ordinary reviewed reimports retain the inert policy of already preset-imported controls", async () => {
  const f = fixture()
  await f.import()
  const settings = structuredClone(f.settings)
  const updatedRecipe = {
    ...recipe,
    launchOptions: [
      {
        ...recipe.launchOptions.find((o) => o.valueId),
        id: "new-remote-choice",
        on: "NEW_CHOICE=bad",
      },
      ...recipe.launchOptions,
    ],
  }
  createLaunchOptionActions((mutate) =>
    mutate(settings),
  ).batchCreateLaunchOptions(
    prepareRecipeImport(updatedRecipe, store, settings)
      .launchOptions.map(launchOptionFactory)
      .map(({ requireExplicitSelection, ...option }) => option),
  )
  assert.deepEqual(runtime(settings, "99999"), [
    ["/owned/game"],
    { UNRELATED: "kept" },
  ])
  for (const option of settings.launchOptions.filter((o) => o.source))
    assert.equal(getLaunchOptionState(settings, "99999", option.id), false)
})

test("preset recovery preserves entire globally protected definitions and app state while importing unrelated controls", async () => {
  const source = {
    id: "protected",
    name: "Protected",
    launchOptions: [
      {
        id: "global",
        name: "Global",
        on: "GLOBAL=original",
        off: "GLOBAL=off",
        enableGlobally: true,
      },
      {
        id: "low",
        name: "Quality",
        valueId: "quality",
        valueName: "Low",
        on: "QUALITY=low",
        fallbackValue: true,
        enableGlobally: true,
      },
      {
        id: "high",
        name: "Quality",
        valueId: "quality",
        valueName: "High",
        on: "QUALITY=high",
        fallbackValue: true,
      },
    ],
  }
  const initial = original()
  const protectedOptions = prepareRecipeImport(source, store).launchOptions.map(
    launchOptionFactory,
  )
  initial.launchOptions.push(...protectedOptions)
  initial.profiles[77].state[protectedOptions[0].id] = false
  initial.profiles[77].state[protectedOptions[2].id] = true
  const f = fixture(initial)
  const before = structuredClone(f.settings)
  const changed = {
    ...source,
    launchOptions: [
      ...source.launchOptions.map((o) => ({
        ...o,
        name: "Remote changed",
        valueId: "moved-group",
        on: "CHANGED=bad",
        fallbackValue: false,
      })),
      { id: "new-choice", name: "Quality", valueId: "quality", on: "NEW=bad" },
      { id: "available", name: "Available", on: "AVAILABLE=1" },
    ],
  }
  const reviewed = prepareRecipeImport(changed, store, f.settings)
  for (const existing of protectedOptions)
    assert.deepEqual(
      reviewed.launchOptions.find((o) => o.id === existing.id),
      existing,
      "review must reflect unchanged protected definitions",
    )
  // The final save boundary must protect globals even if a stale review prepared
  // the incoming definitions before global preferences changed.
  await f.actions.savePresetRecipe(
    prepareRecipeImport(changed, store).launchOptions.map(launchOptionFactory),
    [],
  )
  for (const existing of protectedOptions)
    assert.deepEqual(
      f.settings.launchOptions.find((o) => o.id === existing.id),
      existing,
    )
  assert.equal(
    f.settings.launchOptions.some(
      (o) => o.source?.launchOptionId === "new-choice",
    ),
    false,
  )
  assert.equal(
    f.settings.launchOptions.some(
      (o) => o.source?.launchOptionId === "available",
    ),
    true,
  )
  assert.deepEqual(f.settings.profiles, before.profiles)
  assert.deepEqual(
    f.settings.launchOptions.find((o) => o.id === "unrelated"),
    before.launchOptions[0],
  )
  assert.deepEqual(runtime(f.settings, "99999"), runtime(before, "99999"))
  assert.deepEqual(runtime(f.settings, "77"), runtime(before, "77"))
})
