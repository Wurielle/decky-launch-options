import assert from "node:assert/strict"
import { test } from "node:test"
import { produce } from "immer"
import { sourceModule } from "./source-module.mjs"

const utils = await sourceModule("src/utils/settings.ts")
const { createProfileActions } = await import(
  await sourceModule("src/settings/profile-actions.ts", { "../utils": utils })
)
const { getLaunchOptionState } = await import(utils)
const { launchOptionFactory, profileFactory } = await import("../src/shared.ts")

test("resetting an app restores inherited selections without changing its settings or another app", () => {
  const settings = {
    launchOptions: [
      launchOptionFactory({ id: "local" }),
      launchOptionFactory({ id: "global", enableGlobally: true }),
      launchOptionFactory({
        id: "default",
        valueId: "quality",
        enableGlobally: true,
      }),
      launchOptionFactory({ id: "custom", valueId: "quality" }),
      launchOptionFactory({
        id: "fallback",
        valueId: "renderer",
        fallbackValue: true,
      }),
    ],
    profiles: {
      42: profileFactory({
        state: { local: true, global: false, custom: true, fallback: false },
        originalLaunchOptions: "original %command%",
        overrideCommand: "custom %command%",
        overrideCommandEnabled: true,
        disableAutoManageLaunchOptions: true,
      }),
      43: profileFactory({ state: { local: true, global: false } }),
    },
    environmentVariableMerges: [],
  }
  let saved
  createProfileActions(settings, (update) => {
    saved = produce(settings, update)
  }).resetAppLaunchOptionSelection("42")

  assert.deepEqual(saved.profiles["42"].state, {})
  for (const [id, active] of Object.entries({
    local: false,
    global: true,
    default: true,
    custom: false,
    fallback: true,
  }))
    assert.equal(getLaunchOptionState(saved, "42", id), active, id)
  assert.deepEqual(saved.profiles["42"], {
    ...settings.profiles["42"],
    state: {},
  })
  assert.equal(saved.profiles["43"], settings.profiles["43"])
  assert.equal(saved.launchOptions, settings.launchOptions)
  assert.equal(
    saved.environmentVariableMerges,
    settings.environmentVariableMerges,
  )
  assert.equal(getLaunchOptionState(settings, "42", "local"), true)

  createProfileActions(saved, (update) => {
    saved = produce(saved, update)
  }).resetAppLaunchOptionSelection("unknown")
  assert.equal(saved.profiles.unknown, undefined)
})
