import {usePlugin} from "./plugin-provider";
import {DialogButton, TextField, ToggleField} from "@decky/ui";
import {useImmer} from "use-immer";
import {LaunchOption, launchOptionFactory} from "../shared";
import {ScrollIntoView} from "./scroll-into-view";

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
            <div style={{marginBottom: 22}}>
                <ToggleField label={'Enable globally'} checked={data.enableGlobally}
                             onChange={(value) => setData((draft) => {
                                 draft.enableGlobally = value
                             })}/>
            </div>
            <ScrollIntoView>
                {({scrollIntoView}) => (
                    <TextField
                        label={'Name'}
                        {...({placeholder: 'E.g.: Steam Deck env'})}
                        style={{width: '100%'}}
                        value={data.name}
                        onChange={(e) => {
                            scrollIntoView(e)
                            setData((draft) => {
                                draft.name = e.target.value
                            })
                        }}
                        onKeyDown={scrollIntoView}
                        onKeyUp={scrollIntoView}
                        onInput={scrollIntoView}
                        onSelect={scrollIntoView}
                        onFocus={scrollIntoView}
                    />
                )}
            </ScrollIntoView>
            <ScrollIntoView>
                {({scrollIntoView}) => (
                    <TextField
                        label={'On command'}
                        {...({placeholder: 'E.g.: SteamDeck=1 ~/script/install %command% -novid'})}
                        style={{width: '100%'}}
                        value={data.on}
                        onChange={(e) => {
                            scrollIntoView(e)
                            setData((draft) => {
                                draft.on = e.target.value
                            })
                        }}
                        onKeyDown={scrollIntoView}
                        onKeyUp={scrollIntoView}
                        onInput={scrollIntoView}
                        onSelect={scrollIntoView}
                        onFocus={scrollIntoView}
                    />
                )}
            </ScrollIntoView>
            <ScrollIntoView>
                {({scrollIntoView}) => (
                    <TextField
                        label={'Off command'}
                        {...({placeholder: 'E.g.: SteamDeck=0 ~/script/uninstall %command% -novid'})}
                        style={{width: '100%'}}
                        value={data.off}
                        onChange={(e) => {
                            scrollIntoView(e)
                            setData((draft) => {
                                draft.off = e.target.value
                            })
                        }}
                        onKeyDown={scrollIntoView}
                        onKeyUp={scrollIntoView}
                        onInput={scrollIntoView}
                        onSelect={scrollIntoView}
                        onFocus={scrollIntoView}
                    />
                )}
            </ScrollIntoView>
            <div style={{display: 'flex', gap: '10px'}}>
                <DialogButton style={{flex: 1}}
                              onClick={submit}>
                    Add launch option
                </DialogButton>
            </div>
        </div>
    )
}