import { LaunchOption, launchOptionFactory } from "../shared"
import { useSettings } from "../hooks"
import { sortBy } from "es-toolkit"
import { useRef, useState } from "react"
import {
  ConfirmModal,
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
  Focusable,
  ModalRoot,
  showModal,
} from "@decky/ui"
import { FaGlobe } from "react-icons/fa"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "../query"
import { ModalScrollContent } from "./modal-scroll-content"

export function BatchAddLaunchOptions({
  data,
  onSubmit,
  onCancel,
}: {
  data: Partial<LaunchOption>[]
  onSubmit: () => void
  onCancel: () => void
}) {
  const [launchOptions] = useState(() =>
    sortBy(data.map(launchOptionFactory), ["name"]),
  )
  const { batchCreateLaunchOptions } = useSettings()
  const addButtonRef = useRef<HTMLDivElement>(null)
  const addWithoutReviewButtonRef = useRef<HTMLDivElement>(null)

  const addAll = () => {
    batchCreateLaunchOptions(launchOptions)
    onSubmit()
  }

  const confirmAddAll = () => {
    const confirmation = showModal(
      <ConfirmModal
        strTitle="Add all launch options?"
        strDescription={
          "Malicious launch options can execute unwanted commands or modify files when an application starts. " +
          (launchOptions.some((option) => option.enableGlobally)
            ? "Globally enabled launch options run for all applications. "
            : "") +
          "Only continue without reviewing the launch options if you trust the source."
        }
        strOKButtonText="Add all"
        strCancelButtonText="Cancel"
        onOK={() => {
          confirmation.Close()
          addAll()
        }}
        onCancel={() => confirmation.Close()}
      />,
    )
  }

  return (
    <ModalRoot onCancel={onCancel} bAllowFullSize>
      <Focusable flow-children="column">
        <DialogHeader>Decky Launch Options</DialogHeader>
        <p style={{ margin: "0 0 12px", fontSize: 16 }}>
          An application would like to add the following launch options, please
          review each of them carefully before accepting.
        </p>
        <DialogButton
          ref={addWithoutReviewButtonRef}
          preferredFocus
          style={{ marginBottom: 12 }}
          onClick={confirmAddAll}
        >
          Add all without review
        </DialogButton>
        <ModalScrollContent
          autoFocus={false}
          onFocusPrevious={() => addWithoutReviewButtonRef.current?.focus()}
          onFocusNext={() => addButtonRef.current?.focus()}
        >
          <DialogBody>
            {launchOptions.some((option) => option.enableGlobally) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 14,
                  color: "#b8bcbf",
                }}
              >
                <FaGlobe aria-hidden="true" style={{ color: "#66c0f4" }} />
                Enabled globally
              </div>
            )}
            <div role="list" aria-label="Launch options to add">
              {launchOptions.map((launchOption) => (
                <div
                  key={launchOption.id}
                  role="listitem"
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #3d4450",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      fontSize: 18,
                      fontWeight: 600,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {launchOption.name}
                      {launchOption.valueName
                        ? ` (${launchOption.valueName})`
                        : ""}
                    </span>
                    {launchOption.enableGlobally && (
                      <FaGlobe
                        role="img"
                        aria-label="Enable globally"
                        title="Enable globally"
                        style={{ flexShrink: 0, color: "#66c0f4" }}
                      />
                    )}
                  </div>
                  {launchOption.on || launchOption.off ? (
                    <dl
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr)",
                        gap: 4,
                        margin: "6px 0 0",
                        fontSize: 16,
                        lineHeight: 1.4,
                      }}
                    >
                      {(["on", "off"] as const).map((state) =>
                        launchOption[state] ? (
                          <Command
                            key={state}
                            label={
                              state === "on" ? "On command" : "Off command"
                            }
                            value={launchOption[state]}
                          />
                        ) : null,
                      )}
                    </dl>
                  ) : (
                    <div
                      style={{ marginTop: 6, fontSize: 16, lineHeight: 1.4 }}
                    >
                      <CommandCode value="(Empty)" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DialogBody>
        </ModalScrollContent>
        <DialogFooter>
          <Focusable
            flow-children="column"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <DialogButtonPrimary
              ref={addButtonRef}
              style={{ flex: 1 }}
              onClick={addAll}
            >
              Add to Decky Launch Options
            </DialogButtonPrimary>
            <DialogButton style={{ flex: 1 }} onClick={onCancel}>
              Cancel
            </DialogButton>
          </Focusable>
        </DialogFooter>
      </Focusable>
    </ModalRoot>
  )
}

function Command({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ color: "#b8bcbf", whiteSpace: "nowrap" }}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0 }}>
        <CommandCode value={value} />
      </dd>
    </>
  )
}

function CommandCode({ value }: { value: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "8px 10px",
        background: "#171a21",
        border: "1px solid #3d4450",
        borderRadius: 4,
        fontSize: "inherit",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      <code>{value}</code>
    </pre>
  )
}

export function batchCreateLaunchOptions(
  launchOptions: Partial<LaunchOption>[],
) {
  const modalResult = showModal(
    <QueryClientProvider client={queryClient}>
      <BatchAddLaunchOptions
        data={launchOptions}
        onSubmit={() => modalResult.Close()}
        onCancel={() => modalResult.Close()}
      />
    </QueryClientProvider>,
  )
}
