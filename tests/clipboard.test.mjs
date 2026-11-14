import assert from "node:assert/strict"
import { test } from "node:test"
import { readClipboardText } from "../src/utils/clipboard.ts"

function fixture(t, fail = false) {
  const previous = globalThis.SteamClient
  t.after(() => {
    if (previous === undefined) delete globalThis.SteamClient
    else globalThis.SteamClient = previous
  })
  let textarea,
    removed = false,
    restored = false
  const keys = []
  const focus = {
    focus() {
      restored = true
      doc.activeElement = focus
    },
  }
  const doc = {
    activeElement: focus,
    defaultView: {
      SteamClient: {
        Browser: {
          Paste() {
            throw new Error("Wrong clipboard")
          },
        },
      },
    },
    createElement() {
      textarea = new EventTarget()
      Object.assign(textarea, {
        style: {},
        value: "",
        focus() {
          doc.activeElement = textarea
        },
        remove() {
          removed = true
        },
      })
      return textarea
    },
  }
  globalThis.SteamClient = {
    Input: {
      ControllerKeyboardSetKeyState(key, pressed) {
        keys.push([key, pressed])
        if (key === 25 && pressed) {
          if (fail) throw new Error("Paste failed")
          textarea.value = "https://example.test/store.json"
          textarea.dispatchEvent(new Event("input"))
        }
      },
    },
  }
  return {
    container: { ownerDocument: doc, appendChild() {} },
    keys,
    check() {
      assert.ok(removed)
      assert.ok(restored)
    },
  }
}

test("Steam system paste uses the dialog document, updates the text and releases both keys", async (t) => {
  const f = fixture(t)
  assert.equal(
    await readClipboardText(f.container),
    "https://example.test/store.json",
  )
  assert.deepEqual(f.keys, [
    [103, true],
    [25, true],
    [25, false],
    [103, false],
  ])
  f.check()
})

test("failed Steam paste releases both keys and restores focus", async (t) => {
  const f = fixture(t, true)
  await assert.rejects(readClipboardText(f.container), /Paste failed/)
  assert.deepEqual(f.keys, [
    [103, true],
    [25, true],
    [25, false],
    [103, false],
  ])
  f.check()
})
