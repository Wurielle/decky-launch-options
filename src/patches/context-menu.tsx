import * as DeckyUI from "@decky/ui"
import {
  afterPatch,
  fakeRenderComponent,
  findModuleByExport,
  findModuleExport,
  MenuItem,
  Navigation,
} from "@decky/ui"
import { routes } from "../shared"
import { ApplyLaunchOptions } from "../components/apply-launch-options"

const isLibraryContextMenu = (value: any) =>
  typeof value?.prototype?.GetTargetApps === "function" &&
  typeof value?.prototype?.GetPrimaryActionMenuItem === "function" &&
  typeof value?.prototype?.BuildManageSubmenu === "function"

export const findLibraryContextMenu = () => {
  // Steam's ES-module client keeps this class in module scope rather than
  // exporting it. Older Decky versions only expose the webpack export helpers.
  const { findVar } = DeckyUI as typeof DeckyUI & {
    findVar?: (filter: (value: any) => boolean) => any
  }
  const menu =
    findVar?.(isLibraryContextMenu) || findModuleExport(isLibraryContextMenu)
  if (menu) return menu

  // On webpack clients the exported function wraps the unexported menu class.
  const module = findModuleByExport(
    (value: any) =>
      typeof value === "function" &&
      value.toString().includes("().LibraryContextMenu"),
  )
  const wrapper = Object.values(module ?? {}).find(
    (value: any) =>
      typeof value === "function" && value.toString().includes("navigator:"),
  )
  if (typeof wrapper !== "function") return undefined
  const type = fakeRenderComponent(wrapper)?.type
  return isLibraryContextMenu(type) ? type : undefined
}

export default function contextMenuPatch() {
  try {
    const menu = findLibraryContextMenu()
    if (!menu) throw new Error("Steam's app context menu was not found")

    // This method runs on every render, including MobX updates. Its result is
    // a top-level sibling of Properties, so no shared Menu renderer is patched.
    return afterPatch(
      menu.prototype,
      "BuildManageSubmenu",
      function (this: any, [apps]: any[], submenu: any) {
        if (!Array.isArray(apps) || apps.length !== 1) return submenu
        const appid = apps[0]?.appid
        if (!Number.isSafeInteger(appid) || appid <= 0) return submenu
        return (
          <>
            {submenu}
            <ApplyLaunchOptions key="decky-launch-options" appid={appid}>
              <MenuItem
                onSelected={() => {
                  Navigation.Navigate(routes.appLaunchOptions(appid))
                }}
              >
                {"Launch Options"}
              </MenuItem>
            </ApplyLaunchOptions>
          </>
        )
      },
    )
  } catch (error) {
    // A Steam update should disable this integration, not the entire plugin.
    console.warn("DLO could not patch the app context menu", error)
    return { unpatch() {} }
  }
}
