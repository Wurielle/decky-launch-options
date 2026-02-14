import {batchCreateLaunchOptionsEventType, routes} from "../shared";
import {ButtonItem, Field, Navigation, PanelSection, PanelSectionRow, ToggleField} from "@decky/ui";
import {FaChevronDown, FaChevronUp} from "react-icons/fa";
import {useState} from "react";
import {useStore} from "@tanstack/react-store";
import {settingsStore} from "../stores";

export function Content() {
    const [showMore, setShowMore] = useState(false)
    const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
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
                <Field label={
                    <ToggleField
                        highlightOnFocus={false}
                        checked={useHierarchy}
                        onChange={(value) => {
                            settingsStore.setState((state) => {
                                state.useHierarchy = value
                            })
                        }}
                        description={'Display launch options with a similar starting name in a tree structure'}
                        label={'Enable hierarchy display'}
                        bottomSeparator={'none'}
                    />
                }/>
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    onClick={() => {
                        setShowMore((value) => !value)
                    }}
                >{showMore ? <FaChevronUp/> : <FaChevronDown/>}</ButtonItem>
            </PanelSectionRow>
            {
                showMore && (
                    <PanelSectionRow>
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
                            Debug launch options
                        </ButtonItem>
                    </PanelSectionRow>
                )
            }
        </PanelSection>
    )
}