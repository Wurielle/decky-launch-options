import {batchCreateLaunchOptionsEventType, routes} from "../shared";
import {ButtonItem, Navigation, PanelSection, PanelSectionRow} from "@decky/ui";
import {FaChevronDown, FaChevronUp} from "react-icons/fa";
import {useState} from "react";

export function Content() {
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