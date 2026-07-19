import {
  ButtonItem,
  Dropdown,
  Field,
  Navigation,
  PanelSection,
  PanelSectionRow,
  showModal,
  SingleDropdownOption,
  ToggleField,
} from "@decky/ui"
import { toaster } from "@decky/api"
import { useStore } from "@tanstack/react-store"
import { useLayoutEffect, useRef, useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { debugLaunchOptions } from "../debug-launch-options"
import { useGetInfoQuery } from "../query"
import { batchCreateLaunchOptionsEventType, routes } from "../shared"
import {
  type LaunchOptionSort,
  launchOptionSortOptions,
  settingsStore,
} from "../stores"
import { copyTextToClipboard } from "../utils"
import { DebugLogModal } from "./debug-log-modal"

function resetAncestorScrollPositions(element: HTMLElement | null) {
  const ownerDocument = element?.ownerDocument ?? document
  let current = element?.parentElement

  while (current && current !== ownerDocument.body) {
    if (current.scrollTop > 0 || current.scrollHeight > current.clientHeight) {
      current.scrollTop = 0
    }

    current = current.parentElement
  }

  ownerDocument.scrollingElement?.scrollTo({ top: 0 })
}

export function Content() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [showMore, setShowMore] = useState(false)
  const getInfoQuery = useGetInfoQuery()
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

  useLayoutEffect(() => {
    const resetScroll = () => resetAncestorScrollPositions(contentRef.current)

    resetScroll()
    const frame = window.requestAnimationFrame(resetScroll)

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div ref={contentRef} style={{ display: "none" }} />
      <PanelSection>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              Navigation.Navigate(routes.launchOptionsManagerItem("new"))
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
              Navigation.Navigate(routes.envVariableMergesManagerItem("new"))
              Navigation.CloseSideMenus()
            }}
          >
            Manage env variable merges
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={!getInfoQuery.data?.COMMAND}
            onClick={() => {
              const command = getInfoQuery.data?.COMMAND
              if (!command) return

              copyTextToClipboard(command).then(
                () => {
                  toaster.toast({
                    title: "Copied to clipboard",
                    body: command,
                    duration: 5000,
                  })
                },
                () => {
                  toaster.toast({
                    title: "Copy failed",
                    body: "Clipboard unavailable.",
                    duration: 5000,
                  })
                },
              )
            }}
          >
            Copy DLO command
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              window.open(process.env.HOMEPAGE, "_blank")
            }}
          >
            README.md
          </ButtonItem>
        </PanelSectionRow>
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
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              setShowMore((value) => !value)
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
                    <DebugLogModal onClose={() => modalResult.Close()} />,
                  )
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
                      detail: debugLaunchOptions,
                    }),
                  )
                }}
              >
                Debug launch options
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>
    </>
  )
}
