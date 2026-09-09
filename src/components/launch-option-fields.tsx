import {
  ConfirmModal,
  DialogButton,
  Dropdown,
  Field,
  Focusable,
  showModal,
  TextField,
  ToggleField,
} from "@decky/ui"
import { SingleDropdownOption } from "@decky/ui/dist/components/Dropdown"
import { useEffect, useMemo, useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { LaunchOption } from "../shared"
import {
  LaunchOptionControl,
  LaunchOptionControls,
  LaunchOptionFocusProvider,
  useLaunchOptionFocus,
} from "./launch-option-focus"
import { usePlugin } from "./plugin-provider"

const quickSelectLabel = "Quick select\u00A0\u00A0"

const formatPriority = (priority: number) =>
  priority === 0 ? "" : String(priority)

function QuickSelectField({
  label,
  description,
  placeholder,
  value,
  options,
  restoreFocus,
  onQuickSelect,
  onChange,
}: {
  label: string
  description: string
  placeholder: string
  value: string
  options: SingleDropdownOption[]
  restoreFocus: boolean
  onQuickSelect: () => void
  onChange: (value: string) => void
}) {
  const { setControl } = useLaunchOptionFocus()
  const [version, setVersion] = useState(0)

  return (
    <Focusable style={{ minWidth: 240 }}>
      <Field
        childrenLayout="below"
        label={label}
        description={<div style={{ textAlign: "left" }}>{description}</div>}
      >
        <LaunchOptionControls
          key={version}
          autoFocus={restoreFocus && version > 0}
        >
          <LaunchOptionControl
            control="value"
            style={{ flex: "0 0 calc(70% - 5px)" }}
          >
            <TextField
              {...{ placeholder }}
              style={{ width: "100%" }}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </LaunchOptionControl>
          <LaunchOptionControl
            control="quick-select"
            style={{ flex: "0 0 calc(30% - 5px)" }}
          >
            <Dropdown
              rgOptions={options}
              selectedOption={undefined}
              strDefaultLabel={quickSelectLabel}
              onChange={(option: SingleDropdownOption) => {
                setControl("quick-select")
                onQuickSelect()
                onChange(option.data)
                // Reset this picker to its prompt and restore its row's focus.
                setVersion((current) => current + 1)
              }}
            />
          </LaunchOptionControl>
        </LaunchOptionControls>
      </Field>
    </Focusable>
  )
}

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
  const [quickSelectFocus, setQuickSelectFocus] = useState<{
    id: string
    field: "group" | "valueId"
  } | null>(null)
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
        <>
          <LaunchOptionFocusProvider key={data.id}>
            <QuickSelectField
              label="Group"
              description="Groups this launch option under a named tab"
              placeholder="E.g.: Favorites"
              value={data.group}
              options={groupQuickSelectOptions}
              restoreFocus={
                quickSelectFocus?.id === data.id &&
                quickSelectFocus.field === "group"
              }
              onQuickSelect={() =>
                setQuickSelectFocus({ id: data.id, field: "group" })
              }
              onChange={(value) => onChange("group", value)}
            />
            <QuickSelectField
              label="Value ID"
              description="Launch options sharing the same Value ID are displayed as a dropdown"
              placeholder="E.g.: proton-version"
              value={data.valueId}
              options={valueIdQuickSelectOptions}
              restoreFocus={
                quickSelectFocus?.id === data.id &&
                quickSelectFocus.field === "valueId"
              }
              onQuickSelect={() =>
                setQuickSelectFocus({ id: data.id, field: "valueId" })
              }
              onChange={(value) => onChange("valueId", value)}
            />
          </LaunchOptionFocusProvider>
          {!hidePerValue && (
            <Focusable>
              <Field
                childrenLayout={"below"}
                label={"Value Name"}
                description={
                  <div style={{ textAlign: "left" }}>
                    Display name shown in the dropdown
                  </div>
                }
              >
                <TextField
                  {...{ placeholder: "E.g.: Version 7" }}
                  style={{ width: "100%" }}
                  value={data.valueName}
                  onChange={(e) => onChange("valueName", e.target.value)}
                />
              </Field>
            </Focusable>
          )}
          {!hidePerValue && (
            <Focusable>
              <ToggleField
                label={"Set as fallback value"}
                checked={data.fallbackValue}
                disabled={!data.valueId}
                description={
                  "Selected by default in the dropdown when no other value is chosen"
                }
                onChange={(value) => onChange("fallbackValue", value)}
              />
            </Focusable>
          )}
          <Focusable>
            <Field
              childrenLayout={"below"}
              label={"Priority"}
              description={
                <div style={{ textAlign: "left" }}>
                  Higher values run first; negative values run closer to
                  %command%
                </div>
              }
            >
              <TextField
                {...{ placeholder: "0" }}
                style={{ width: "100%" }}
                value={priorityInput}
                onChange={(e) => {
                  const value = e.target.value
                  setPriorityInput(value)

                  if (value === "-") return

                  const priority = Number(value)
                  onChange("priority", Number.isFinite(priority) ? priority : 0)
                }}
                onBlur={() => {
                  if (!Number.isFinite(Number(priorityInput))) {
                    setPriorityInput("")
                    onChange("priority", 0)
                  }
                }}
              />
            </Field>
          </Focusable>
        </>
      )}
    </Focusable>
  )
}
