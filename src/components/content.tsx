import {
  ButtonItem,
  Navigation,
  PanelSection,
  PanelSectionRow,
} from "@decky/ui"
import { toaster } from "@decky/api"
import { useLayoutEffect, useRef } from "react"
import { useGetInfoQuery } from "../query"
import { routes } from "../shared"
import { copyTextToClipboard } from "../utils"
import { DeveloperOptions } from "./developer-options"
import { PluginSettings } from "./plugin-settings"

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
  const getInfoQuery = useGetInfoQuery()

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
        <PluginSettings />
        <DeveloperOptions />
      </PanelSection>
    </>
  )
}
