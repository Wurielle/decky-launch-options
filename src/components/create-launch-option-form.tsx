import {usePlugin} from "./plugin-provider";
import {DialogButton} from "@decky/ui";
import {useImmer} from "use-immer";
import {LaunchOption, launchOptionFactory} from "../shared";
import {LaunchOptionFields} from "./launch-option-fields";

export function CreateLaunchOptionForm(props: {
    defaultValue?: Partial<LaunchOption>,
    onSubmit?: (values: LaunchOption) => void,
}) {
    const {defaultValue, onSubmit} = props
    const {createLaunchOption} = usePlugin().settings
    const [data, setData] = useImmer<LaunchOption>(launchOptionFactory(defaultValue))

    function submit() {
        const newLaunchOption = launchOptionFactory(data)
        createLaunchOption(newLaunchOption)
        onSubmit?.(newLaunchOption)
        setData(launchOptionFactory())
    }

    return (
        <div>
            <LaunchOptionFields
                data={data}
                onChange={(field, value) => setData((draft) => {
                    (draft as any)[field] = value
                })}
            />
            <div style={{display: 'flex', gap: '10px'}}>
                <DialogButton style={{flex: 1}}
                              onClick={submit}>
                    Add launch option
                </DialogButton>
            </div>
        </div>
    )
}
