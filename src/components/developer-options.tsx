import { ButtonItem, PanelSectionRow, showModal } from "@decky/ui"
import { useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { debugLaunchOptions } from "../debug-launch-options"
import { batchCreateLaunchOptionsEventType } from "../shared"
import { DebugLogModal } from "./debug-log-modal"

export function DeveloperOptions() {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
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
    </>
  )
}
