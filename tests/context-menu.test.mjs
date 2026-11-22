import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const dataURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const jsx = dataURL(`
  export const Fragment='Fragment';
  export const jsx=(type,props,key)=>({type,props,key});
  export const jsxs=jsx;
`)
const shared = dataURL(`
  export const routes={appLaunchOptions:appid=>'/dlo/'+appid};
`)
const apply = dataURL(`export const ApplyLaunchOptions='ApplyLaunchOptions';`)
const patcher = new URL(
  "../node_modules/@decky/ui/dist/utils/patcher.js",
  import.meta.url,
).href
async function loadPatch(withScopes) {
  const ui = dataURL(`
    export {afterPatch} from ${JSON.stringify(patcher)};
    export const MenuItem='MenuItem';
    export const Navigation={Navigate:appid=>globalThis.__dloMenuFixture.navigations.push(appid)};
    export const findModuleExport=filter=>globalThis.__dloMenuFixture.exports.find(filter);
    export const findModuleByExport=filter=>globalThis.__dloMenuFixture.modules.find(m=>Object.values(m).some(filter));
    export const fakeRenderComponent=fn=>fn();
    ${withScopes ? "export const findVar=filter=>globalThis.__dloMenuFixture.scopes.find(filter);" : ""}
  `)
  let source = ts.transpileModule(
    await readFile("src/patches/context-menu.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText
  for (const [from, to] of Object.entries({
    "@decky/ui": ui,
    "react/jsx-runtime": jsx,
    "../shared": shared,
    "../components/apply-launch-options": apply,
  }))
    source = source.replaceAll(JSON.stringify(from), JSON.stringify(to))
  return import(dataURL(source))
}
const modern = await loadPatch(true)
const legacy = await loadPatch(false)
let fixture
let Menu
beforeEach(() => {
  fixture = globalThis.__dloMenuFixture = {
    exports: [],
    scopes: [],
    modules: [],
    navigations: [],
  }
  Menu = class {
    GetTargetApps() {}
    GetPrimaryActionMenuItem() {}
    BuildManageSubmenu() {
      return this.submenu
    }
  }
})

function withWarnings(run) {
  const warn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    run(warnings)
  } finally {
    console.warn = warn
  }
}

const allItems = (node) =>
  !node || typeof node !== "object"
    ? []
    : Array.isArray(node)
      ? node.flatMap(allItems)
      : [node, ...allItems(node.props?.children)]
const dloItems = (node) =>
  allItems(node).filter((item) => item.key === "decky-launch-options")

test("discovers the unexported ES-module menu class", () => {
  fixture.scopes.push(Menu)
  assert.equal(modern.findLibraryContextMenu(), Menu)
})

test("discovers exported classes without Steam CSS or source signatures", () => {
  fixture.exports.push(Menu)
  assert.equal(legacy.findLibraryContextMenu(), Menu)
})

test("retains webpack wrapper discovery when scope helpers are unavailable", () => {
  function css() {}
  css.toString = () => "().LibraryContextMenu"
  function wrapper() {
    return { type: Menu }
  }
  wrapper.toString = () => "navigator:"
  fixture.modules.push({ css, wrapper })
  assert.equal(legacy.findLibraryContextMenu(), Menu)
})

test("missing discovery disables only the menu patch", () => {
  assert.equal(legacy.findLibraryContextMenu(), undefined)
  withWarnings((warnings) => {
    const patch = legacy.default()
    patch.unpatch()
    assert.equal(warnings.length, 1)
  })
})

test("discovery exceptions do not prevent plugin startup", () => {
  Object.defineProperty(fixture, "scopes", {
    get() {
      throw new Error("Steam module discovery failed")
    },
  })
  withWarnings((warnings) => {
    modern.default().unpatch()
    assert.equal(warnings.length, 1)
  })
})

test("inserts one top-level item and uses the current app on every render", () => {
  fixture.scopes.push(Menu)
  const patch = modern.default()
  const menu = new Menu()
  menu.submenu = {
    type: "SubMenu",
    props: { children: { type: "ManageAction" } },
  }
  for (const appid of [1903340, 620, 4294967295]) {
    const result = menu.BuildManageSubmenu([{ appid }])
    assert.equal(result.props.children[0], menu.submenu)
    const [item] = dloItems(result)
    assert.equal(dloItems(result).length, 1)
    assert.equal(item.props.appid, appid)
    assert.equal(item.props.children.props.children, "Launch Options")
    item.props.children.props.onSelected()
    assert.equal(fixture.navigations.at(-1), `/dlo/${appid}`)
  }
  assert.equal(dloItems(menu.submenu).length, 0)
  patch.unpatch()
})

test("leaves multiple selections and invalid app IDs unchanged", () => {
  fixture.scopes.push(Menu)
  const patch = modern.default()
  const menu = new Menu()
  menu.submenu = { type: "SubMenu" }
  for (const apps of [
    undefined,
    [],
    [{ appid: 620 }, { appid: 1903340 }],
    [{}],
    [{ appid: 0 }],
    [{ appid: -1 }],
    [{ appid: "620" }],
  ])
    assert.equal(menu.BuildManageSubmenu(apps), menu.submenu)
  patch.unpatch()
})

test("unload restores Steam and reload does not duplicate the item", () => {
  fixture.scopes.push(Menu)
  const original = Menu.prototype.BuildManageSubmenu
  const menu = new Menu()
  menu.submenu = { type: "SubMenu" }
  for (let reload = 0; reload < 2; reload++) {
    const patch = modern.default()
    assert.equal(dloItems(menu.BuildManageSubmenu([{ appid: 620 }])).length, 1)
    patch.unpatch()
    assert.equal(Menu.prototype.BuildManageSubmenu, original)
    assert.equal(menu.BuildManageSubmenu([{ appid: 620 }]), menu.submenu)
  }
})
