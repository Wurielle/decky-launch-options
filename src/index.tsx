import {staticClasses,} from "@decky/ui"
import {definePlugin, routerHook} from "@decky/api"
import {FaTerminal} from "react-icons/fa"
import {batchCreateLaunchOptionsEventType, LaunchOption, routes} from './shared'
import {LaunchOptionsPage} from './teams/launch-options/views'
import {AppLaunchOptionsPage} from './teams/launch-options/views/[_appid]'
import {QueryClientProvider} from '@tanstack/react-query'
import contextMenuPatch, {LibraryContextMenu} from './patches/context-menu'
import {getSettingsQueryOptions, queryClient} from './query'
import {libraryAppPatch} from './patches/library-app'
import {Content} from "./components/content";
import {batchCreateLaunchOptions} from "./components/batch-add-launch-options";
import {settingsLocalStorageKey} from "./stores";

export default definePlugin(() => {
    routerHook.addRoute(routes.appLaunchOptions(), () => {
        return (
            <QueryClientProvider client={queryClient}>
                <AppLaunchOptionsPage/>
            </QueryClientProvider>
        )
    })
    routerHook.addRoute(routes.launchOptions(), () => {
        return (
            <QueryClientProvider client={queryClient}>
                <LaunchOptionsPage/>
            </QueryClientProvider>
        )
    })
    // shamefully stolen from the talented people at SteamGridDB
    const menuPatches = contextMenuPatch(LibraryContextMenu)
    const libraryAppPatchResult = libraryAppPatch()
    void queryClient.prefetchQuery(getSettingsQueryOptions)

    function onBatchCreateLaunchOptions(event: CustomEvent<Partial<LaunchOption>[]>) {
        batchCreateLaunchOptions(event.detail);
    }

    window.addEventListener(batchCreateLaunchOptionsEventType as any, onBatchCreateLaunchOptions);
    (window as any).hasDeckyLaunchOptions = true
    return {
        name: "Launch Options",
        titleView: <div className={staticClasses.Title}>Launch Options</div>,
        content: <Content/>,
        icon: <FaTerminal/>,
        onDismount() {
            Object.values(routes).forEach((route) => {
                routerHook.removeRoute(route())
            })
            menuPatches?.unpatch()
            routerHook.removePatch(...libraryAppPatchResult)
            const settings = queryClient.getQueryData(getSettingsQueryOptions.queryKey)
            if (settings) {
                Object.entries(settings.profiles)
                    .forEach(([appid, profile]) => {
                        SteamClient.Apps.SetAppLaunchOptions(Number(appid), profile.originalLaunchOptions)
                    })
            }
            window.removeEventListener(batchCreateLaunchOptionsEventType as any, onBatchCreateLaunchOptions);
            localStorage.removeItem(settingsLocalStorageKey)
            delete (window as any).hasDeckyLaunchOptions
        },
    }
})
