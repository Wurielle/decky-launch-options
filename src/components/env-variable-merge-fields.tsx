import { Field, Focusable, TextField } from "@decky/ui"
import { EnvVariableMerge } from "../shared"
import { ScrollIntoView } from "./scroll-into-view"

interface EnvVariableMergeFieldsProps {
  data: EnvVariableMerge
  onChange: <K extends keyof EnvVariableMerge>(
    field: K,
    value: EnvVariableMerge[K],
  ) => void
}

export function EnvVariableMergeFields({
  data,
  onChange,
}: EnvVariableMergeFieldsProps) {
  return (
    <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <ScrollIntoView>
        {({ scrollIntoView }) => (
          <Focusable>
            <Field childrenLayout={"below"} label={"Environment variable name"}>
              <TextField
                {...{ placeholder: "E.g.: WINEDLLOVERRIDES" }}
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
      <ScrollIntoView>
        {({ scrollIntoView }) => (
          <Focusable>
            <Field
              childrenLayout={"below"}
              label={"Delimiter"}
              description={
                <div style={{ textAlign: "left" }}>
                  Used to join values when this variable appears in multiple
                  active launch options
                </div>
              }
            >
              <TextField
                {...{ placeholder: "E.g.: ; or ," }}
                style={{ width: "100%" }}
                value={data.delimiter}
                onChange={(e) => {
                  scrollIntoView(e)
                  onChange("delimiter", e.target.value)
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
    </Focusable>
  )
}
