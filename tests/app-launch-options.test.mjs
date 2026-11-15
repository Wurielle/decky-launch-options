import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
  applyProfileLaunchOptions,
  launchOptionsLifecycle,
  restoreAppLaunchOptions,
} from "../src/utils/app-launch-options.ts"

const info = {
  COMMAND: "~/.dlo/run %command%",
  SHORT_SH_COMMAND_PATH: "~/.dlo/run",
  FULL_SH_COMMAND_PATH: "/home/deck/.dlo/run",
}
const autoManage = { steam: true, nonSteam: true }
const profile = (originalLaunchOptions = "") => ({
  state: {},
  originalLaunchOptions,
})
let apps, writes, registrations, listeners

beforeEach(() => {
  apps = new Map()
  writes = []
  registrations = 0
  listeners = new Map()
  launchOptionsLifecycle.active = true
  globalThis.window = new EventTarget()
  globalThis.SteamClient = {
    Apps: {
      RegisterForAppDetails(appid, callback) {
        registrations++
        if (!listeners.has(appid)) listeners.set(appid, new Set())
        listeners.get(appid).add(callback)
        let registered = true
        queueMicrotask(() => {
          if (registered) callback({ ...apps.get(appid) })
        })
        return {
          unregister() {
            registered = false
            registrations--
            listeners.get(appid).delete(callback)
          },
        }
      },
      SetAppLaunchOptions(appid, value) {
        writes.push({ appid, value })
        const app = apps.get(appid)
        if (typeof app.strShortcutExe !== "undefined")
          app.strShortcutLaunchOptions = value
        else app.strLaunchOptions = value
        queueMicrotask(() => {
          for (const callback of listeners.get(appid) ?? [])
            callback({ ...app })
        })
      },
    },
  }
})

test("reload restores and reapplies an open and a closed Steam game without a page visit", async () => {
  for (const appid of [1, 2])
    apps.set(appid, { strLaunchOptions: info.COMMAND })
  await Promise.all([
    restoreAppLaunchOptions(1, profile("original"), info),
    restoreAppLaunchOptions(2, profile(), info),
  ])
  assert.equal(apps.get(1).strLaunchOptions, "original")
  assert.equal(apps.get(2).strLaunchOptions, "")
  await Promise.all([
    applyProfileLaunchOptions(1, profile("original"), info, autoManage),
    applyProfileLaunchOptions(2, profile(), info, autoManage),
  ])
  assert.equal(apps.get(1).strLaunchOptions, info.COMMAND)
  assert.equal(apps.get(2).strLaunchOptions, info.COMMAND)
  assert.equal(registrations, 0)
})

test("manual shortcut Apply is restored even with auto-management disabled", async () => {
  apps.set(1, {
    strShortcutExe: "/bin/game",
    strShortcutLaunchOptions: info.COMMAND,
    strLaunchOptions: "",
  })
  await restoreAppLaunchOptions(1, profile("--original"), info)
  assert.equal(apps.get(1).strShortcutLaunchOptions, "--original")
  await applyProfileLaunchOptions(1, profile("--original"), info, {
    steam: false,
    nonSteam: false,
  })
  assert.equal(apps.get(1).strShortcutLaunchOptions, "--original")
  assert.equal(writes.length, 1)
})

test("an eligible shortcut that was never taken over keeps its arguments", async () => {
  apps.set(1, {
    strShortcutExe: "/bin/game",
    strShortcutLaunchOptions: "--moondeck",
    strLaunchOptions: "",
  })
  await restoreAppLaunchOptions(1, profile(), info)
  await applyProfileLaunchOptions(1, profile(), info, autoManage)
  assert.equal(apps.get(1).strShortcutLaunchOptions, "--moondeck")
  assert.deepEqual(writes, [])
})

test("missing command metadata never authorizes restoration", async () => {
  apps.set(1, { strLaunchOptions: "--external" })
  await restoreAppLaunchOptions(1, profile())
  assert.deepEqual(writes, [])
  assert.equal(registrations, 0)
})

test("Revert and external edits survive unload and startup", async () => {
  for (const [appid, current] of [
    [1, "--reverted"],
    [2, "--edited"],
  ]) {
    apps.set(appid, { strLaunchOptions: current })
    const saved = appid === 1 ? profile() : profile("--old")
    await restoreAppLaunchOptions(appid, saved, info)
    await applyProfileLaunchOptions(appid, saved, info, autoManage)
    assert.equal(apps.get(appid).strLaunchOptions, current)
  }
  assert.deepEqual(writes, [])
})

test("startup respects Steam, shortcut and per-app auto-management opt-outs", async () => {
  apps.set(1, { strLaunchOptions: "" })
  apps.set(2, { strShortcutExe: "/bin/game", strShortcutLaunchOptions: "" })
  await applyProfileLaunchOptions(1, profile(), info, {
    steam: false,
    nonSteam: true,
  })
  await applyProfileLaunchOptions(2, profile(), info, {
    steam: true,
    nonSteam: false,
  })
  await applyProfileLaunchOptions(
    1,
    { ...profile(), disableAutoManageLaunchOptions: true },
    info,
    autoManage,
  )
  assert.deepEqual(writes, [])
})

test("missing shortcut details are not treated as an empty launch-options field", async () => {
  apps.set(1, { strShortcutExe: "/bin/game", strLaunchOptions: info.COMMAND })
  await restoreAppLaunchOptions(1, profile("--saved"), info)
  await applyProfileLaunchOptions(1, profile(), info, autoManage)
  assert.deepEqual(writes, [])
})

test("startup callbacks stop writing once the plugin dismounts", async () => {
  apps.set(1, { strLaunchOptions: "" })
  const applying = applyProfileLaunchOptions(1, profile(), info, autoManage)
  launchOptionsLifecycle.active = false
  await applying
  assert.deepEqual(writes, [])
})

test("synchronous cached details are handled and unsubscribed", async () => {
  let unsubscribed = false
  apps.set(1, { strLaunchOptions: info.COMMAND })
  SteamClient.Apps.RegisterForAppDetails = (_appid, callback) => {
    listeners.set(1, new Set([callback]))
    callback(apps.get(1))
    return {
      unregister() {
        unsubscribed = true
      },
    }
  }
  await restoreAppLaunchOptions(1, profile(), info)
  assert.equal(apps.get(1).strLaunchOptions, "")
  assert.equal(unsubscribed, true)
})

test("restoration waits for Steam to acknowledge its asynchronous write", async () => {
  apps.set(1, { strLaunchOptions: info.COMMAND })
  let acknowledge
  SteamClient.Apps.SetAppLaunchOptions = (_appid, value) => {
    acknowledge = () => {
      apps.get(1).strLaunchOptions = value
      for (const callback of listeners.get(1)) callback({ ...apps.get(1) })
    }
  }
  let finished = false
  const restoring = restoreAppLaunchOptions(1, profile(), info).then(() => {
    finished = true
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(finished, false)
  acknowledge()
  await restoring
  assert.equal(apps.get(1).strLaunchOptions, "")
  assert.equal(registrations, 0)
})

test("a delayed callback after timeout cannot overwrite a later value", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let callback,
    unsubscribed = false
  SteamClient.Apps.RegisterForAppDetails = (_appid, cb) => {
    callback = cb
    return {
      unregister() {
        unsubscribed = true
      },
    }
  }
  const restoring = restoreAppLaunchOptions(1, profile(), info)
  t.mock.timers.tick(5000)
  await restoring
  callback({ strLaunchOptions: info.COMMAND })
  assert.deepEqual(writes, [])
  assert.equal(unsubscribed, true)
})
