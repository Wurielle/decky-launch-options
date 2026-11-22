import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { beforeEach, test } from "node:test"
import ts from "typescript"

const compile = (file) =>
  ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
const entrySource = compile(new URL("../src/index.tsx", import.meta.url))
const utilitySource = compile(
  new URL("../src/utils/app-launch-options.ts", import.meta.url),
)
const info = {
  COMMAND: "~/.dlo/run %command%",
  SHORT_SH_COMMAND_PATH: "~/.dlo/run",
  FULL_SH_COMMAND_PATH: "/home/deck/.dlo/run",
}
const settings = { profiles: { 1: { state: {}, originalLaunchOptions: "" } } }
const never = new Promise(() => {})
const flush = () => new Promise((resolve) => setImmediate(resolve))
let window, current, listeners, writes, heldWrites

beforeEach(() => {
  window = new EventTarget()
  current = info.COMMAND
  listeners = new Set()
  writes = []
  heldWrites = undefined
})

// Execute the real entry point and Steam helpers in a fresh bundle context on
// every reload, sharing only the same browser window and live Steam shortcut.
function mount({
  settingsReady = Promise.resolve(settings),
  infoReady = Promise.resolve(info),
  shellReady = Promise.resolve(true),
} = {}) {
  const cache = new Map()
  const queryClient = {
    fetchQuery(options) {
      const ready = options.queryKey === "settings" ? settingsReady : infoReady
      return ready.then((value) => {
        cache.set(options.queryKey, value)
        return value
      })
    },
    getQueryData(key) {
      return cache.get(key)
    },
  }
  const context = vm.createContext({
    window,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    CustomEvent,
    SteamClient: {
      Apps: {
        RegisterForAppDetails(_appid, callback) {
          listeners.add(callback)
          queueMicrotask(() => {
            if (listeners.has(callback))
              callback({
                strShortcutExe: "/bin/game",
                strShortcutLaunchOptions: current,
              })
          })
          return {
            unregister() {
              listeners.delete(callback)
            },
          }
        },
        SetAppLaunchOptions(appid, value) {
          writes.push({ appid, value })
          const publish = () => {
            current = value
            queueMicrotask(() => {
              for (const callback of listeners)
                callback({
                  strShortcutExe: "/bin/game",
                  strShortcutLaunchOptions: current,
                })
            })
          }
          if (heldWrites) heldWrites.push(publish)
          else publish()
        },
      },
    },
  })
  const utilityExports = {}
  vm.runInContext(
    `(function(exports){${utilitySource}\n})`,
    context,
  )(utilityExports)
  const modules = {
    "react/jsx-runtime": { jsx: (...args) => args },
    "@decky/ui": { staticClasses: {} },
    "@decky/api": {
      definePlugin: (fn) => fn,
      routerHook: { addRoute() {}, removeRoute() {}, removePatch() {} },
    },
    "react-icons/fa": {},
    "./shared": {
      routes: {
        appLaunchOptions() {},
        launchOptionsManagerItem() {},
        environmentVariableMergesManagerItem() {},
      },
    },
    "@tanstack/react-query": {},
    "./patches/context-menu": { default: () => ({ unpatch() {} }) },
    "./patches/library-app": { libraryAppPatch: () => [] },
    "./query": {
      queryClient,
      getSettingsQueryOptions: { queryKey: "settings" },
      getInfoQueryOptions: { queryKey: "info" },
    },
    "./utils": utilityExports,
    "./api": { has_shell_script: () => shellReady },
    "./stores": {
      settingsStore: {
        state: {
          autoManageLaunchOptions: false,
          autoManageNonSteamLaunchOptions: false,
        },
      },
    },
  }
  const exports = {}
  vm.runInContext(`(function(exports,require){${entrySource}\n})`, context)(
    exports,
    (name) => modules[name] ?? {},
  )
  return exports.default()
}

function manualHandoff() {
  window.dloLaunchOptionsRestored = Promise.resolve({
    1: { originalLaunchOptions: "", managedLaunchOptions: info.COMMAND },
  })
  current = ""
}

test("dismount still waits for a Steam write that has already started", async () => {
  manualHandoff()
  heldWrites = []
  const first = mount()
  await flush()
  assert.equal(heldWrites.length, 1)
  first.onDismount()
  let finished = false
  window.dloLaunchOptionsRestored.then(() => {
    finished = true
  })
  await flush()
  assert.equal(finished, false)
  const [acknowledge] = heldWrites
  heldWrites = undefined
  acknowledge()
  await restoredWithinTurn()
  assert.equal(current, "")
  mount()
  await flush()
  assert.equal(current, info.COMMAND)
  assert.deepEqual(
    writes.map((write) => write.value),
    [info.COMMAND, "", info.COMMAND],
  )
})

test("Reset after a completed recovery is not undone by a later reload", async () => {
  manualHandoff()
  const first = mount()
  await flush()
  assert.equal(current, info.COMMAND)
  current = ""
  first.onDismount()
  const restored = await restoredWithinTurn()
  assert.deepEqual(Object.keys(restored), [])
  mount()
  await flush()
  assert.equal(current, "")
  assert.equal(writes.length, 1)
})

test("backend readiness arriving after dismount cannot write into the next instance", async () => {
  manualHandoff()
  let resolveSettings
  const settingsReady = new Promise((resolve) => {
    resolveSettings = resolve
  })
  const first = mount({ settingsReady })
  await flush()
  first.onDismount()
  await restoredWithinTurn()
  mount()
  await flush()
  assert.equal(current, info.COMMAND)
  const count = writes.length
  current = "--external"
  resolveSettings(settings)
  await flush()
  assert.equal(current, "--external")
  assert.equal(writes.length, count)
  assert.equal(listeners.size, 0)
})

async function restoredWithinTurn() {
  const pending = Symbol("pending")
  const value = await Promise.race([
    window.dloLaunchOptionsRestored,
    flush().then(() => pending),
  ])
  assert.notEqual(
    value,
    pending,
    "dismount must not wait for backend calls from a stopped plugin",
  )
  return value
}

for (const dependency of ["settingsReady", "infoReady", "shellReady"]) {
  test(`manual non-Steam Apply survives repeated reloads with a never-settling ${dependency}`, async () => {
    const first = mount()
    await flush()
    first.onDismount()
    await restoredWithinTurn()
    assert.equal(current, "")
    for (let i = 0; i < 10; i++) {
      const interrupted = mount({ [dependency]: never })
      await flush()
      interrupted.onDismount()
      await restoredWithinTurn()
    }
    mount()
    await flush()
    assert.equal(current, info.COMMAND)
    assert.equal(listeners.size, 0)
  })
}
