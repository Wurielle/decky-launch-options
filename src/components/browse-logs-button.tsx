import {
  callable,
  FileSelectionType,
  openFilePicker,
  toaster,
} from "@decky/api"
import { ButtonItem, ModalRoot, showModal } from "@decky/ui"
import { useEffect, useState } from "react"
import { ModalScrollContent } from "./modal-scroll-content"

type LogFile = {
  path: string
  content: string
  truncated: boolean
}

const getLogsDirectory = callable<[], string>("get_logs_directory")
const readLogFile = callable<[path: string], LogFile>("read_log_file")
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

function LogFileModal({
  path,
  onClose,
}: {
  path: string
  onClose: () => void
}) {
  const [log, setLog] = useState<LogFile>()
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    readLogFile(path).then(
      (result) => {
        if (active) setLog(result)
      },
      (failure) => {
        if (active) setError(errorMessage(failure))
      },
    )
    return () => {
      active = false
    }
  }, [path])

  return (
    <ModalRoot onCancel={onClose} bAllowFullSize>
      <ModalScrollContent>
        <div>
          <p
            style={{ fontSize: "14px", overflowWrap: "anywhere", marginTop: 0 }}
          >
            {log?.path ?? path}
          </p>
          {error ? (
            <p role="alert">Could not open log: {error}</p>
          ) : !log ? (
            <p role="status">Loading log…</p>
          ) : (
            <>
              {log.truncated && (
                <p>
                  Showing the latest 1 MiB of this log. Older content is
                  omitted.
                </p>
              )}
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {log.content || "This log is empty."}
              </pre>
            </>
          )}
        </div>
      </ModalScrollContent>
    </ModalRoot>
  )
}

export function BrowseLogsButton() {
  const [isBrowsing, setIsBrowsing] = useState(false)
  const browseLogs = async () => {
    setIsBrowsing(true)
    try {
      const directory = await getLogsDirectory()
      const selected = await openFilePicker(
        FileSelectionType.FILE,
        directory,
        true,
        true,
        undefined,
        ["log"],
        true,
        false,
      )
      const modal = showModal(
        <LogFileModal
          path={selected.realpath || selected.path}
          onClose={() => modal.Close()}
        />,
      )
    } catch (error) {
      // Decky's native picker rejects its promise when dismissed.
      if (errorMessage(error) !== "User canceled") {
        toaster.toast({
          title: "Could not browse logs",
          body: errorMessage(error),
        })
      }
    } finally {
      setIsBrowsing(false)
    }
  }

  return (
    <ButtonItem layout="below" disabled={isBrowsing} onClick={browseLogs}>
      {isBrowsing ? "Opening logs…" : "Browse recipe logs"}
    </ButtonItem>
  )
}
