import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import ts from "typescript"
import {
  launchOptionsLifecycle,
  restoreAppLaunchOptions,
} from "../src/utils/app-launch-options.ts"

const info = {
  COMMAND: "~/.dlo/run %command%",
  SHORT_SH_COMMAND_PATH: "~/.dlo/run",
  FULL_SH_COMMAND_PATH: "/home/deck/.dlo/run",
}
const fileURL = (name) => pathToFileURL(path.resolve(name)).href
const dataURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
let fixture,
  actions,
  sequence = 0

// Exercise the production mutations and settings-cache callbacks. Only React's
// hook boundary and Steam/backend I/O are replaced; no browser is needed.
async function sourceModule(name, imports) {
  let source = ts.transpileModule(await readFile(name, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  for (const [from, to] of Object.entries(imports))
    source = source.replaceAll(`"${from}"`, JSON.stringify(to))
  return dataURL(`${source}\n// fixture ${sequence}`)
}

beforeEach(async () => {
  sequence++
  fixture = {
    settings: { profiles: {}, launchOptions: [], envVariableMerges: [] },
    live: "",
    hasScript: true,
    nonSteam: false,
    shortcutRead: "",
    prefs: {
      autoManageLaunchOptions: true,
      autoManageNonSteamLaunchOptions: true,
    },
    writes: [],
    events: [],
    saves: 0,
  }
  fixture.gate = new Promise((resolve) => {
    fixture.release = resolve
  })
  globalThis.__dloMutationFixture = fixture
  globalThis.window = new EventTarget()
  launchOptionsLifecycle.active = true
  const listeners = new Set()
  globalThis.SteamClient = {
    Apps: {
      RegisterForAppDetails(_appid, callback) {
        listeners.add(callback)
        queueMicrotask(() => {
          if (listeners.has(callback))
            callback(
              fixture.nonSteam
                ? {
                    strShortcutExe: "/bin/game",
                    strShortcutLaunchOptions: fixture.live,
                  }
                : { strLaunchOptions: fixture.live },
            )
        })
        return {
          unregister() {
            listeners.delete(callback)
          },
        }
      },
      SetAppLaunchOptions(_appid, value) {
        fixture.writes.push(value)
        fixture.events.push("steam write")
        fixture.live = value
        queueMicrotask(() => {
          for (const cb of listeners)
            cb(
              fixture.nonSteam
                ? {
                    strShortcutExe: "/bin/game",
                    strShortcutLaunchOptions: value,
                  }
                : { strLaunchOptions: value },
            )
        })
      },
    },
  }
  const hooks = dataURL(`
    export function useSettings() { return {
      getAppOriginalLaunchOptions: id => globalThis.__dloMutationFixture.client.getQueryData(['settings'])?.profiles[id]?.originalLaunchOptions ?? '',
      getAppDisableAutoManageLaunchOptions: id => globalThis.__dloMutationFixture.settings.profiles[id]?.disableAutoManageLaunchOptions === true,
    } } // ${sequence}`)
  const reactQuery = dataURL(`
    export const queryOptions = x => x;
    export const useQuery = () => ({});
    export class QueryClient {
      constructor() { this.cache = new Map(); globalThis.__dloMutationFixture.client = this; }
      getQueryData(key) { return this.cache.get(JSON.stringify(key)); }
      setQueryData(key, value) { globalThis.__dloMutationFixture.events.push('cache published'); this.cache.set(JSON.stringify(key), value); }
      async ensureQueryData(options) { const cached=this.getQueryData(options.queryKey); if(cached !== undefined) return cached; const value=await options.queryFn(); this.setQueryData(options.queryKey,value); return value; }
      refetchQueries() { return new Promise(() => {}); }
    }
    export function useMutation(options) {
      const run = async value => { const result=await options.mutationFn(value); await options.onSuccess?.(result,value); return result; };
      return { ...options, mutateAsync: run, mutate(value, callbacks) { run(value).catch(e => callbacks?.onError?.(e)); } };
    } // ${sequence}`)
  const decky = dataURL(`
    export const callable = method => async (...args) => {
      const f=globalThis.__dloMutationFixture;
      if(method==='has_shell_script')return f.hasScript;
      if(method==='get_settings')return structuredClone(f.settings);
      if(method==='get_shortcut_launch_options')return f.shortcutRead;
      if(method==='set_settings') { f.saves++; f.events.push('save started'); await f.gate; if(f.error)throw f.error; f.settings=structuredClone(args[0]); f.events.push('save completed'); }
    }; // ${sequence}`)
  const api = await sourceModule("src/api.ts", { "@decky/api": decky })
  const shared = fileURL("src/shared.ts")
  const normalization = await sourceModule("src/utils/settings.ts", {
    "../shared": shared,
    uuid: import.meta.resolve("uuid"),
  })
  const utils = dataURL(
    `export * from '${fileURL("src/utils/app-launch-options.ts")}'; export * from '${normalization}'; // ${sequence}`,
  )
  const settings = await sourceModule("src/queries/settings.ts", {
    "@tanstack/react-query": reactQuery,
    "../api": api,
  })
  const store = dataURL(
    `export const settingsStore={state:globalThis.__dloMutationFixture.prefs}; // ${sequence}`,
  )
  const reactStore = dataURL(
    `export const useStore=(store,select)=>select(store.state); // ${sequence}`,
  )
  actions = await import(
    await sourceModule("src/queries/app-launch-options.ts", {
      "@tanstack/react-query": reactQuery,
      "@tanstack/react-store": reactStore,
      "../api": api,
      "../hooks": hooks,
      "../stores": store,
      "../utils": utils,
      "../shared": shared,
      "./settings": settings,
    })
  )
})

async function waitForSave() {
  for (let n = 0; n < 20 && !fixture.saves; n++)
    await new Promise((resolve) => setImmediate(resolve))
  assert.equal(fixture.saves, 1)
}
const applyManual = () =>
  actions.useSetDloLaunchOptionsMutation().mutateAsync({
    appid: 1,
    currentLaunchOptions: fixture.live,
    command: info.COMMAND,
  })

test("empty originals are persisted and cached before DLO replaces Steam's field", async () => {
  const applying = applyManual()
  await waitForSave()
  assert.equal(fixture.live, "")
  assert.deepEqual(fixture.writes, [])
  fixture.release()
  await applying
  assert.equal(fixture.settings.profiles[1].originalLaunchOptions, "")
  assert.equal(
    fixture.client.getQueryData(["settings"]).profiles[1].originalLaunchOptions,
    "",
  )
  assert.equal(fixture.live, info.COMMAND)
  assert(
    fixture.events.indexOf("save completed") <
      fixture.events.indexOf("steam write"),
  )
  await restoreAppLaunchOptions(
    1,
    fixture.client.getQueryData(["settings"]).profiles[1],
    info,
  )
  assert.equal(fixture.live, "")
})

test("unloading during a slow save leaves displaced arguments intact", async () => {
  fixture.live = "--original"
  const applying = applyManual()
  await waitForSave()
  launchOptionsLifecycle.active = false
  fixture.release()
  await applying
  assert.equal(fixture.live, "--original")
  assert.deepEqual(fixture.writes, [])
})

test("a failed save cannot install DLO or publish an unsaved original", async () => {
  fixture.live = "--original"
  fixture.error = Error("disk full")
  const applying = applyManual()
  await waitForSave()
  fixture.release()
  await assert.rejects(applying, /disk full/)
  assert.equal(fixture.live, "--original")
  assert.deepEqual(fixture.writes, [])
  assert.equal(fixture.client.getQueryData(["settings"]).profiles[1], undefined)
})

test("manual Apply with auto-management off preserves existing profile and global settings", async () => {
  fixture.live = "--original"
  fixture.nonSteam = true
  fixture.prefs.autoManageNonSteamLaunchOptions = false
  fixture.settings = {
    profiles: {
      1: {
        state: { local: true },
        originalLaunchOptions: "",
        disableAutoManageLaunchOptions: true,
        overrideCommand: "game",
      },
      2: { state: {}, originalLaunchOptions: "--other" },
    },
    launchOptions: [{ id: "local", name: "Option", on: "--flag" }],
    envVariableMerges: [],
  }
  const before = structuredClone(fixture.settings)
  const applying = applyManual()
  await waitForSave()
  fixture.release()
  await applying
  assert.deepEqual(fixture.settings.profiles[1], {
    ...before.profiles[1],
    originalLaunchOptions: "--original",
  })
  assert.deepEqual(fixture.settings.profiles[2], before.profiles[2])
  assert.equal(fixture.settings.launchOptions[0].on, "--flag")
  await restoreAppLaunchOptions(
    1,
    fixture.client.getQueryData(["settings"]).profiles[1],
    info,
  )
  assert.equal(fixture.live, "--original")
})

test("a failed shortcut read neither saves a profile nor changes Steam", async () => {
  fixture.nonSteam = true
  fixture.shortcutRead = null
  fixture.live = "--moondeck"
  await actions
    .useApplyLaunchOptionsMutation()
    .mutateAsync({ appid: 1, command: info.COMMAND })
  assert.equal(fixture.saves, 0)
  assert.deepEqual(fixture.writes, [])
  assert.equal(fixture.live, "--moondeck")
})

test("a missing launcher leaves unwrapped arguments intact", async () => {
  fixture.live = "--original"
  fixture.hasScript = false
  const applying = actions
    .useApplyLaunchOptionsMutation()
    .mutateAsync({ appid: 1, command: info.COMMAND })
  await waitForSave()
  fixture.release()
  await applying
  assert.equal(fixture.live, "--original")
})
