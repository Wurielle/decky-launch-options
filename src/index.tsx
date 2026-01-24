import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui"
import { definePlugin, routerHook } from "@decky/api"
import { FaTerminal } from "react-icons/fa"
import { routes } from './shared'
import { LaunchOptionsPage } from './teams/launch-options/views'
import { AppLaunchOptionsPage } from './teams/launch-options/views/[_appid]'
import { QueryClientProvider } from '@tanstack/react-query'
import contextMenuPatch, { LibraryContextMenu } from './patches/context-menu'
import { queryClient } from './query'
import { libraryAppPatch } from './patches/library-app'

function Content() {
    return (
        <PanelSection title="Panel Section">
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => {
                        Navigation.Navigate(routes.launchOptions())
                        Navigation.CloseSideMenus()
                    } }
                >
                    Manage launch options
                </ButtonItem>
            </PanelSectionRow>
        </PanelSection>
    )
}

export default definePlugin(() => {
    routerHook.addRoute(routes.appLaunchOptions(), () => {
        return (
            <QueryClientProvider client={ queryClient }>
                <AppLaunchOptionsPage/>
            </QueryClientProvider>
        )
    })
    routerHook.addRoute(routes.launchOptions(), () => {
        return (
            <QueryClientProvider client={ queryClient }>
                <LaunchOptionsPage/>
            </QueryClientProvider>
        )
    })
    // shamefully stolen from the talented people at SteamGridDB
    const menuPatches = contextMenuPatch(LibraryContextMenu)
    const libraryAppPatchResult = libraryAppPatch()
    return {
        name: "Launch Options",
        titleView: <div className={ staticClasses.Title }>Launch Options</div>,
        content: <Content/>,
        icon: <FaTerminal/>,
        onDismount() {
            Object.values(routes).forEach((route) => {
                routerHook.removeRoute(route())
            })
            menuPatches?.unpatch()
            routerHook.removePatch(...libraryAppPatchResult)
        },
    }
})
