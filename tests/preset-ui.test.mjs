import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { dataURL, sourceModule } from "./source-module.mjs"

const jsx = dataURL(
  `export const Fragment='Fragment'; export const jsx=(type,props,key)=>({type,props,key}); export const jsxs=jsx;`,
)
const react = dataURL(
  `export const useState=init=>globalThis.__presetUI.useState(init); export const useRef=init=>globalThis.__presetUI.useRef(init); export const useEffect=(fn,deps)=>globalThis.__presetUI.useEffect(fn,deps); export const useMemo=fn=>fn(); export const useCallback=fn=>fn;`,
)
const ui = dataURL(
  `export const ButtonItem='ButtonItem', DialogBody='DialogBody', DialogButton='DialogButton', DialogButtonPrimary='DialogButtonPrimary', DialogFooter='DialogFooter', DialogHeader='DialogHeader', Field='Field', Focusable='Focusable', ModalRoot='ModalRoot', PanelSectionRow='PanelSectionRow', SteamSpinner='SteamSpinner', ConfirmModal='ConfirmModal'; export function showModal(element){const modal={element,closed:false,Close(){this.closed=true}}; globalThis.__presetUI.modals.push(modal); return modal;}`,
)
const boundaries = {
  react,
  "react/jsx-runtime": jsx,
  "@decky/ui": ui,
  "@decky/api": dataURL(
    `export const fetchNoCors=(url)=>globalThis.__presetUI.fetcher(url); export const toaster={toast:data=>globalThis.__presetUI.notifications.push(data)};`,
  ),
  "../../hooks": dataURL(
    `export const useSettings=()=>globalThis.__presetUI.actions;`,
  ),
  "../hooks": dataURL(
    `export const useSettings=()=>globalThis.__presetUI.actions;`,
  ),
  "@tanstack/react-query": dataURL(
    `export const QueryClientProvider='QueryClientProvider'; export const useQueries=({queries})=>queries.map(options=>globalThis.__presetUI.query(options)); export const useQuery=options=>globalThis.__presetUI.query(options);`,
  ),
  "../query": dataURL(`export const queryClient={};`),
  "../../queries/settings": dataURL(`export const queryClient={};`),
  "./modal-scroll-content": dataURL(
    `export const ModalScrollContent='ModalScrollContent';`,
  ),
  "../../components/modal-scroll-content": dataURL(
    `export const ModalScrollContent='ModalScrollContent';`,
  ),
  "react-icons/fa": dataURL(
    `export const FaGlobe='FaGlobe', FaCheckCircle='FaCheckCircle';`,
  ),
  "../../components/launch-option-focus": dataURL(
    `export const LaunchOptionFocusList='LaunchOptionFocusList';`,
  ),
}

function harness(settings, catalogs = new Map()) {
  const cells = new WeakMap()
  let current, cursor
  const fixture = {
    modals: [],
    notifications: [],
    writes: [],
    settings,
    catalogs,
    useState(init) {
      const i = cursor++
      current[i] ??= { value: typeof init === "function" ? init() : init }
      const cell = current[i]
      return [
        cell.value,
        (value) => {
          cell.value = typeof value === "function" ? value(cell.value) : value
        },
      ]
    },
    useRef(init) {
      const i = cursor++
      return (current[i] ??= { current: init })
    },
    useEffect(fn, deps) {
      const i = cursor++
      if (!current[i]) current[i] = { cleanup: fn(), deps }
    },
    query(options) {
      return (
        fixture.queryResult?.(options) ?? {
          data: catalogs.get(JSON.stringify(options.queryKey)),
          isPending: false,
          isFetching: false,
          refetch: async () => {},
        }
      )
    },
    render(element) {
      if (Array.isArray(element)) return element.flatMap(fixture.render)
      if (!element || typeof element !== "object") return [element]
      if (typeof element.type === "function") {
        const previous = current,
          oldCursor = cursor
        current = cells.get(element.props) ?? []
        cells.set(element.props, current)
        cursor = 0
        const tree = element.type(element.props)
        current = previous
        cursor = oldCursor
        return fixture.render(tree)
      }
      return [
        element,
        ...fixture.render(element.props.children),
        ...fixture.render(element.props.description),
        ...fixture.render(element.props.label),
        ...fixture.render(element.props.icon),
      ]
    },
    unmount(element) {
      for (const cell of cells.get(element.props) ?? []) cell?.cleanup?.()
    },
  }
  fixture.render = fixture.render.bind(fixture)
  globalThis.__presetUI = fixture
  return fixture
}
test("the real settings hook exposes awaited preset actions backed by the current query cache", async () => {
  const { useSettings } = await import(
    await sourceModule("src/hooks.ts", {
      react,
      "./utils": await sourceModule("src/utils/settings.ts"),
      "../utils": await sourceModule("src/utils/settings.ts"),
      "./queries/settings": dataURL(
        `export const keys={settings:()=>['settings']}; export const queryClient={getQueryData:()=>globalThis.__presetUI.settings}; export const useGetSettingsQuery=()=>({data:globalThis.__presetUI.settings,isFetched:true,isLoading:false}); export const useSetSettingsMutation=()=>({mutate:()=>{throw new Error('Expected awaited preset persistence')},mutateAsync:async settings=>{globalThis.__presetUI.settings=settings;globalThis.__presetUI.writes.push(settings)}});`,
      ),
    })
  )
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const f = harness({
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  })
  let actions
  const element = {
    type: () => {
      actions = useSettings()
      return null
    },
    props: {},
  }
  f.render(element)
  f.render(element)
  assert.equal(typeof actions.applyAppPreset, "function")
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const prepared = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [{ id: "install", on: "setup && %command%" }],
    },
    store,
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  await actions.savePresetRecipe(
    prepared.launchOptions.map(launchOptionFactory),
    [],
  )
  const preset = parsePreset(
    {
      id: "example",
      name: "Example",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "install" }],
    },
    "example.json",
    store,
    "42",
  )
  await actions.applyAppPreset(preset)
  assert.equal(f.writes.length, 2)
  assert.equal(isPresetSelected(preset, f.settings), true)
})

test("the per-app launch options page exposes a Presets tab wired to its exact app", async () => {
  const stub = (names) =>
    dataURL(names.map((name) => `export const ${name}='${name}';`).join(""))
  const mocks = {
    ...boundaries,
    "@decky/api": dataURL(
      `export const fetchNoCors=()=>{throw new Error('Unexpected network')},FileSelectionType={},openFilePicker=()=>{},toaster={};`,
    ),
    "@decky/ui": dataURL(
      `export * from '${ui}'; export const NavEntryPositionPreferences={},Tabs='Tabs',TextField='TextField',ToggleField='ToggleField'; export const useParams=()=>({appid:'1903340'});export const findModule=()=>({TabCount:'count'});`,
    ),
    "@tanstack/react-store": dataURL(
      `export const useStore=(_,selector)=>selector({useHierarchy:false,autoManageLaunchOptions:true,autoManageNonSteamLaunchOptions:true,showCommands:false,launchOptionSort:'local'});`,
    ),
    "../../../../stores": dataURL(`export const settingsStore={};`),
    "../../../../hooks": dataURL(
      `export const useSettings=()=>globalThis.__presetUI.actions;`,
    ),
    "../../../../query": dataURL(
      `export const useGetInfoQuery=()=>({data:null}),useSetDloLaunchOptionsMutation=()=>({}),useDeleteOriginalLaunchOptionsBackupsMutation=()=>({});`,
    ),
    "../../../../utils": dataURL(
      `export const appLaunchOptionsIncludesSupportedDloCommand=()=>true,appLaunchOptionsIsDloCommand=()=>false,countActiveLaunchOptions=()=>0,setAppLaunchOptions=()=>{},toHierarchicalLaunchOptions=()=>[];`,
    ),
    "../../hooks/use-app-launch-options-state": dataURL(
      `export const useAppLaunchOptionsState=()=>({currentLaunchOptions:'',loadedLaunchOptionsAppid:'1903340',isNonSteamApp:false});`,
    ),
    "../../components/launch-option-list": dataURL(
      `export const renderLaunchOptionItems=()=>null;`,
    ),
  }
  for (const [module, names] of Object.entries({
    "../../../../components/action-menu-button": ["ActionMenuButton"],
    "../../../../components/create-launch-option-form": [
      "CreateLaunchOptionForm",
    ],
    "../../../../components/delete-launch-option-modal": [
      "showDeleteLaunchOptionModal",
    ],
    "../../../../components/launch-option-focus": ["LaunchOptionFocusList"],
    "../../../../components/update-launch-option-form": [
      "UpdateLaunchOptionForm",
    ],
    "../../../../components/update-launch-option-group-form": [
      "UpdateLaunchOptionGroupForm",
    ],
    "../../components/inactive-auto-manage-warning": [
      "InactiveAutoManageWarning",
    ],
    "../../components/add-launch-option-row": ["AddLaunchOptionRow"],
    "../../components/launch-options-backups-modal": [
      "LaunchOptionsBackupsModal",
    ],
    "../../components/modal-wrapper": ["ModalWrapper"],
  }))
    mocks[module] = stub(names)
  const { AppLaunchOptionsPage } = await import(
    await sourceModule(
      "src/teams/launch-options/views/[_appid]/index.tsx",
      mocks,
    )
  )
  const f = harness({
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  })
  f.actions = new Proxy(
    { settings: f.settings, getAppOriginalLaunchOptions: () => "" },
    { get: (target, key) => target[key] ?? (() => false) },
  )
  globalThis.window = { setTimeout: () => 1, clearTimeout: () => {} }
  const tree = f.render({ type: AppLaunchOptionsPage, props: {} })
  const tabs = tree.find((node) => node?.type === "Tabs").props.tabs
  const presets = tabs.find((tab) => tab.title === "Presets")
  assert.ok(presets, "Presets is an actual app-page tab")
  assert.equal(presets.content.props.appid, "1903340")
  assert.equal(presets.content.type.name, "AppPresets")
})

test("missing options in an imported recipe offer reviewed re-import even when none of its preset references resolve", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { parsePreset, prepareRecipeImport } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "missing" }],
    },
    "test.json",
    store,
    "42",
  )
  const imported = prepareRecipeImport(
    {
      id: "renderer",
      name: "Renderer",
      launchOptions: [{ id: "unreferenced", on: "%command%" }],
    },
    store,
  )
  const f = harness({
    profiles: {},
    launchOptions: imported.launchOptions.map(launchOptionFactory),
    environmentVariableMerges: [],
  })
  f.actions = {
    settings: f.settings,
    loading: false,
    savePresetRecipe: async () => {},
    applyAppPreset: async () => {},
  }
  f.queryResult = () => ({
    data: [
      {
        id: "renderer",
        name: "Renderer",
        launchOptions: [{ id: "missing", on: "new %command%" }],
      },
    ],
    isFetching: false,
  })
  const tree = f.render({
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  })
  assert.ok(button(tree, "Add Renderer recipe"))
  const reader = tree.find((node) => node?.type === "ModalScrollContent")
  assert.equal(button(f.render(reader), "Add Renderer recipe"), undefined,
    "recipe buttons must not bubble gamepad direction events through the scroll reader")
  let recipeFocus = 0
  button(tree, "Add Renderer recipe").props.ref.current = { focus: () => recipeFocus++ }
  reader.props.onFocusNext()
  assert.equal(recipeFocus, 1, "leaving the reader enters the recipe controls")
})

test("conflicting choices discovered in an unimported recipe cannot partially apply through the dialog", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      { id: "low", valueId: "quality", valueName: "Low" },
      { id: "high", valueId: "quality", valueName: "High" },
    ],
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: recipe.launchOptions.map((option) => ({
        recipeId: "renderer",
        launchOptionId: option.id,
      })),
    },
    "test.json",
    store,
    "42",
  )
  const prepared = prepareRecipeImport(recipe, store)
  const f = harness({
    profiles: {},
    launchOptions: [launchOptionFactory(prepared.launchOptions[0])],
    environmentVariableMerges: [],
  })
  f.actions = {
    settings: f.settings,
    loading: false,
    ...createPresetActions(
      () => f.settings,
      async (settings) => {
        f.writes.push(settings)
      },
    ),
  }
  f.queryResult = () => ({ data: [recipe], isFetching: false })
  const tree = f.render({
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  })
  const apply = button(tree, "Apply preset anyway")
  assert.equal(apply.props.disabled, true)
  assert.equal(tree.some((node) => node?.props?.role === "alert"), false)
  apply.props.onClick()
  await tick()
  assert.equal(f.writes.length, 0)
})

test("declining reviewed import applies only the explicitly confirmed subset and lists every skipped reference", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      { id: "available", on: "available %command%" },
      { id: "missing", on: "missing %command%" },
    ],
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: [
        { recipeId: "renderer", launchOptionId: "available" },
        { recipeId: "renderer", launchOptionId: "missing" },
        { recipeId: "absent", launchOptionId: "unavailable" },
      ],
    },
    "test.json",
    store,
    "42",
  )
  const f = harness({
    profiles: {},
    launchOptions: [
      launchOptionFactory(prepareRecipeImport(recipe, store).launchOptions[0]),
    ],
    environmentVariableMerges: [],
  })
  f.actions = {
    get settings() {
      return f.settings
    },
    loading: false,
    ...createPresetActions(
      () => f.settings,
      async (settings) => {
        f.settings = settings
        f.writes.push(settings)
      },
    ),
  }
  f.queryResult = () => ({ data: [recipe], isFetching: false })
  const element = {
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  }
  let tree = f.render(element)
  button(tree, "Add Renderer recipe").props.onClick()
  await tick()
  assert.equal(f.writes.length, 0)
  const importModal = f.modals[0]
  button(f.render(importModal.element), "Cancel").props.onClick()
  await tick()
  assert.equal(f.writes.length, 0)
  tree = f.render(element)
  button(tree, "Apply preset anyway").props.onClick()
  await tick()
  assert.equal(f.writes.length, 1)
  assert.equal(isPresetSelected(preset, f.settings), false)
  assert.equal(f.notifications.at(-1).title, "Applied Test preset")
  assert.equal(f.notifications.at(-1).body, "1 launch option applied")
  assert.equal(
    f.settings.profiles[42].state[f.settings.launchOptions[0].id],
    true,
  )
})

test("store sections require an available preset and preserve loading, empty and refresh states", async () => {
  const { AppPresets } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { parsePreset } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const stores = ["One", "Two"].map((name) => ({
    url: `https://${name}.test/store.json`,
    store: {
      name,
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }))
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "Description",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "option" }],
    },
    "test.json",
    stores[0],
    "42",
  )
  const f = harness({
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  })
  f.actions = { settings: f.settings, loading: false }
  globalThis.localStorage = {
    getItem: (key) =>
      key.endsWith("default-removed") ? "true" : JSON.stringify(stores),
  }
  let refetches = 0
  f.queryResult = (options) => ({
    data: options.queryKey[1].includes("One.test")
      ? { presets: [preset], errors: [] }
      : undefined,
    error: options.queryKey[1].includes("Two.test")
      ? new Error("Rate limit")
      : null,
    isFetching: false,
    isPending: false,
    refetch: async () => {
      refetches++
    },
  })
  const page = { type: AppPresets, props: { appid: "42" } }
  let tree = f.render(page)
  assert.ok(button(tree, "Test"))
  assert.equal(tree.includes("Rate limit"), false)
  assert.deepEqual(
    tree.filter((node) => node?.type === "strong").map((node) => node.props.children[0]),
    ["One"],
    "stores without presets have no heading, even when their request fails",
  )
  button(tree, "Refresh presets").props.onClick()
  assert.equal(refetches, 2)
  f.queryResult = () => ({
    error: new Error("No internet connection"),
    isFetching: false,
    isPending: false,
  })
  tree = f.render(page)
  assert.equal(tree.some((node) => node?.type === "strong"), false)
  assert.equal(tree.includes("No internet connection"), false)
  assert.ok(tree.includes("No presets found for this app."))
  f.queryResult = () => ({
    data: { presets: [], errors: ["Invalid preset"] },
    isFetching: false,
    isPending: false,
  })
  tree = f.render(page)
  assert.equal(tree.some((node) => node?.type === "strong"), false)
  assert.equal(tree.includes("Invalid preset"), false)
  assert.ok(tree.includes("No presets found for this app."))
  f.queryResult = () => ({ isPending: true, isFetching: true })
  tree = f.render(page)
  assert.ok(
    tree.some((node) => node?.props?.["aria-label"] === "Loading presets"),
  )
  f.queryResult = () => ({
    data: { presets: [preset], errors: ["Previous error"] },
    isPending: false,
    isFetching: true,
  })
  tree = f.render(page)
  assert.ok(tree.some((node) => node?.props?.["aria-label"] === "Loading presets"))
  assert.equal(button(tree, "Test"), undefined, "cached presets stay hidden while refreshing")
  assert.equal(tree.includes("Previous error"), false)
  f.queryResult = () => ({
    data: { presets: [], errors: [] },
    isPending: false,
    isFetching: false,
  })
  tree = f.render(page)
  assert.ok(tree.includes("No presets found for this app."))
})

test("recipe discovery allows partial application and app unmount blocks stale writes", async () => {
  const { AppPresets } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { parsePreset } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "option" }],
    },
    "test.json",
    store,
    "42",
  )
  const f = harness({
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  })
  let writes = 0
  f.actions = {
    settings: f.settings,
    loading: false,
    applyAppPreset: async () => {
      writes++
      return { selected: 0, skipped: preset.launchOptions }
    },
  }
  globalThis.localStorage = {
    getItem: (key) =>
      key.endsWith("default-removed") ? "true" : JSON.stringify([store]),
  }
  f.queryResult = (options) =>
    options.queryKey[0] === "app-presets"
      ? { data: { presets: [preset], errors: [] }, isFetching: false }
      : { data: [], isFetching: true }
  const page = { type: AppPresets, props: { appid: "42" } }
  button(f.render(page), "Test").props.onClick()
  const modal = f.modals[0]
  let tree = f.render(modal.element)
  assert.equal(button(tree, "Apply preset anyway").props.disabled, false)
  button(tree, "Apply preset anyway").props.onClick()
  await tick()
  assert.equal(writes, 1, "recipe discovery must not block applying imported options")
  assert.equal(modal.closed, true)
  f.queryResult = () => ({ data: [], isFetching: false })
  tree = f.render(modal.element)
  f.unmount(page)
  assert.equal(modal.closed, true)
  button(tree, "Apply preset anyway").props.onClick()
  await tick()
  assert.equal(writes, 1, "leaving the app cancels its old dialog")
})

test("preset recipe review reflects preserved globals rather than importing a recipe's global defaults", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { parsePreset } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "option" }],
    },
    "test.json",
    store,
    "42",
  )
  const f = harness({
    profiles: {},
    launchOptions: [],
    environmentVariableMerges: [],
  })
  f.actions = {
    settings: f.settings,
    loading: false,
    savePresetRecipe: async () => {},
  }
  f.queryResult = () => ({
    data: [
      {
        id: "renderer",
        name: "Renderer",
        launchOptions: [
          {
            id: "option",
            enableGlobally: true,
            on: "global-default %command%",
          },
        ],
      },
    ],
    isFetching: false,
  })
  const tree = f.render({
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  })
  button(tree, "Add Renderer recipe").props.onClick()
  await tick()
  const review = f.render(f.modals[0].element)
  assert.ok(review.includes("global-default %command%"))
  assert.equal(
    review.some((node) => node?.props?.["aria-label"] === "Enable globally"),
    false,
  )
  button(review, "Cancel").props.onClick()
  await tick()
})

test("a reviewed re-import that still lacks a reference reports it as skipped, never complete", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://fixture.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "example/store", branch: "main" },
    },
  }
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [{ id: "old", on: "old %command%" }],
  }
  const preset = parsePreset(
    {
      id: "test",
      name: "Test",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "missing" }],
    },
    "test.json",
    store,
    "42",
  )
  const f = harness({
    profiles: {},
    launchOptions: prepareRecipeImport(recipe, store).launchOptions.map(
      launchOptionFactory,
    ),
    environmentVariableMerges: [],
  })
  f.actions = {
    get settings() {
      return f.settings
    },
    loading: false,
    ...createPresetActions(
      () => f.settings,
      async (settings) => {
        f.settings = settings
        f.writes.push(settings)
      },
    ),
  }
  f.queryResult = () => ({ data: [recipe], isFetching: false })
  const element = {
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  }
  button(f.render(element), "Add Renderer recipe").props.onClick()
  await tick()
  button(
    f.render(f.modals[0].element),
    "Add to Decky Launch Options",
  ).props.onClick()
  await tick()
  assert.equal(f.writes.length, 1)
  const tree = f.render(element)
  assert.ok(button(tree, "Apply preset anyway"))
  button(tree, "Apply preset anyway").props.onClick()
  await tick()
  assert.equal(isPresetSelected(preset, f.settings), false)
  assert.equal(f.settings.profiles[42], undefined)
  assert.equal(f.notifications.at(-1).title, "Applied Test preset")
  assert.equal(f.notifications.at(-1).body, "0 launch options applied")
})

const button = (tree, label) =>
  tree.find(
    (node) =>
      ["ButtonItem", "DialogButton", "DialogButtonPrimary"].includes(node?.type) &&
      (node.props.children === label || node.props["aria-label"] === `Use ${label}`),
  )
const tick = () => new Promise((resolve) => setImmediate(resolve))

test("published app fixture flows through the preset dialog, existing recipe review, and real selection persistence", async () => {
  const { AppPresets } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, isPresetSelected } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { presetQueryOptions } = await import(
    await sourceModule("src/teams/app-presets/discovery.ts")
  )
  const fixtureRoot = new URL("./fixtures/app-presets/", import.meta.url)
  const presetData = JSON.parse(
    await readFile(new URL("steam-deck.json", fixtureRoot), "utf8"),
  )
  const recipe = JSON.parse(
    await readFile(new URL("renderer.json", fixtureRoot), "utf8"),
  )
  const store = {
    url: "https://example.test/store.json",
    store: {
      name: "Fixture Store",
      description: "",
      type: "github",
      github: { repository: "example/recipes", branch: "fixture" },
    },
  }
  const preset = parsePreset(presetData, "steam-deck.json", store, "1903340")
  const catalogs = new Map([
    [
      JSON.stringify(presetQueryOptions(store, "1903340", () => {}).queryKey),
      { presets: [preset], errors: [] },
    ],
    [
      JSON.stringify([
        "store-recipes",
        "https://raw.githubusercontent.com/example/recipes/refs/heads/fixture/recipes.json",
      ]),
      [recipe],
    ],
  ])
  const f = harness(
    {
      profiles: {
        77: { state: { unrelated: true }, originalLaunchOptions: "--original" },
      },
      launchOptions: [],
      environmentVariableMerges: [],
    },
    catalogs,
  )
  f.actions = {
    get settings() {
      return f.settings
    },
    loading: false,
    ...createPresetActions(
      () => f.settings,
      async (settings) => {
        f.settings = settings
        f.writes.push(structuredClone(settings))
      },
    ),
  }
  globalThis.localStorage = {
    getItem: (key) =>
      key.endsWith("default-removed") ? "true" : JSON.stringify([store]),
  }
  const page = { type: AppPresets, props: { appid: "1903340" } }
  const list = f.render(page)
  assert.ok(list.includes(preset.description))
  button(list, preset.name).props.onClick()
  const modal = f.modals[0]
  assert.equal(
    modal.element.type,
    "QueryClientProvider",
    "Decky modal roots need their own settings/query provider",
  )
  let review = f.render(modal.element)
  assert.ok(
    review.some((node) => node?.type === "ModalScrollContent"),
    "preset values are readable with controller scrolling",
  )
  assert.equal(f.writes.length, 0)
  assert.ok(review.includes(recipe.launchOptions.find((option) => option.id === "dlor-optiscaler-install").name))
  assert.equal(review.includes("On command"), false)
  const importButton = review.find(
    (node) =>
      typeof node?.props?.children === "string" &&
      /^Add /.test(node.props.children),
  )
  assert.ok(importButton, "missing recipes offer an explicit reviewed import")
  importButton.props.onClick()
  await tick()
  const importModal = f.modals[1]
  const importReview = f.render(importModal.element)
  assert.ok(
    importReview.includes(
      recipe.launchOptions.find(
        (option) => option.id === preset.launchOptions[0].launchOptionId,
      ).on,
    ),
  )
  assert.equal(f.writes.length, 0)
  button(importReview, "Add to Decky Launch Options").props.onClick()
  await tick()
  assert.equal(f.writes.length, 1)
  assert.equal(importModal.closed, true)
  review = f.render(modal.element)
  assert.equal(review.filter((node) => node?.type === "li").length, 10)
  assert.equal(review.includes("On command"), false)
  const applyPreset = f.actions.applyAppPreset
  f.actions.applyAppPreset = async () => { throw new Error("Could not save preset") }
  review = f.render(modal.element)
  button(review, "Apply preset").props.onClick()
  await tick()
  assert.equal(modal.closed, false)
  assert.equal(f.notifications.length, 0)
  review = f.render(modal.element)
  assert.ok(review.includes("Could not save preset"))
  let finishSave
  f.actions.applyAppPreset = async (...args) => {
    await new Promise((resolve) => { finishSave = resolve })
    return applyPreset(...args)
  }
  review = f.render(modal.element)
  button(review, "Apply preset").props.onClick()
  await tick()
  assert.equal(modal.closed, false, "keep the dialog open until saving succeeds")
  assert.equal(f.notifications.length, 0)
  finishSave()
  await tick()
  assert.equal(modal.closed, true)
  assert.equal(f.notifications.at(-1).title, `Applied ${preset.name} preset`)
  assert.equal(f.notifications.at(-1).body, "10 launch options applied")
  assert.equal(f.writes.length, 2)
  assert.equal(isPresetSelected(preset, f.settings), true)
  assert.equal(preset.launchOptions.length, 10)
  assert.equal(
    Object.values(f.settings.profiles[1903340].state).filter(Boolean).length,
    10,
  )
  assert.deepEqual(f.settings.profiles[77], {
    state: { unrelated: true },
    originalLaunchOptions: "--original",
  })
  assert.ok(f.settings.launchOptions.every((option) => !option.enableGlobally))
  assert.ok(
    f
      .render(page)
      .some((node) => node?.props?.["aria-label"] === "Preset selected"),
  )
})

test("global-protected preset choices explain skips without reimport and only effective inherited matches show green", async () => {
  const { AppPresets } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://global.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "global/recipes", branch: "main" },
    },
  }
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      {
        id: "low",
        name: "Quality",
        valueId: "quality",
        valueName: "Low",
        enableGlobally: true,
        on: "QUALITY=low",
      },
      {
        id: "high",
        name: "Quality",
        valueId: "quality",
        valueName: "High",
        on: "QUALITY=high",
      },
    ],
  }
  const preset = parsePreset(
    {
      id: "global-test",
      name: "Global test",
      description: "",
      launchOptions: [{ recipeId: "renderer", launchOptionId: "high" }],
    },
    "global-test.json",
    store,
    "42",
  )
  globalThis.localStorage = {
    getItem: (key) =>
      key.endsWith("default-removed") ? "true" : JSON.stringify([store]),
  }
  for (const highImported of [true, false]) {
    const options = prepareRecipeImport(recipe, store).launchOptions.map(
      launchOptionFactory,
    )
    const f = harness({
      profiles: {},
      launchOptions: highImported ? options : options.slice(0, 1),
      environmentVariableMerges: [],
    })
    const before = structuredClone(f.settings)
    f.actions = {
      get settings() {
        return f.settings
      },
      loading: false,
      ...createPresetActions(
        () => f.settings,
        async (next) => {
          f.settings = next
          f.writes.push(next)
        },
      ),
    }
    f.queryResult = (options) => ({
      data:
        options.queryKey[0] === "app-presets"
          ? { presets: [preset], errors: [] }
          : [recipe],
      isFetching: false,
      isPending: false,
    })
    const page = { type: AppPresets, props: { appid: "42" } }
    assert.equal(
      f
        .render(page)
        .some((node) => node?.props?.["aria-label"] === "Preset selected"),
      false,
    )
    button(f.render(page), preset.name).props.onClick()
    const modal = f.modals[0]
    let tree = f.render(modal.element)
    assert.ok(
      tree.some(
        (node) =>
          typeof node === "string" &&
          / — Skipped/.test(node),
      ),
      "mark globally protected options as skipped before application",
    )
    assert.equal(
      tree.some(
        (node) =>
          typeof node?.props?.children === "string" &&
          /^Add /.test(node.props.children),
      ),
      false,
    )
    assert.equal(
      tree.some(
        (node) => typeof node === "string" && /Not imported/.test(node),
      ),
      false,
    )
    button(tree, "Apply preset").props.onClick()
    await tick()
    assert.equal(modal.closed, true)
    assert.ok(f.notifications.at(-1).body.includes("0 launch options applied"),
      "selected count must not include a protected inactive choice")
    assert.deepEqual(f.settings, before)
    assert.equal(f.writes.length, 0)
    assert.equal(
      f
        .render(page)
        .some((node) => node?.props?.["aria-label"] === "Preset selected"),
      false,
    )
    const matching = {
      ...preset,
      launchOptions: [{ recipeId: "renderer", launchOptionId: "low" }],
    }
    f.queryResult = (options) => ({
      data: options.queryKey[0] === "app-presets"
        ? { presets: [matching], errors: [] }
        : [recipe],
      isFetching: false,
    })
    assert.equal(
      f
        .render(page)
        .some((node) => node?.props?.["aria-label"] === "Preset selected"),
      true,
    )
    button(f.render(page), matching.name).props.onClick()
    const matchingTree = f.render(f.modals.at(-1).element)
    assert.ok(matchingTree.includes(" — Skipped"),
      "globally enabled options are marked skipped even when they already match")
  }
})

test("reviewed recovery imports available options while preserving globally protected definitions and manual overrides", async () => {
  const { PresetDialog } = await import(
    await sourceModule("src/teams/app-presets/app-presets.tsx", boundaries)
  )
  const { createPresetActions } = await import(
    await sourceModule("src/teams/app-presets/actions.ts")
  )
  const { parsePreset, prepareRecipeImport, isPresetSelected } = await import(
    await sourceModule("src/teams/app-presets/model.ts")
  )
  const { launchOptionFactory } = await import("../src/shared.ts")
  const store = {
    url: "https://global.test/store.json",
    store: {
      name: "Store",
      description: "",
      type: "github",
      github: { repository: "global/recipes", branch: "main" },
    },
  }
  const recipe = {
    id: "renderer",
    name: "Renderer",
    launchOptions: [
      {
        id: "low",
        name: "Quality",
        valueId: "quality",
        valueName: "Low",
        enableGlobally: true,
        on: "QUALITY=low",
      },
      {
        id: "high",
        name: "Quality",
        valueId: "quality",
        valueName: "High",
        on: "QUALITY=high",
      },
      { id: "available", name: "Available", on: "AVAILABLE=1" },
    ],
  }
  const options = prepareRecipeImport(recipe, store).launchOptions.map(
    launchOptionFactory,
  )
  const f = harness({
    profiles: {
      42: {
        state: { [options[0].id]: false, unrelated: true },
        originalLaunchOptions: "kept",
      },
      77: { state: { other: true }, originalLaunchOptions: "other" },
    },
    launchOptions: options.slice(0, 2),
    environmentVariableMerges: [],
  })
  const before = structuredClone(f.settings)
  const preset = parsePreset(
    {
      id: "global-test",
      name: "Global test",
      description: "",
      launchOptions: [
        { recipeId: "renderer", launchOptionId: "high" },
        { recipeId: "renderer", launchOptionId: "available" },
      ],
    },
    "global-test.json",
    store,
    "42",
  )
  f.actions = {
    get settings() {
      return f.settings
    },
    loading: false,
    ...createPresetActions(
      () => f.settings,
      async (next) => {
        f.settings = next
        f.writes.push(next)
      },
    ),
  }
  f.queryResult = () => ({
    data: [
      {
        ...recipe,
        launchOptions: recipe.launchOptions.map((option) =>
          option.id === "low" ? { ...option, on: "QUALITY=changed" } : option,
        ),
      },
    ],
    isFetching: false,
  })
  const element = {
    type: PresetDialog,
    props: { preset, signal: new AbortController().signal, onClose: () => {} },
  }
  button(f.render(element), "Add Renderer recipe").props.onClick()
  await tick()
  assert.equal(f.writes.length, 0)
  button(
    f.render(f.modals[0].element),
    "Add to Decky Launch Options",
  ).props.onClick()
  await tick()
  assert.equal(f.writes.length, 1)
  for (const option of before.launchOptions)
    assert.deepEqual(
      f.settings.launchOptions.find((item) => item.id === option.id),
      option,
    )
  assert.deepEqual(f.settings.profiles, before.profiles)
  const applyAvailable = button(f.render(element), "Apply preset")
  assert.ok(
    applyAvailable,
    "global conflicts require explicit available-subset application",
  )
  applyAvailable.props.onClick()
  await tick()
  assert.deepEqual(f.settings.profiles[42].state, {
    ...before.profiles[42].state,
    [options[2].id]: true,
  })
  assert.deepEqual(f.settings.profiles[77], before.profiles[77])
  assert.equal(isPresetSelected(preset, f.settings), false)
  assert.equal(f.notifications.at(-1).body, "1 launch option applied")
})
