import assert from "node:assert/strict"
import { test } from "node:test"
import { dataURL, sourceModule } from "./source-module.mjs"

const jsx = dataURL(
  `export const Fragment='Fragment'; export const jsx=(type,props,key)=>({type,props,key}); export const jsxs=jsx;`,
)
const react = dataURL(
  `export const useState=init=>[typeof init==='function'?init():init,()=>{}]; export const useRef=()=>({current:null});`,
)
const ui = dataURL(
  `export const ConfirmModal='ConfirmModal', DialogBody='DialogBody', DialogButton='DialogButton', DialogButtonPrimary='DialogButtonPrimary', DialogFooter='DialogFooter', DialogHeader='DialogHeader', Focusable='Focusable', ModalRoot='ModalRoot'; export function showModal(element){const modal={element,closed:false,Close(){this.closed=true}}; globalThis.__presetReview.modals.push(modal); return modal;}`,
)
const dialog = await import(
  await sourceModule("src/components/batch-add-launch-options.tsx", {
    react,
    "react/jsx-runtime": jsx,
    "@decky/ui": ui,
    "../hooks": dataURL(
      `export const useSettings=()=>globalThis.__presetReview.actions;`,
    ),
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
export function nodes(element) {
  if (Array.isArray(element)) return element.flatMap(nodes)
  if (!element || typeof element !== "object") return [element]
  if (typeof element.type === "function")
    return nodes(element.type(element.props))
  return [element, ...nodes(element.props.children)]
}
const button = (tree, label) =>
  tree.find((node) => node?.props?.children === label)

test("preset recovery displays the existing recipe review and waits for its persisted import", async () => {
  let release
  let writes = 0
  globalThis.__presetReview = {
    modals: [],
    actions: {
      loading: false,
      batchCreateLaunchOptions: () => {
        throw new Error("Preset import must use awaited save")
      },
    },
  }
  const operation = dialog.importRecipe(
    {
      name: "Renderer",
      launchOptions: [{ id: "install", on: "setup && %command%" }],
    },
    {
      save: () => {
        writes++
        return new Promise((resolve) => {
          release = resolve
        })
      },
    },
  )
  let outcome = "pending"
  Promise.resolve(operation).then((value) => {
    outcome = value
  })
  const tree = nodes(globalThis.__presetReview.modals[0].element)
  assert.ok(tree.includes("setup && %command%"))
  assert.equal(writes, 0)
  button(tree, "Add to Decky Launch Options").props.onClick()
  assert.equal(writes, 1)
  await Promise.resolve()
  assert.equal(outcome, "pending")
  assert.equal(globalThis.__presetReview.modals[0].closed, false)
  release()
  assert.equal(await operation, true)
  assert.equal(globalThis.__presetReview.modals[0].closed, true)
})

test("aborting preset review closes shortcut confirmations and captured stale callbacks cannot save", async () => {
  let writes = 0
  globalThis.__presetReview = {
    modals: [],
    actions: {
      loading: false,
      batchCreateLaunchOptions: () => {
        writes++
      },
    },
  }
  const controller = new AbortController()
  const operation = dialog.importRecipe(
    {
      name: "Recipe",
      launchOptions: [{ id: "install", on: "setup && %command%" }],
    },
    {
      signal: controller.signal,
      save: async () => {
        writes++
      },
    },
  )
  const tree = nodes(globalThis.__presetReview.modals[0].element)
  const shortcut = button(tree, "Add all without review").props.onClick
  const reviewed = button(tree, "Add to Decky Launch Options").props.onClick
  const guardedSave =
    globalThis.__presetReview.modals[0].element.props.children.props.save
  shortcut()
  shortcut()
  const confirmations = globalThis.__presetReview.modals.slice(1)
  const staleOKs = confirmations.map((modal) => modal.element.props.onOK)
  controller.abort()
  assert.equal(await operation, false)
  assert.equal(globalThis.__presetReview.modals[0].closed, true)
  for (const confirmation of confirmations)
    assert.equal(
      confirmation.closed,
      true,
      "nested confirmation must close on abort",
    )
  for (const onOK of staleOKs) {
    onOK()
    onOK()
  }
  await guardedSave([], [])
  reviewed()
  shortcut()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 0, "no stale callback may reach the save boundary")
  assert.equal(
    globalThis.__presetReview.modals.length,
    3,
    "stale shortcut must not open another modal",
  )
})

test("cancelled shortcut callbacks stay inert and completed reviews save exactly once", async () => {
  let writes = 0,
    release
  globalThis.__presetReview = { modals: [], actions: { loading: false } }
  const operation = dialog.importRecipe(
    {
      name: "Recipe",
      launchOptions: [{ id: "install", on: "setup && %command%" }],
    },
    {
      save: () => {
        writes++
        return new Promise((resolve) => {
          release = resolve
        })
      },
    },
  )
  const tree = nodes(globalThis.__presetReview.modals[0].element)
  const shortcut = button(tree, "Add all without review").props.onClick
  shortcut()
  const cancelled = globalThis.__presetReview.modals[1].element.props
  cancelled.onCancel()
  cancelled.onOK()
  assert.equal(writes, 0)
  shortcut()
  const accepted = globalThis.__presetReview.modals[2].element.props
  accepted.onOK()
  accepted.onOK()
  button(tree, "Add to Decky Launch Options").props.onClick()
  assert.equal(writes, 1)
  release()
  assert.equal(await operation, true)
  accepted.onOK()
  button(tree, "Add to Decky Launch Options").props.onClick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 1)
})

test("base review cancellation closes nested confirmation and late acceptance cannot import", async () => {
  let writes = 0
  globalThis.__presetReview = { modals: [], actions: { loading: false } }
  const operation = dialog.importRecipe(
    { name: "Recipe", launchOptions: [{ id: "install" }] },
    {
      save: async () => {
        writes++
      },
    },
  )
  const tree = nodes(globalThis.__presetReview.modals[0].element)
  button(tree, "Add all without review").props.onClick()
  const nested = globalThis.__presetReview.modals[1]
  tree.find((node) => node?.type === "ModalRoot").props.onCancel()
  assert.equal(await operation, false)
  assert.equal(nested.closed, true)
  nested.element.props.onOK()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 0)
})
