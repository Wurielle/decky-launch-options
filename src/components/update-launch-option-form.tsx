import {usePlugin} from "./plugin-provider";
import {ConfirmModal, DialogButton, showModal, TextField, ToggleField} from "@decky/ui";
import {useMemo} from "react";
import {ScrollIntoView} from "./scroll-into-view";

export function UpdateLaunchOptionForm({id, onDelete}: {
    id: string,
    onDelete?: () => void
}) {
    const {updateLaunchOption, deleteLaunchOption, settings} = usePlugin().settings

    const data = useMemo(() => settings.launchOptions.find((launchOption) => launchOption.id === id), [settings.launchOptions, id])

    if (!data) return null

    function remove() {
        if (!data) return null
        return showModal(
            <ConfirmModal
                strTitle={`Remove launch option`}
                strDescription={
                    `Do you want to remove the "${data.name || 'Unnamed'}" launch option?`
                }
                strOKButtonText="Confirm"
                strCancelButtonText="Cancel"
                onOK={async () => {
                    deleteLaunchOption(data.id)
                    onDelete?.()
                }}
            />,
        )
    }

    return (
        <div>
            <div style={{marginBottom: 22}}>
                <ToggleField label={'Enable globally'} checked={data.enableGlobally}
                             onChange={(value) => updateLaunchOption(data, 'enableGlobally', value)}/>
            </div>
            <ScrollIntoView>
                {({scrollIntoView}) => (
                    <TextField
                        label={'Name'}
                        {...({placeholder: 'E.g.: My favorite launch options'})}
                        style={{width: '100%'}}
                        value={data.name}
                        onChange={(e) => {
                            scrollIntoView(e)
                            updateLaunchOption(data, 'name', e.target.value)
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
                            updateLaunchOption(data, 'on', e.target.value)
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
                            updateLaunchOption(data, 'off', e.target.value)
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
                              onClick={remove}>
                    <div style={{
                        color: 'oklch(63.7% 0.237 25.331)',
                        fontWeight: 'bold',
                    }}>
                        Remove launch option
                    </div>
                </DialogButton>
            </div>
        </div>
    )
}