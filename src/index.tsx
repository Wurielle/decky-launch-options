import {
    ButtonItem,
    DialogBody,
    DialogButton,
    DialogButtonPrimary,
    DialogFooter, DialogHeader, Field,
    ModalRoot, Navigation, PanelSection, PanelSectionRow, showModal, staticClasses, TextField,
    ToggleField
} from "@decky/ui"
import {definePlugin, routerHook} from "@decky/api"
import {FaTerminal, FaChevronDown, FaChevronUp} from "react-icons/fa"
import {LaunchOption, launchOptionFactory, routes} from './shared'
import {LaunchOptionsPage} from './teams/launch-options/views'
import {AppLaunchOptionsPage} from './teams/launch-options/views/[_appid]'
import {QueryClientProvider} from '@tanstack/react-query'
import contextMenuPatch, {LibraryContextMenu} from './patches/context-menu'
import {getSettingsQueryOptions, queryClient} from './query'
import {libraryAppPatch} from './patches/library-app'
import {useImmer} from "use-immer";
import {useSettings} from "./hooks";
import {useState} from "react";

function BatchAddLaunchOptions({data, onSubmit, onCancel}: {
    data: Partial<LaunchOption>[],
    onSubmit: () => void,
    onCancel: () => void
}) {
    const [launchOptions, setLaunchOptions] = useImmer(data.map(launchOptionFactory))
    const {batchCreateLaunchOptions} = useSettings()
    return (
        <ModalRoot onCancel={onCancel}>
            <DialogHeader>Decky Launch Options</DialogHeader>
            <DialogBody>
                <p>An application would like to add the following launch options:</p>
                {launchOptions.map((launchOption, index) => (
                    <Field label={launchOption.name} description={
                        <div style={{padding: '0 0 0 22'}}>
                            <div style={{marginBottom: 22}}>
                                <ToggleField
                                    label={'Enable globally'}
                                    bottomSeparator={'none'}
                                    checked={launchOption.enableGlobally}
                                    onChange={(value) => {
                                        setLaunchOptions((draft) => {
                                            draft[index].enableGlobally = value
                                        })
                                    }}
                                />
                            </div>
                            <TextField
                                label={'On'}
                                disabled={true}
                                value={launchOption.on}
                            />
                            <TextField
                                label={'Off'}
                                disabled={true}
                                value={launchOption.off}
                            />
                        </div>
                    }/>
                ))}
            </DialogBody>
            <DialogFooter>
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <DialogButton onClick={onCancel}>Cancel</DialogButton>
                    <DialogButtonPrimary onClick={() => {
                        batchCreateLaunchOptions(launchOptions)
                        onSubmit()
                    }}>Confirm</DialogButtonPrimary>
                </div>
            </DialogFooter>
        </ModalRoot>
    )
}

function batchCreateLaunchOptions(launchOptions: Partial<LaunchOption>[]) {
    const modalResult = showModal(
        <QueryClientProvider client={queryClient}>
            <BatchAddLaunchOptions
                data={launchOptions}
                onSubmit={() => modalResult.Close()}
                onCancel={() => modalResult.Close()}
            />
        </QueryClientProvider>
    )

}

function onBatchCreateLaunchOptions(event: CustomEvent<Partial<LaunchOption>[]>) {
    batchCreateLaunchOptions(event.detail);
}

const batchCreateLaunchOptionsEventType = 'dlo-add-launch-options'

function Content() {
    const [showMore, setShowMore] = useState(false)
    return (
        <PanelSection>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={() => {
                        Navigation.Navigate(routes.launchOptions())
                        Navigation.CloseSideMenus()
                    }}
                >
                    Manage launch options
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    icon={showMore ? <FaChevronUp /> : <FaChevronDown/> }
                    layout="below"
                    onClick={() => {
                        setShowMore((value) => !value)
                    }}
                />
                {
                    showMore && (
                        <ButtonItem
                            layout="below"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent(batchCreateLaunchOptionsEventType, {
                                    detail: [
                                        {
                                            id: 'portal-args',
                                            name: 'Portal args',
                                            on: '-novid +cl_showfps 3',
                                            off: '',
                                            enableGlobally: false,
                                        },
                                        {
                                            id: 'mangohud-command',
                                            name: 'MangoHud command',
                                            on: 'mangohud %command%',
                                            off: '',
                                            enableGlobally: false,
                                        },
                                        {
                                            id: 'steam-deck-env',
                                            name: 'Steam Deck env',
                                            on: 'SteamDeck=1',
                                            off: 'SteamDeck=0',
                                            enableGlobally: true,
                                        },
                                    ]
                                }));
                            }}
                        >
                            Debug
                        </ButtonItem>
                    )
                }
            </PanelSectionRow>
        </PanelSection>
    )
}

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

    window.addEventListener(batchCreateLaunchOptionsEventType as any, onBatchCreateLaunchOptions);
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
        },
    }
})
