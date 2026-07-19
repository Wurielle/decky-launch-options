import { Dropdown, Field, Focusable, TextField, ToggleField } from "@decky/ui"
import { SingleDropdownOption } from "@decky/ui/dist/components/Dropdown"
import { Dispatch, SetStateAction } from "react"
import { LaunchOption } from "../shared"

const quickSelectLabel = "Quick select\u00A0\u00A0"

interface LaunchOptionAdvancedFieldsProps {
  data: LaunchOption
  onChange: <K extends keyof LaunchOption>(
    field: K,
    value: LaunchOption[K],
  ) => void
  hidePerValue: boolean | undefined
  groupQuickSelectOptions: Array<{ data: string; label: string }>
  valueIdQuickSelectOptions: Array<{ data: string; label: string }>
  quickSelectKey: number
  setQuickSelectKey: Dispatch<SetStateAction<number>>
  priorityInput: string
  setPriorityInput: Dispatch<SetStateAction<string>>
}

export function LaunchOptionAdvancedFields({
  data,
  onChange,
  hidePerValue,
  groupQuickSelectOptions,
  valueIdQuickSelectOptions,
  quickSelectKey,
  setQuickSelectKey,
  priorityInput,
  setPriorityInput,
}: LaunchOptionAdvancedFieldsProps) {
  return (
    <>
      <Focusable style={{ minWidth: 240 }}>
        <Field
          childrenLayout={"below"}
          label={"Group"}
          description={
            <div style={{ textAlign: "left" }}>
              Groups this launch option under a named tab
            </div>
          }
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 calc(70% - 5px)" }}>
              <TextField
                {...{ placeholder: "E.g.: Favorites" }}
                style={{ width: "100%" }}
                value={data.group}
                onChange={(e) => onChange("group", e.target.value)}
              />
            </div>
            <div style={{ flex: "0 0 calc(30% - 5px)" }}>
              <Dropdown
                key={`group-${quickSelectKey}`}
                rgOptions={groupQuickSelectOptions}
                selectedOption={undefined}
                strDefaultLabel={quickSelectLabel}
                onChange={(option: SingleDropdownOption) => {
                  onChange("group", option.data)
                  setQuickSelectKey((key) => key + 1)
                }}
              />
            </div>
          </div>
        </Field>
      </Focusable>
      <Focusable style={{ minWidth: 240 }}>
        <Field
          childrenLayout={"below"}
          label={"Value ID"}
          description={
            <div style={{ textAlign: "left" }}>
              Launch options sharing the same Value ID are displayed as a
              dropdown
            </div>
          }
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 calc(70% - 5px)" }}>
              <TextField
                {...{ placeholder: "E.g.: proton-version" }}
                style={{ width: "100%" }}
                value={data.valueId}
                onChange={(e) => onChange("valueId", e.target.value)}
              />
            </div>
            <div style={{ flex: "0 0 calc(30% - 5px)" }}>
              <Dropdown
                key={`valueId-${quickSelectKey}`}
                rgOptions={valueIdQuickSelectOptions}
                selectedOption={undefined}
                strDefaultLabel={quickSelectLabel}
                onChange={(option: SingleDropdownOption) => {
                  onChange("valueId", option.data)
                  setQuickSelectKey((key) => key + 1)
                }}
              />
            </div>
          </div>
        </Field>
      </Focusable>
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
              Higher values run first; negative values run closer to %command%
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
  )
}
