import { staticClasses } from "@decky/ui"
import { definePlugin, routerHook } from "@decky/api"
import { FaTerminal } from "react-icons/fa"
import {
  batchCreateLaunchOptionsEventType,
  LaunchOption,
  routes,
} from "./shared"
import { LaunchOptionsPage } from "./teams/launch-options/views"
import { AppLaunchOptionsPage } from "./teams/launch-options/views/[_appid]"
import { EnvVariableMergesPage } from "./teams/env-variable-merges/views"
import { QueryClientProvider } from "@tanstack/react-query"
import contextMenuPatch, { LibraryContextMenu } from "./patches/context-menu"
import {
  getInfoQueryOptions,
  getSettingsQueryOptions,
  queryClient,
} from "./query"
import { libraryAppPatch } from "./patches/library-app"
import { Content } from "./components/content"
import { batchCreateLaunchOptions } from "./components/batch-add-launch-options"
import {
  applyProfileLaunchOptions,
  launchOptionsLifecycle,
  restoreAppLaunchOptions,
} from "./utils"
import { has_shell_script } from "./api"
import { settingsStore } from "./stores"

export default definePlugin(() => {
  routerHook.addRoute(routes.appLaunchOptions(), () => {
    return (
      <QueryClientProvider client={queryClient}>
        <AppLaunchOptionsPage />
      </QueryClientProvider>
    )
  })
  routerHook.addRoute(routes.launchOptionsManagerItem(), () => {
    return (
      <QueryClientProvider client={queryClient}>
        <LaunchOptionsPage />
      </QueryClientProvider>
    )
  })
  routerHook.addRoute(routes.envVariableMergesManagerItem(), () => {
    return (
      <QueryClientProvider client={queryClient}>
        <EnvVariableMergesPage />
      </QueryClientProvider>
    )
  })
  // shamefully stolen from the talented people at SteamGridDB
  const menuPatches = contextMenuPatch(LibraryContextMenu)
  const libraryAppPatchResult = libraryAppPatch()
  const previousRestoration = window.dloLaunchOptionsRestored
  let startupWrites: Promise<unknown> = Promise.resolve()
  void Promise.all([
    previousRestoration,
    queryClient.fetchQuery(getSettingsQueryOptions),
    queryClient.fetchQuery(getInfoQueryOptions),
    has_shell_script(),
  ])
    .then(([, settings, info, hasShellScript]) => {
      if (!launchOptionsLifecycle.active || !settings || !hasShellScript) return
      startupWrites = Promise.allSettled(
        Object.entries(settings.profiles).map(([appid, profile]) =>
          applyProfileLaunchOptions(Number(appid), profile, info, {
            steam: settingsStore.state.autoManageLaunchOptions,
            nonSteam: settingsStore.state.autoManageNonSteamLaunchOptions,
          }),
        ),
      )
      return startupWrites
    })
    .catch((error) => console.error("DLO startup recovery failed", error))

  function onBatchCreateLaunchOptions(
    event: CustomEvent<Partial<LaunchOption>[]>,
  ) {
    batchCreateLaunchOptions(event.detail)
  }

  window.addEventListener(
    batchCreateLaunchOptionsEventType as any,
    onBatchCreateLaunchOptions,
  )
  ;(window as any).hasDeckyLaunchOptions = true
  return {
    name: "Launch Options",
    titleView: <div className={staticClasses.Title}>Launch Options</div>,
    content: (
      <QueryClientProvider client={queryClient}>
        <Content />
      </QueryClientProvider>
    ),
    icon: <FaTerminal />,
    onDismount() {
      launchOptionsLifecycle.active = false
      Object.values(routes).forEach((route) => {
        routerHook.removeRoute(route())
      })
      menuPatches?.unpatch()
      routerHook.removePatch(...libraryAppPatchResult)
      const settings = queryClient.getQueryData(
        getSettingsQueryOptions.queryKey,
      )
      const info = queryClient.getQueryData(getInfoQueryOptions.queryKey)
      // Decky does not await onDismount. The next instance waits for these
      // callbacks so an old restoration cannot overwrite startup recovery.
      window.dloLaunchOptionsRestored = Promise.all([
        previousRestoration,
        startupWrites,
      ]).then(() =>
        Promise.allSettled(
          Object.entries(settings?.profiles ?? {}).map(([appid, profile]) =>
            restoreAppLaunchOptions(Number(appid), profile, info),
          ),
        ),
      )
      window.removeEventListener(
        batchCreateLaunchOptionsEventType as any,
        onBatchCreateLaunchOptions,
      )
      delete (window as any).hasDeckyLaunchOptions
    },
  }
})
