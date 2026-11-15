import { DialogButton } from "@decky/ui"
import { useImmer } from "use-immer"
import {
  EnvironmentVariableMerge,
  environmentVariableMergeFactory,
} from "../shared"
import { usePlugin } from "./plugin-provider"
import { EnvironmentVariableMergeFields } from "./environment-variable-merge-fields"

export function CreateEnvironmentVariableMergeForm(props: {
  defaultValue?: Partial<EnvironmentVariableMerge>
  onSubmit?: (values: EnvironmentVariableMerge) => void
}) {
  const { defaultValue, onSubmit } = props
  const { createEnvironmentVariableMerge } = usePlugin().settings
  const [data, setData] = useImmer<EnvironmentVariableMerge>(
    environmentVariableMergeFactory(defaultValue),
  )

  function submit() {
    const newEnvironmentVariableMerge = environmentVariableMergeFactory(data)
    createEnvironmentVariableMerge(newEnvironmentVariableMerge)
    onSubmit?.(newEnvironmentVariableMerge)
    setData(environmentVariableMergeFactory())
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <EnvironmentVariableMergeFields
        data={data}
        onChange={(field, value) =>
          setData((draft) => {
            ;(draft as any)[field] = value
          })
        }
      />
      <DialogButton style={{ flex: 1 }} onClick={submit}>
        Add environment variable merge
      </DialogButton>
    </div>
  )
}
