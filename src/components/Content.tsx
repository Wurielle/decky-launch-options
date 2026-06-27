import { PanelSection, PanelSectionRow, ButtonItem, Navigation, Field, Dropdown, SingleDropdownOption, ToggleField, showModal } from "@decky/ui";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useGetInfoQuery } from "../query";
import { routes, batchCreateLaunchOptionsEventType } from "../shared";
import { settingsStore, launchOptionSortOptions, type LaunchOptionSort } from "../stores";
import { copyTextToClipboard } from "../utils";
import { DebugLogModal } from "./content";


export function Content() {
  const [showMore, setShowMore] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const getInfoQuery = useGetInfoQuery();
  const autoManageLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageLaunchOptions
  );
  const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy);
  const showCommands = useStore(settingsStore, (state) => state.showCommands);
  const launchOptionSort = useStore(
    settingsStore,
    (state) => state.launchOptionSort
  );
  return (
    <PanelSection>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => {
            Navigation.Navigate(routes.launchOptions());
            Navigation.CloseSideMenus();
          }}
        >
          Manage launch options
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={!getInfoQuery.data?.COMMAND}
          onClick={() => {
            const command = getInfoQuery.data?.COMMAND;
            if (!command) return;

            copyTextToClipboard(command).then(() => {
              setCopiedCommand(true);
              window.setTimeout(() => setCopiedCommand(false), 3000);
            });
          }}
        >
          {copiedCommand ? "✅ Copied DLO command" : "Copy DLO command"}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <Field childrenLayout={"below"} label={"Sort launch options"}>
          <Dropdown
            rgOptions={launchOptionSortOptions}
            selectedOption={launchOptionSort}
            onChange={(option: SingleDropdownOption) => {
              settingsStore.setState((state) => {
                state.launchOptionSort = option.data as LaunchOptionSort;
              });
            }} />
        </Field>
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={autoManageLaunchOptions}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.autoManageLaunchOptions = value;
            });
          }}
          description={"Let Decky Launch Options manage the \"Launch Options\" field for all apps automatically"}
          label={"Auto-manage Launch Options"}
          bottomSeparator={"none"} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={useHierarchy}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.useHierarchy = value;
            });
          }}
          description={"Display launch options with a similar starting name in a tree structure"}
          label={"Enable hierarchy display"}
          bottomSeparator={"none"} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={showCommands}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.showCommands = value;
            });
          }}
          description={"Show on/off commands below each launch option"}
          label={"Show commands"}
          bottomSeparator={"none"} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => {
            window.open(process.env.HOMEPAGE, "_blank");
          }}
        >
          README.md
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={() => {
            setShowMore((value) => !value);
          }}
        >
          {showMore ? <FaChevronUp /> : <FaChevronDown />}
        </ButtonItem>
      </PanelSectionRow>
      {showMore && (
        <>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => {
                const modalResult = showModal(
                  <DebugLogModal onClose={() => modalResult.Close()} />
                );
              }}
            >
              Debug log
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent(batchCreateLaunchOptionsEventType, {
                    detail: [
                      {
                        id: "portal-args",
                        name: "Portal args",
                        on: "-novid +cl_showfps 3",
                        off: "",
                        enableGlobally: false,
                      },
                      {
                        id: "steam-deck",
                        group: "Steam",
                        name: "Steam Deck",
                        on: "SteamDeck=1",
                        off: "SteamDeck=0",
                        enableGlobally: true,
                      },
                      {
                        id: "mangohud",
                        group: "MangoHud",
                        name: "MangoHud",
                        on: "mangohud %command%",
                        off: "",
                        enableGlobally: false,
                      },
                      {
                        id: "mangohud-config-preset-none",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: "",
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "None",
                        fallbackValue: true,
                      },
                      {
                        id: "mangohud-config-preset-0",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: 'MANGOHUD_CONFIG="preset=0"',
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "No Hud",
                      },
                      {
                        id: "mangohud-config-preset-1",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: 'MANGOHUD_CONFIG="preset=1"',
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "FPS Only",
                      },
                      {
                        id: "mangohud-config-preset-2",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: 'MANGOHUD_CONFIG="preset=2"',
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "Horizontal",
                      },
                      {
                        id: "mangohud-config-preset-3",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: 'MANGOHUD_CONFIG="preset=3"',
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "Extended",
                      },
                      {
                        id: "mangohud-config-preset-4",
                        group: "MangoHud",
                        name: "MangoHud Preset",
                        on: 'MANGOHUD_CONFIG="preset=4"',
                        off: "",
                        enableGlobally: false,
                        valueId: "mangohud-config-preset",
                        valueName: "Detailed",
                      },
                    ],
                  })
                );
              }}
            >
              Debug launch options
            </ButtonItem>
          </PanelSectionRow>
        </>
      )}
    </PanelSection>
  );
}
