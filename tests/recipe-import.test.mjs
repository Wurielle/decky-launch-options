import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import ts from "typescript"
import { produce } from "immer"
import { sourceModule as graphModule } from "./source-module.mjs"
import {
  batchCreateLaunchOptionsEventType,
  defaultEnvironmentVariableMerges,
  importRecipeEventType,
  launchOptionFactory,
} from "../src/shared.ts"
import { parseRecipes } from "../src/teams/recipe-store/recipes.ts"

const fileURL = (name) => pathToFileURL(path.resolve(name)).href
const dataURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
async function sourceModule(name, imports) {
  let source = ts.transpileModule(await readFile(name, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  for (const [from, to] of Object.entries(imports))
    source = source.replaceAll(`"${from}"`, JSON.stringify(to))
  return dataURL(source)
}

const shared = fileURL("src/shared.ts")
const utils = await sourceModule("src/utils/settings.ts", {
  "../shared": shared,
  uuid: import.meta.resolve("uuid"),
})
const { normalizeSettings } = await import(utils)
const { createEnvironmentVariableMergeActions } = await import(
  await sourceModule("src/settings/environment-variable-merge-actions.ts", {
    "../shared": shared,
    "es-toolkit/compat": import.meta.resolve("es-toolkit/compat"),
  })
)
const { createLaunchOptionActions } = await import(
  await sourceModule("src/settings/launch-option-actions.ts", {
    "../shared": shared,
    "../utils/settings": utils,
    "es-toolkit/compat": import.meta.resolve("es-toolkit/compat"),
  })
)

// Keep the production dialog and settings mutations, replacing only the React
// rendering boundary and Decky's modal host. No Steam/backend calls are made.
const jsx = dataURL(
  `export const Fragment = 'Fragment'; export const jsx = (type,props,key) => ({type,props,key}); export const jsxs = jsx;`,
)
const react = dataURL(
  `export const useState = init => [typeof init === 'function' ? init() : init]; export const useRef = () => ({current:null});`,
)
const ui = dataURL(`
  export const ConfirmModal='ConfirmModal', DialogBody='DialogBody', DialogButton='DialogButton', DialogButtonPrimary='DialogButtonPrimary', DialogFooter='DialogFooter', DialogHeader='DialogHeader', Focusable='Focusable', ModalRoot='ModalRoot';
  export function showModal(element) { const modal={element,closed:false,Close(){this.closed=true}}; globalThis.__dloRecipeFixture.modals.push(modal); return modal; }
`)
const hooks = dataURL(
  `export const useSettings = () => globalThis.__dloRecipeFixture.actions;`,
)
const stateMessage = await sourceModule("src/components/state-message.tsx", {
  "react/jsx-runtime": jsx,
})
const tabLoading = await sourceModule("src/components/tab-loading.tsx", {
  "react/jsx-runtime": jsx,
  "@decky/ui": dataURL(`export const SteamSpinner='SteamSpinner';`),
})
const dialog = await import(
  await sourceModule("src/components/batch-add-launch-options.tsx", {
    "../shared": shared,
    "../hooks": hooks,
    "es-toolkit": import.meta.resolve("es-toolkit"),
    react,
    "react/jsx-runtime": jsx,
    "@decky/ui": ui,
    "react-icons/fa": dataURL(`export const FaGlobe='FaGlobe';`),
    "@tanstack/react-query": dataURL(
      `export const QueryClientProvider='QueryClientProvider';`,
    ),
    "../query": dataURL(`export const queryClient={};`),
    "./modal-scroll-content": dataURL(
      `export const ModalScrollContent='ModalScrollContent';`,
    ),
    "./state-message": stateMessage,
  })
)

const { StoreRecipes } = await import(
  await sourceModule("src/teams/recipe-store/store-recipes.tsx", {
    "../app-presets/model": await graphModule("src/teams/app-presets/model.ts"),
    "../../shared": shared,
    "./recipes": fileURL("src/teams/recipe-store/recipes.ts"),
    "@decky/api": dataURL(
      `export const fetchNoCors = () => { throw new Error('Unexpected network call'); };`,
    ),
    "@decky/ui": dataURL(
      `export * from '${ui}'; export const ButtonItem='ButtonItem', Field='Field', PanelSectionRow='PanelSectionRow', SteamSpinner='SteamSpinner', TextField='TextField';`,
    ),
    "@tanstack/react-query": dataURL(
      `export const useQuery = options => ({data:options.select(globalThis.__dloRecipeFixture.catalog),isPending:false,isFetching:false});`,
    ),
    react,
    "react/jsx-runtime": jsx,
    "react-icons/fa": dataURL(`export const FaSyncAlt='FaSyncAlt';`),
    "../../components/launch-option-focus": dataURL(
      `export const LaunchOptionControl='LaunchOptionControl', LaunchOptionControls='LaunchOptionControls', LaunchOptionFocusList='LaunchOptionFocusList';`,
    ),
    "../../components/state-message": stateMessage,
    "../../components/tab-loading": tabLoading,
  })
)

let fixture
beforeEach(() => {
  globalThis.window = new EventTarget()
  fixture = {
    settings: {
      profiles: {},
      launchOptions: [],
      environmentVariableMerges: structuredClone(
        defaultEnvironmentVariableMerges,
      ),
    },
    writes: [],
    modals: [],
  }
  fixture.actions = {
    loading: false,
    ...createLaunchOptionActions((mutate) => {
      fixture.settings = produce(fixture.settings, mutate)
      fixture.writes.push(structuredClone(fixture.settings))
    }),
  }
  globalThis.__dloRecipeFixture = fixture
})

function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes)
  if (!element || typeof element !== "object") return [element]
  if (typeof element.type === "function")
    return nodes(element.type(element.props))
  return [element, ...nodes(element.props.children)]
}
function openRecipe(recipe) {
  dialog.importRecipe(recipe)
  return nodes(fixture.modals[0].element)
}
const button = (tree, label) =>
  tree.find((node) => node?.props?.children === label)
const recipe = {
  name: "Example recipe",
  launchOptions: [
    { id: "overlay", name: "Overlay", on: 'MANGOHUD_CONFIG="cpu_temp"' },
  ],
  environmentVariableMerges: [
    { id: "mangohud-config", name: "MANGOHUD_CONFIG", delimiter: "," },
  ],
}

test("recipe review shows commands and merge delimiters, then saves both in one write", () => {
  const tree = openRecipe(recipe)
  assert.ok(tree.some((node) => node === 'MANGOHUD_CONFIG="cpu_temp"'))
  assert.ok(
    tree.some(
      (node) =>
        node?.props?.["aria-label"] === "Environment variable merges to add",
    ),
  )
  assert.ok(tree.includes("MANGOHUD_CONFIG"))
  assert.ok(tree.includes('\",\"'))
  assert.ok(tree.includes("Decky Launch Options"))
  assert.equal(fixture.writes.length, 0)
  button(tree, "Add to Decky Launch Options").props.onClick()
  assert.equal(fixture.writes.length, 1)
  assert.equal(fixture.settings.launchOptions[0].on, recipe.launchOptions[0].on)
  assert.deepEqual(
    fixture.settings.environmentVariableMerges,
    defaultEnvironmentVariableMerges,
  )
  assert.equal(fixture.modals[0].closed, true)
})

test("clicking a store recipe sends the whole recipe through the new event into the review and save", () => {
  const source = {
    ...recipe,
    environmentVariableMerges: [
      { id: "custom", name: "CUSTOM_CONFIG", delimiter: "::" },
    ],
  }
  fixture.catalog = parseRecipes([source])
  let received
  let legacyEvents = 0
  window.addEventListener(
    batchCreateLaunchOptionsEventType,
    () => legacyEvents++,
  )
  window.addEventListener(importRecipeEventType, (event) => {
    received = event.detail
    dialog.importRecipe(event.detail)
  })
  const list = nodes(
    StoreRecipes({
      store: {
        name: "Store",
        description: "",
        type: "github",
        github: { repository: "example/recipes", branch: "main" },
      },
    }),
  )
  button(list, source.name).props.onClick()
  assert.deepEqual(received, source)
  assert.equal(legacyEvents, 0)
  const review = nodes(fixture.modals[0].element)
  assert.ok(review.includes("CUSTOM_CONFIG"))
  assert.ok(review.includes('"::"'))
  assert.equal(fixture.writes.length, 0)
  button(review, "Add to Decky Launch Options").props.onClick()
  assert.equal(fixture.writes.length, 1)
  assert.equal(fixture.settings.launchOptions[0].id, source.launchOptions[0].id)
  assert.deepEqual(
    fixture.settings.environmentVariableMerges[0],
    source.environmentVariableMerges[0],
  )
})

test("store imports retain scoped recipe provenance for later app preset resolution", async () => {
  const source = { ...recipe, id: "renderer" }
  fixture.catalog = parseRecipes([source])
  let received
  window.addEventListener(importRecipeEventType, (event) => {
    received = event.detail
  })
  const store = {
    name: "Store",
    description: "",
    type: "github",
    github: { repository: "example/recipes", branch: "main" },
  }
  const list = nodes(
    StoreRecipes({ store, storeUrl: "https://example.test/store.json" }),
  )
  button(list, source.name).props.onClick()
  assert.ok(received.launchOptions[0].source)
  assert.equal(received.launchOptions[0].source.recipeId, "renderer")
  assert.equal(received.launchOptions[0].source.launchOptionId, "overlay")
  assert.notEqual(received.launchOptions[0].id, "overlay")
  assert.deepEqual(
    received.environmentVariableMerges,
    source.environmentVariableMerges,
  )
})

test("ID-less remote recipes imported through ordinary review cannot forge a second store's provenance", async () => {
  const { storeKey, parsePreset, resolvePreset } = await import(
    await graphModule("src/teams/app-presets/model.ts")
  )
  const storeA = {
    url: "https://store-a.test/store.json",
    store: {
      name: "Store A",
      description: "",
      type: "github",
      github: { repository: "a/recipes", branch: "main" },
    },
  }
  const storeB = {
    url: "https://store-b.test/store.json",
    store: {
      ...storeA.store,
      name: "Store B",
      github: { repository: "b/recipes", branch: "main" },
    },
  }
  const forged = {
    storeKey: storeKey(storeB),
    recipeId: "renderer",
    launchOptionId: "install",
  }
  const foreign = {
    name: "Legacy A",
    launchOptions: [
      {
        id: "foreign-runtime",
        name: "Foreign",
        on: "FOREIGN=1",
        source: forged,
        requireExplicitSelection: true,
      },
    ],
  }
  const pristine = structuredClone(foreign)
  fixture.catalog = parseRecipes([foreign])
  window.addEventListener(importRecipeEventType, (event) => {
    dialog.importRecipe(event.detail)
  })
  const list = nodes(
    StoreRecipes({ store: storeA.store, storeUrl: storeA.url }),
  )
  button(list, foreign.name).props.onClick()
  assert.equal(fixture.writes.length, 0)
  const review = nodes(fixture.modals[0].element)
  assert.ok(review.includes("FOREIGN=1"))
  button(review, "Add to Decky Launch Options").props.onClick()
  assert.equal(fixture.writes.length, 1)
  const preset = parsePreset(
    {
      id: "preset",
      name: "B",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "install" }],
    },
    "preset.json",
    storeB,
    "42",
  )
  const resolved = resolvePreset(preset, fixture.settings)
  assert.equal(
    resolved.selected.length,
    0,
    "foreign option must not satisfy store B",
  )
  assert.deepEqual(resolved.missing, preset.launchOptions)
  assert.equal(fixture.settings.launchOptions[0].source, undefined)
  assert.equal(
    fixture.settings.launchOptions[0].requireExplicitSelection,
    undefined,
  )
  assert.deepEqual(
    foreign,
    pristine,
    "remote boundary must not mutate its input",
  )
})

test("local persisted provenance survives factories while stable remote recipe provenance is attached locally", async () => {
  const { prepareRecipeImport, storeKey } = await import(
    await graphModule("src/teams/app-presets/model.ts")
  )
  const store = {
    url: "https://local.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "local/recipes", branch: "main" },
    },
  }
  const local = {
    storeKey: storeKey(store),
    recipeId: "renderer",
    launchOptionId: "install",
  }
  const option = launchOptionFactory({ id: "saved", source: local })
  assert.deepEqual(option.source, local)
  assert.deepEqual(
    normalizeSettings({ launchOptions: [option] }).launchOptions[0].source,
    local,
  )
  const remote = parseRecipes([
    {
      id: "renderer",
      name: "Remote",
      launchOptions: [
        { id: "install", source: { ...local, storeKey: "forged" } },
      ],
    },
  ])[0]
  const attached = prepareRecipeImport(remote, store).launchOptions[0]
  assert.deepEqual(attached.source, local)
})

test("cancel and declining the shortcut confirmation import nothing", () => {
  const tree = openRecipe(recipe)
  button(tree, "Add all without review").props.onClick()
  const confirmation = fixture.modals[1]
  assert.match(
    confirmation.element.props.strDescription,
    /Environment variable merges affect how environment variables combine across active launch options/,
  )
  confirmation.element.props.onCancel()
  assert.equal(confirmation.closed, true)
  assert.equal(fixture.modals[0].closed, false)
  button(tree, "Cancel").props.onClick()
  assert.equal(fixture.modals[0].closed, true)
  assert.equal(fixture.writes.length, 0)
})

test("Add all without review imports the rules along with the launch options", () => {
  const tree = openRecipe({
    ...recipe,
    environmentVariableMerges: [
      { id: "custom", name: "EXAMPLE_CONFIG", delimiter: "::" },
    ],
  })
  button(tree, "Add all without review").props.onClick()
  assert.equal(fixture.writes.length, 0)
  fixture.modals[1].element.props.onOK()
  assert.equal(fixture.writes.length, 1)
  assert.ok(
    fixture.settings.launchOptions.some((option) => option.id === "overlay"),
  )
  assert.deepEqual(fixture.settings.environmentVariableMerges[0], {
    id: "custom",
    name: "EXAMPLE_CONFIG",
    delimiter: "::",
  })
})

test("reimport updates shared rules by ID without resetting app/global choices or unrelated rules", () => {
  fixture.settings.profiles["42"] = {
    state: { overlay: false },
    originalLaunchOptions: "original",
  }
  fixture.settings.launchOptions = [
    launchOptionFactory({ ...recipe.launchOptions[0], enableGlobally: true }),
  ]
  const initialProfiles = structuredClone(fixture.settings.profiles)
  for (let i = 0; i < 2; i++) {
    fixture.modals = []
    const tree = openRecipe({
      ...recipe,
      environmentVariableMerges: [
        { ...recipe.environmentVariableMerges[0], delimiter: ";" },
      ],
    })
    button(tree, "Add to Decky Launch Options").props.onClick()
  }
  assert.equal(fixture.settings.launchOptions.length, 1)
  assert.equal(fixture.settings.launchOptions[0].enableGlobally, true)
  assert.deepEqual(fixture.settings.profiles, initialProfiles)
  assert.equal(
    fixture.settings.environmentVariableMerges.length,
    defaultEnvironmentVariableMerges.length,
  )
  assert.equal(
    fixture.settings.environmentVariableMerges.find(
      (merge) => merge.id === "mangohud-config",
    ).delimiter,
    ";",
  )
  assert.deepEqual(
    fixture.settings.environmentVariableMerges.filter(
      (merge) => merge.id !== "mangohud-config",
    ),
    defaultEnvironmentVariableMerges.filter(
      (merge) => merge.id !== "mangohud-config",
    ),
  )
})

test("missing IDs are generated and an empty delimiter is reviewed and preserved", () => {
  const tree = openRecipe({
    ...recipe,
    environmentVariableMerges: [{ name: "EXAMPLE_FLAGS", delimiter: "" }],
  })
  assert.ok(tree.includes('\"\"'))
  button(tree, "Add to Decky Launch Options").props.onClick()
  const rule = fixture.settings.environmentVariableMerges.find(
    (merge) => merge.name === "EXAMPLE_FLAGS",
  )
  assert.ok(rule.id)
  assert.equal(rule.delimiter, "")
})

for (const environmentVariableMerges of [undefined, []]) {
  test(`recipes with ${environmentVariableMerges ? "empty" : "omitted"} merge lists preserve existing rules`, () => {
    const tree = openRecipe({ ...recipe, environmentVariableMerges })
    assert.ok(
      !tree.some(
        (node) =>
          node?.props?.["aria-label"] === "Environment variable merges to add",
      ),
    )
    button(tree, "Add to Decky Launch Options").props.onClick()
    assert.deepEqual(
      fixture.settings.environmentVariableMerges,
      defaultEnvironmentVariableMerges,
    )
  })
}

test("the legacy array importer still imports options without changing merge rules", () => {
  dialog.batchCreateLaunchOptions(recipe.launchOptions)
  const tree = nodes(fixture.modals[0].element)
  assert.ok(tree.includes("Decky Launch Options"))
  button(tree, "Add to Decky Launch Options").props.onClick()
  assert.equal(fixture.settings.launchOptions[0].id, "overlay")
  assert.deepEqual(
    fixture.settings.environmentVariableMerges,
    defaultEnvironmentVariableMerges,
  )
})

for (const launchOptions of [undefined, []]) {
  test(`merge-only recipes with ${launchOptions ? "empty" : "omitted"} launch options preserve existing options`, () => {
    fixture.settings.launchOptions = [
      launchOptionFactory(recipe.launchOptions[0]),
    ]
    const before = structuredClone(fixture.settings.launchOptions)
    const tree = openRecipe({
      name: "Merge rules",
      launchOptions,
      environmentVariableMerges: [
        { id: "custom", name: "CUSTOM_CONFIG", delimiter: ";" },
      ],
    })
    assert.ok(tree.includes("environment variable merges"))
    assert.ok(
      !tree.some(
        (node) => node?.props?.["aria-label"] === "Launch options to add",
      ),
    )
    button(tree, "Add all without review").props.onClick()
    const confirmation = fixture.modals[1].element
    assert.equal(
      confirmation.props.strTitle,
      "Add all environment variable merges?",
    )
    assert.doesNotMatch(
      confirmation.props.strDescription,
      /Malicious launch options/,
    )
    confirmation.props.onOK()
    assert.equal(fixture.writes.length, 1)
    assert.deepEqual(fixture.settings.launchOptions, before)
    assert.deepEqual(fixture.settings.environmentVariableMerges[0], {
      id: "custom",
      name: "CUSTOM_CONFIG",
      delimiter: ";",
    })
  })
}

test("review text describes both lists when both are present", () => {
  const tree = openRecipe(recipe)
  assert.ok(tree.includes("launch options and environment variable merges"))
})

test("legacy merge settings retain IDs, order, empty delimiters, and app selections under the full property name", () => {
  const legacy = {
    profiles: {
      42: { state: { overlay: true }, originalLaunchOptions: "--original" },
    },
    launchOptions: [launchOptionFactory(recipe.launchOptions[0])],
    envVariableMerges: [
      { id: "custom", name: "CUSTOM_CONFIG", delimiter: "::" },
      { id: "flags", name: "CUSTOM_FLAGS", delimiter: "" },
    ],
  }
  const before = structuredClone(legacy)
  const migrated = normalizeSettings(legacy)
  assert.deepEqual(migrated.environmentVariableMerges, legacy.envVariableMerges)
  assert.deepEqual(migrated.profiles, legacy.profiles)
  assert.deepEqual(migrated.launchOptions, legacy.launchOptions)
  assert.equal(Object.hasOwn(migrated, "envVariableMerges"), false)
  assert.deepEqual(legacy, before)
})

test("canonical merge settings take precedence and explicitly empty lists stay empty", () => {
  const rule = { id: "custom", name: "CUSTOM_CONFIG", delimiter: ";" }
  assert.deepEqual(
    normalizeSettings({ envVariableMerges: [] }).environmentVariableMerges,
    [],
  )
  assert.deepEqual(
    normalizeSettings({
      environmentVariableMerges: [],
      envVariableMerges: [rule],
    }).environmentVariableMerges,
    [],
  )
  assert.deepEqual(
    normalizeSettings({
      environmentVariableMerges: [rule],
      envVariableMerges: [],
    }).environmentVariableMerges,
    [rule],
  )
  for (const settings of [undefined, null, {}])
    assert.deepEqual(
      normalizeSettings(settings).environmentVariableMerges,
      defaultEnvironmentVariableMerges,
    )
})

test("renamed merge editor actions save canonical settings and preserve unrelated data", () => {
  const rule = { id: "custom", name: "CUSTOM_CONFIG", delimiter: "::" }
  fixture.settings = normalizeSettings({
    profiles: { 42: { state: {}, originalLaunchOptions: "--original" } },
    launchOptions: [launchOptionFactory(recipe.launchOptions[0])],
    envVariableMerges: [rule],
  })
  const before = structuredClone(fixture.settings)
  const actions = createEnvironmentVariableMergeActions((mutate) => {
    fixture.settings = produce(fixture.settings, mutate)
  })
  actions.updateEnvironmentVariableMerge(rule, "delimiter", "")
  assert.deepEqual(fixture.settings.environmentVariableMerges, [
    { ...rule, delimiter: "" },
  ])
  const added = { id: "flags", name: "CUSTOM_FLAGS", delimiter: ";" }
  actions.createEnvironmentVariableMerge(added)
  assert.deepEqual(fixture.settings.environmentVariableMerges[0], added)
  actions.deleteEnvironmentVariableMerge(rule.id)
  assert.deepEqual(fixture.settings.environmentVariableMerges, [added])
  assert.deepEqual(fixture.settings.profiles, before.profiles)
  assert.deepEqual(fixture.settings.launchOptions, before.launchOptions)
  assert.equal(Object.hasOwn(fixture.settings, "envVariableMerges"), false)
})
