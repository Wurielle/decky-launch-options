import { Field, Focusable, TextField } from "@decky/ui"
import { EnvironmentVariableMerge } from "../shared"

interface EnvironmentVariableMergeFieldsProps {
  data: EnvironmentVariableMerge
  onChange: <K extends keyof EnvironmentVariableMerge>(
    field: K,
    value: EnvironmentVariableMerge[K],
  ) => void
}

export function EnvironmentVariableMergeFields({
  data,
  onChange,
}: EnvironmentVariableMergeFieldsProps) {
  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Focusable>
        <Field childrenLayout={"below"} label={"Environment variable name"}>
          <TextField
            {...{ placeholder: "E.g.: WINEDLLOVERRIDES" }}
            style={{ width: "100%" }}
            value={data.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </Field>
      </Focusable>
      <Focusable>
        <Field
          childrenLayout={"below"}
          label={"Delimiter"}
          description={
            <div style={{ textAlign: "left" }}>
              Used to join values when this variable appears in multiple active
              launch options
            </div>
          }
        >
          <TextField
            {...{ placeholder: "E.g.: ; or ," }}
            style={{ width: "100%" }}
            value={data.delimiter}
            onChange={(e) => onChange("delimiter", e.target.value)}
          />
        </Field>
      </Focusable>
    </Focusable>
  )
}
