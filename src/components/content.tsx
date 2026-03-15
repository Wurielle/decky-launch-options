import { batchCreateLaunchOptionsEventType, routes } from "../shared"
import {
    ButtonItem,
    DialogBody,
    ModalRoot,
    Navigation,
    PanelSection,
    PanelSectionRow,
    ScrollPanel,
    showModal,
    ToggleField,
} from "@decky/ui"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { useEffect, useState } from "react"
import { useStore } from "@tanstack/react-store"
import { settingsStore } from "../stores"
import { get_debug_log } from "../query"

function DebugLogModal({ onClose }: { onClose: () => void }) {
    const [log, setLog] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        get_debug_log().then((result) => {
            setLog(result)
            setLoading(false)
        })
    }, [])

    return (
        <ModalRoot onCancel={ onClose }>
            <DialogBody>
                <ScrollPanel>
                    { loading ? (
                        <div>Loading...</div>
                    ) : log ? (
                        <pre style={ { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 } }>{ log }</pre>
                    ) : (
                        <div>No debug log found. Launch a game to generate one.</div>
                    ) }
                </ScrollPanel>
            </DialogBody>
        </ModalRoot>
    )
}

export function Content() {
    const [showMore, setShowMore] = useState(false)
    const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
    const showCommands = useStore(settingsStore, (state) => state.showCommands)
    return (
        <PanelSection>
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
                <ToggleField
                    checked={ useHierarchy }
                    onChange={ (value) => {
                        settingsStore.setState((state) => {
                            state.useHierarchy = value
                        })
                    } }
                    description={ 'Display launch options with a similar starting name in a tree structure' }
                    label={ 'Enable hierarchy display' }
                    bottomSeparator={ 'none' }
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    checked={ showCommands }
                    onChange={ (value) => {
                        settingsStore.setState((state) => {
                            state.showCommands = value
                        })
                    } }
                    description={ 'Show the on/off commands below each launch option' }
                    label={ 'Show commands' }
                    bottomSeparator={ 'none' }
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => {
                        window.open(process.env.HOMEPAGE, "_blank")
                    } }
                >
                    README.md
                </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={ () => {
                        setShowMore((value) => !value)
                    } }
                >{ showMore ? <FaChevronUp/> : <FaChevronDown/> }</ButtonItem>
            </PanelSectionRow>
            {
                showMore && (
                    <>
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={ () => {
                                    const modalResult = showModal(<DebugLogModal onClose={ () => modalResult.Close() }/>)
                                } }
                            >
                                Debug log
                            </ButtonItem>
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={ () => {
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
                                                id: 'steam-deck',
                                                group: 'Steam',
                                                name: 'Steam Deck',
                                                on: 'SteamDeck=1',
                                                off: 'SteamDeck=0',
                                                enableGlobally: true,
                                            },
                                            {
                                                id: 'mangohud',
                                                group: 'MangoHud',
                                                name: 'MangoHud',
                                                on: 'mangohud %command%',
                                                off: '',
                                                enableGlobally: false,
                                            },
                                            {
                                                id: 'mangohud-config-preset-none',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: '',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'None',
                                                fallbackValue: true,
                                            },
                                            {
                                                id: 'mangohud-config-preset-0',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: 'MANGOHUD_CONFIG="preset=0"',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'No Hud',
                                            },
                                            {
                                                id: 'mangohud-config-preset-1',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: 'MANGOHUD_CONFIG="preset=1"',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'FPS Only',
                                            },
                                            {
                                                id: 'mangohud-config-preset-2',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: 'MANGOHUD_CONFIG="preset=2"',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'Horizontal',
                                            },
                                            {
                                                id: 'mangohud-config-preset-3',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: 'MANGOHUD_CONFIG="preset=3"',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'Extended',
                                            },
                                            {
                                                id: 'mangohud-config-preset-4',
                                                group: 'MangoHud',
                                                name: 'MangoHud Preset',
                                                on: 'MANGOHUD_CONFIG="preset=4"',
                                                off: '',
                                                enableGlobally: false,
                                                valueId: 'mangohud-config-preset',
                                                valueName: 'Detailed',
                                            },
                                        ],
                                    }))
                                } }
                            >
                                Debug launch options
                            </ButtonItem>
                        </PanelSectionRow>
                    </>
                )
            }
        </PanelSection>
    )
}
