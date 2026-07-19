import {
  Dropdown,
  Field,
  PanelSectionRow,
  SingleDropdownOption,
  ToggleField,
} from "@decky/ui"
import { useStore } from "@tanstack/react-store"
import {
  type LaunchOptionSort,
  launchOptionSortOptions,
  settingsStore,
} from "../stores"

export function PluginSettings() {
  const autoManageLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageLaunchOptions,
  )
  const autoManageNonSteamLaunchOptions = useStore(
    settingsStore,
    (state) => state.autoManageNonSteamLaunchOptions,
  )
  const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
  const showCommands = useStore(settingsStore, (state) => state.showCommands)
  const launchOptionSort = useStore(
    settingsStore,
    (state) => state.launchOptionSort,
  )

  return (
    <>
      <PanelSectionRow>
        <Field childrenLayout={"below"} label={"Sort launch options"}>
          <Dropdown
            rgOptions={launchOptionSortOptions}
            selectedOption={launchOptionSort}
            onChange={(option: SingleDropdownOption) => {
              settingsStore.setState((state) => {
                state.launchOptionSort = option.data as LaunchOptionSort
              })
            }}
          />
        </Field>
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={autoManageLaunchOptions}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.autoManageLaunchOptions = value
            })
          }}
          description={
            'Let Decky Launch Options manage the "Launch Options" field for Steam apps automatically'
          }
          label={"Auto-manage Steam App Launch Options"}
          bottomSeparator={"none"}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={autoManageNonSteamLaunchOptions}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.autoManageNonSteamLaunchOptions = value
            })
          }}
          description={
            'Let Decky Launch Options manage the "Launch Options" field for non-Steam apps automatically'
          }
          label={"Auto-manage Non-Steam App Launch Options"}
          bottomSeparator={"none"}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={useHierarchy}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.useHierarchy = value
            })
          }}
          description={
            "Display launch options with a similar starting name in a tree structure"
          }
          label={"Enable hierarchy display"}
          bottomSeparator={"none"}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          checked={showCommands}
          onChange={(value) => {
            settingsStore.setState((state) => {
              state.showCommands = value
            })
          }}
          description={"Show on/off commands below each launch option"}
          label={"Show commands"}
          bottomSeparator={"none"}
        />
      </PanelSectionRow>
    </>
  )
}
