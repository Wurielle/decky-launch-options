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
import { LaunchOption } from "../shared"
import { ScrollIntoView } from "./scroll-into-view"
import { useMemo, useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa"
import { usePlugin } from "./plugin-provider"

const quickSelectLabel = "Quick select\u00A0\u00A0"

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
  const hasValueId = !!data.valueId
  const hidePerValue = commonOnly && hasValueId
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
      <ScrollIntoView>
        {({ scrollIntoView }) => (
          <Focusable>
            <Field childrenLayout={"below"} label={"Name"}>
              <TextField
                {...{ placeholder: "E.g.: Steam Deck Mode" }}
                style={{ width: "100%" }}
                value={data.name}
                onChange={(e) => {
                  scrollIntoView(e)
                  onChange("name", e.target.value)
                }}
                onKeyDown={scrollIntoView}
                onKeyUp={scrollIntoView}
                onInput={scrollIntoView}
                onSelect={scrollIntoView}
                onFocus={scrollIntoView}
              />
            </Field>
          </Focusable>
        )}
      </ScrollIntoView>
      {!hidePerValue && (
        <ScrollIntoView>
          {({ scrollIntoView }) => (
            <Focusable>
              <Field childrenLayout={"below"} label={"On command"}>
                <TextField
                  {...{
                    placeholder:
                      "E.g.: SteamDeck=1 ~/script/install %command% -novid",
                  }}
                  style={{ width: "100%" }}
                  value={data.on}
                  onChange={(e) => {
                    scrollIntoView(e)
                    onChange("on", e.target.value)
                  }}
                  onKeyDown={scrollIntoView}
                  onKeyUp={scrollIntoView}
                  onInput={scrollIntoView}
                  onSelect={scrollIntoView}
                  onFocus={scrollIntoView}
                />
              </Field>
            </Focusable>
          )}
        </ScrollIntoView>
      )}
      {!hidePerValue && (
        <ScrollIntoView>
          {({ scrollIntoView }) => (
            <Focusable>
              <Field childrenLayout={"below"} label={"Off command"}>
                <TextField
                  {...{
                    placeholder:
                      "E.g.: SteamDeck=0 ~/script/uninstall %command% -novid",
                  }}
                  style={{ width: "100%" }}
                  value={data.off}
                  onChange={(e) => {
                    scrollIntoView(e)
                    onChange("off", e.target.value)
                  }}
                  onKeyDown={scrollIntoView}
                  onKeyUp={scrollIntoView}
                  onInput={scrollIntoView}
                  onSelect={scrollIntoView}
                  onFocus={scrollIntoView}
                />
              </Field>
            </Focusable>
          )}
        </ScrollIntoView>
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
        <ScrollIntoView>
          {({ scrollIntoView }) => (
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
                      onChange={(e) => {
                        scrollIntoView(e)
                        onChange("group", e.target.value)
                      }}
                      onKeyDown={scrollIntoView}
                      onKeyUp={scrollIntoView}
                      onInput={scrollIntoView}
                      onSelect={scrollIntoView}
                      onFocus={scrollIntoView}
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
          )}
        </ScrollIntoView>
      )}
      {showAdvanced && (
        <ScrollIntoView>
          {({ scrollIntoView }) => (
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
                      onChange={(e) => {
                        scrollIntoView(e)
                        onChange("valueId", e.target.value)
                      }}
                      onKeyDown={scrollIntoView}
                      onKeyUp={scrollIntoView}
                      onInput={scrollIntoView}
                      onSelect={scrollIntoView}
                      onFocus={scrollIntoView}
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
          )}
        </ScrollIntoView>
      )}
      {showAdvanced && !hidePerValue && (
        <ScrollIntoView>
          {({ scrollIntoView }) => (
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
                  onChange={(e) => {
                    scrollIntoView(e)
                    onChange("valueName", e.target.value)
                  }}
                  onKeyDown={scrollIntoView}
                  onKeyUp={scrollIntoView}
                  onInput={scrollIntoView}
                  onSelect={scrollIntoView}
                  onFocus={scrollIntoView}
                />
              </Field>
            </Focusable>
          )}
        </ScrollIntoView>
      )}
      {showAdvanced && !hidePerValue && (
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
      {showAdvanced && (
        <ScrollIntoView>
          {({ scrollIntoView }) => (
            <Focusable>
              <Field
                childrenLayout={"below"}
                label={"Priority"}
                description={
                  <div style={{ textAlign: "left" }}>
                    Higher priority launch options run first
                  </div>
                }
              >
                <TextField
                  {...{ placeholder: "0" }}
                  style={{ width: "100%" }}
                  value={data.priority ? String(data.priority) : ""}
                  onChange={(e) => {
                    scrollIntoView(e)
                    const num = Number(e.target.value)
                    onChange("priority", Number.isFinite(num) ? num : 0)
                  }}
                  onKeyDown={scrollIntoView}
                  onKeyUp={scrollIntoView}
                  onInput={scrollIntoView}
                  onSelect={scrollIntoView}
                  onFocus={scrollIntoView}
                />
              </Field>
            </Focusable>
          )}
        </ScrollIntoView>
      )}
    </Focusable>
  )
}
