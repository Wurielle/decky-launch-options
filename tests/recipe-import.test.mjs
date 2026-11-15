import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import ts from "typescript"
import { produce } from "immer"
import { defaultEnvVariableMerges, launchOptionFactory } from "../src/shared.ts"

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
  })
)

let fixture
beforeEach(() => {
  fixture = {
    settings: {
      profiles: {},
      launchOptions: [],
      envVariableMerges: structuredClone(defaultEnvVariableMerges),
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
  envVariableMerges: [
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
  assert.deepEqual(fixture.settings.envVariableMerges, defaultEnvVariableMerges)
  assert.equal(fixture.modals[0].closed, true)
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
    envVariableMerges: [
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
  assert.deepEqual(fixture.settings.envVariableMerges[0], {
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
      envVariableMerges: [{ ...recipe.envVariableMerges[0], delimiter: ";" }],
    })
    button(tree, "Add to Decky Launch Options").props.onClick()
  }
  assert.equal(fixture.settings.launchOptions.length, 1)
  assert.equal(fixture.settings.launchOptions[0].enableGlobally, true)
  assert.deepEqual(fixture.settings.profiles, initialProfiles)
  assert.equal(
    fixture.settings.envVariableMerges.length,
    defaultEnvVariableMerges.length,
  )
  assert.equal(
    fixture.settings.envVariableMerges.find(
      (merge) => merge.id === "mangohud-config",
    ).delimiter,
    ";",
  )
  assert.deepEqual(
    fixture.settings.envVariableMerges.filter(
      (merge) => merge.id !== "mangohud-config",
    ),
    defaultEnvVariableMerges.filter((merge) => merge.id !== "mangohud-config"),
  )
})

test("missing IDs are generated and an empty delimiter is reviewed and preserved", () => {
  const tree = openRecipe({
    ...recipe,
    envVariableMerges: [{ name: "EXAMPLE_FLAGS", delimiter: "" }],
  })
  assert.ok(tree.includes('\"\"'))
  button(tree, "Add to Decky Launch Options").props.onClick()
  const rule = fixture.settings.envVariableMerges.find(
    (merge) => merge.name === "EXAMPLE_FLAGS",
  )
  assert.ok(rule.id)
  assert.equal(rule.delimiter, "")
})

for (const envVariableMerges of [undefined, []]) {
  test(`recipes with ${envVariableMerges ? "empty" : "omitted"} merge lists preserve existing rules`, () => {
    const tree = openRecipe({ ...recipe, envVariableMerges })
    assert.ok(
      !tree.some(
        (node) =>
          node?.props?.["aria-label"] === "Environment variable merges to add",
      ),
    )
    button(tree, "Add to Decky Launch Options").props.onClick()
    assert.deepEqual(
      fixture.settings.envVariableMerges,
      defaultEnvVariableMerges,
    )
  })
}

test("the legacy array importer still imports options without changing merge rules", () => {
  dialog.batchCreateLaunchOptions(recipe.launchOptions)
  const tree = nodes(fixture.modals[0].element)
  assert.ok(tree.includes("Decky Launch Options"))
  button(tree, "Add to Decky Launch Options").props.onClick()
  assert.equal(fixture.settings.launchOptions[0].id, "overlay")
  assert.deepEqual(fixture.settings.envVariableMerges, defaultEnvVariableMerges)
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
      envVariableMerges: [
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
    assert.deepEqual(fixture.settings.envVariableMerges[0], {
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
