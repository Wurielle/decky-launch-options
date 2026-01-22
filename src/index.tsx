import {
    ButtonItem,
    ConfirmModal,
    Navigation,
    PanelSection,
    PanelSectionRow,
    showModal,
    staticClasses,
} from "@decky/ui"
import { callable, definePlugin, routerHook } from "@decky/api"
import { FaTerminal } from "react-icons/fa"
import { routes } from './shared'
import { LaunchOptionsPage } from './teams/launch-options/views'
import { AppLaunchOptionsPage } from './teams/launch-options/views/[_appid]'
import { QueryClientProvider } from '@tanstack/react-query'
import contextMenuPatch, { LibraryContextMenu } from './patches/context-menu'
import { queryClient } from './query'

const applyLaunchOptions = callable<[], void>("apply_launch_options")
const restartSteam = callable<[], void>("restart_steam")
const printDebugLogs = callable<[], void>("debug_logs")
const startWatcher = callable<[], void>("start_watcher")
const stopWatcher = callable<[], void>("stop_watcher")

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
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => showModal(
                        <ConfirmModal
                            strTitle={ `Apply launch options` }
                            strDescription={
                                `Do you want to apply launch options to all apps? This will force Steam to restart.`
                            }
                            strOKButtonText="Confirm"
                            strCancelButtonText="Cancel"
                            onOK={ () => {
                                return applyLaunchOptions()
                            } }
                        />,
                    ) }
                >
                    { 'Apply Launch Options' }
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => restartSteam() }
                >
                    { 'Restart Steam' }
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => printDebugLogs() }
                >
                    Print debug logs
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => startWatcher() }
                >
                    Start watcher
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => stopWatcher() }
                >
                    Stop watcher
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
    return {
        name: "Launch Options",
        titleView: <div className={ staticClasses.Title }>Launch Options</div>,
        content: <Content/>,
        icon: <FaTerminal/>,
        onDismount() {
            Object.values(routes).forEach((route) => {
                console.log(route())
                routerHook.removeRoute(route())
            })
            menuPatches?.unpatch()
        },
    }
})
