import {
  ConfirmModal,
  DialogButton,
  Field,
  Focusable,
  showModal,
  TextField,
  ToggleField,
} from "@decky/ui"
import { useEffect, useMemo, useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { LaunchOption } from "../shared"
import { LaunchOptionAdvancedFields } from "./launch-option-advanced-fields"
import { usePlugin } from "./plugin-provider"

const formatPriority = (priority: number) =>
  priority === 0 ? "" : String(priority)

interface LaunchOptionFieldsProps {
  data: LaunchOption
  onChange: <K extends keyof LaunchOption>(
    field: K,
    value: LaunchOption[K],
  ) => void
  /** When true, only show fields common to a valueId group (enableGlobally, name, group, valueId) */
  commonOnly?: boolean
}

export function LaunchOptionFields({
  data,
  onChange,
  commonOnly,
}: LaunchOptionFieldsProps) {
  const { settings } = usePlugin().settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [enableGloballyKey, setEnableGloballyKey] = useState(0)
  const [quickSelectKey, setQuickSelectKey] = useState(0)
  const [priorityInput, setPriorityInput] = useState(() =>
    formatPriority(data.priority),
  )
  const hasValueId = !!data.valueId
  const hidePerValue = commonOnly && hasValueId

  useEffect(() => {
    setPriorityInput(formatPriority(data.priority))
  }, [data.id, data.priority])
  const groupQuickSelectOptions = useMemo(
    () => [
      { data: "", label: "None\u00A0\u00A0" },
      ...Array.from(
        new Set(
          settings.launchOptions.map((item) => item.group).filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((group) => ({ data: group, label: `${group}\u00A0\u00A0` })),
    ],
    [settings.launchOptions],
  )
  const valueIdQuickSelectOptions = useMemo(
    () => [
      { data: "", label: "None\u00A0\u00A0" },
      ...Array.from(
        new Set(
          settings.launchOptions.map((item) => item.valueId).filter(Boolean),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((valueId) => ({ data: valueId, label: `${valueId}\u00A0\u00A0` })),
    ],
    [settings.launchOptions],
  )

  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Focusable>
        <ToggleField
          key={enableGloballyKey}
          label={"Enable globally"}
          checked={data.enableGlobally}
          onChange={(value) => {
            if (value) {
              showModal(
                <ConfirmModal
                  strTitle="Enable globally"
                  strDescription="This will clear all per-app selections for this launch option. Do you want to continue?"
                  strOKButtonText="Confirm"
                  strCancelButtonText="Cancel"
                  onOK={() => onChange("enableGlobally", true)}
                  onCancel={() => setEnableGloballyKey((k) => k + 1)}
                />,
              )
            } else {
              onChange("enableGlobally", false)
            }
          }}
        />
      </Focusable>
      <Focusable>
        <Field childrenLayout={"below"} label={"Name"}>
          <TextField
            {...{ placeholder: "E.g.: Steam Deck Mode" }}
            style={{ width: "100%" }}
            value={data.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </Field>
      </Focusable>
      {!hidePerValue && (
        <Focusable>
          <Field childrenLayout={"below"} label={"On command"}>
            <TextField
              {...{
                placeholder:
                  "E.g.: SteamDeck=1 ~/script/install %command% -novid",
              }}
              style={{ width: "100%" }}
              value={data.on}
              onChange={(e) => onChange("on", e.target.value)}
            />
          </Field>
        </Focusable>
      )}
      {!hidePerValue && (
        <Focusable>
          <Field childrenLayout={"below"} label={"Off command"}>
            <TextField
              {...{
                placeholder:
                  "E.g.: SteamDeck=0 ~/script/uninstall %command% -novid",
              }}
              style={{ width: "100%" }}
              value={data.off}
              onChange={(e) => onChange("off", e.target.value)}
            />
          </Field>
        </Focusable>
      )}
      <DialogButton
        onClick={() => {
          setShowAdvanced((value) => !value)
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>Advanced</span>{" "}
          {showAdvanced ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </DialogButton>
      {showAdvanced && (
        <LaunchOptionAdvancedFields
          data={data}
          onChange={onChange}
          hidePerValue={hidePerValue}
          groupQuickSelectOptions={groupQuickSelectOptions}
          valueIdQuickSelectOptions={valueIdQuickSelectOptions}
          quickSelectKey={quickSelectKey}
          setQuickSelectKey={setQuickSelectKey}
          priorityInput={priorityInput}
          setPriorityInput={setPriorityInput}
        />
      )}
    </Focusable>
  )
}
