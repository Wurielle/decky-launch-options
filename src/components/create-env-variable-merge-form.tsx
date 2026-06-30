import { DialogButton } from "@decky/ui"
import { useImmer } from "use-immer"
import { EnvVariableMerge, envVariableMergeFactory } from "../shared"
import { usePlugin } from "./plugin-provider"
import { EnvVariableMergeFields } from "./env-variable-merge-fields"

export function CreateEnvVariableMergeForm(props: {
  defaultValue?: Partial<EnvVariableMerge>
  onSubmit?: (values: EnvVariableMerge) => void
}) {
  const { defaultValue, onSubmit } = props
  const { createEnvVariableMerge } = usePlugin().settings
  const [data, setData] = useImmer<EnvVariableMerge>(
    envVariableMergeFactory(defaultValue),
  )

  function submit() {
    const newEnvVariableMerge = envVariableMergeFactory(data)
    createEnvVariableMerge(newEnvVariableMerge)
    onSubmit?.(newEnvVariableMerge)
    setData(envVariableMergeFactory())
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <EnvVariableMergeFields
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
