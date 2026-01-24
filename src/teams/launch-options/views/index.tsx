import {
    ConfirmModal,
    DialogButton,
    showModal,
    SidebarNavigation,
    SteamSpinner,
    TextField,
    ToggleField,
} from '@decky/ui'
import { useSettings } from '../../../hooks'
import { useImmer } from 'use-immer'
import { v4 as uuid } from 'uuid'
import { FaPlus, FaTerminal } from "react-icons/fa"
import { LaunchOption } from '../../../shared'

function CreateLaunchOptionForm({ settingsContext }: { settingsContext: ReturnType<typeof useSettings> }) {
    const { createLaunchOption } = settingsContext
    const [data, setData] = useImmer<Omit<LaunchOption, 'id'>>({
        name: '',
        onCommand: '',
        offCommand: '',
        enableGlobally: false,
    })

    function submit() {
        createLaunchOption({
            id: uuid(),
            ...data,
        })
        setData({
            name: '',
            onCommand: '',
            offCommand: '',
            enableGlobally: false,
        })
    }

    return (
        <div>
            <div style={ { marginBottom: 22 } }>
                <ToggleField label={ 'Enable globally' } checked={ data.enableGlobally }
                             onChange={ (value) => setData((draft) => {
                                 draft.enableGlobally = value
                             }) }/>
            </div>
            <div>
                <TextField label={ 'Name' } style={ { width: '100%' } } value={ data.name }
                           onChange={ (e) => setData((draft) => {
                               draft.name = e.target.value
                           }) }/>
            </div>
            <div>
                <TextField label={ 'On command' } style={ { width: '100%' } } value={ data.onCommand }
                           onChange={ (e) => setData((draft) => {
                               draft.onCommand = e.target.value
                           }) }/>
            </div>
            <div>
                <TextField label={ 'Off command' } style={ { width: '100%' } } value={ data.offCommand }
                           onChange={ (e) => setData((draft) => {
                               draft.offCommand = e.target.value
                           }) }/>
            </div>
            <div style={ { display: 'flex', gap: '10px' } }>
                <DialogButton style={ { flex: 1 } }
                              onClick={ submit }>
                    Add launch option
                </DialogButton>
            </div>
        </div>
    )
}

function UpdateLaunchOptionForm({ data, settingsContext }: {
    data: LaunchOption,
    settingsContext: ReturnType<typeof useSettings>
}) {
    const { updateLaunchOption, deleteLaunchOption } = settingsContext

    function remove() {
        return showModal(
            <ConfirmModal
                strTitle={ `Remove launch option` }
                strDescription={
                    `Do you want to remove the "${ data.name || 'Unnamed' }" launch option?`
                }
                strOKButtonText="Confirm"
                strCancelButtonText="Cancel"
                onOK={ async () => {
                    return deleteLaunchOption(data.id)
                } }
            />,
        )
    }

    return (
        <div>
            <div style={ { marginBottom: 22 } }>
                <ToggleField label={ 'Enable globally' } checked={ data.enableGlobally }
                             onChange={ (value) => updateLaunchOption(data, 'enableGlobally', value) }/>
            </div>
            <div>
                <TextField label={ 'Name' } style={ { width: '100%' } } value={ data.name }
                           onChange={ (e) => updateLaunchOption(data, 'name', e.target.value) }/>
            </div>
            <div>
                <TextField label={ 'On command' } style={ { width: '100%' } } value={ data.onCommand }
                           onChange={ (e) => updateLaunchOption(data, 'onCommand', e.target.value) }/>
            </div>
            <div>
                <TextField label={ 'Off command' } style={ { width: '100%' } } value={ data.offCommand }
                           onChange={ (e) => updateLaunchOption(data, 'offCommand', e.target.value) }/>
            </div>
            <div style={ { display: 'flex', gap: '10px' } }>
                <DialogButton style={ { flex: 1 } }
                              onClick={ remove }>
                    <div style={ {
                        color: 'oklch(63.7% 0.237 25.331)',
                        fontWeight: 'bold',
                    } }>
                        Remove launch option
                    </div>
                </DialogButton>
            </div>
        </div>
    )
}

export function LaunchOptionsPage() {
    const settingsContext = useSettings()
    return (
        <div
            style={ {
                marginTop: "40px",
                height: "calc(100% - 40px)",
            } }
        >
            {
                settingsContext.loading ? (
                    <SteamSpinner width={ "100%" } height={ "100%" }/>
                ) : (
                    <SidebarNavigation
                        title={ 'Launch options' }
                        showTitle={ true }
                        pages={ [
                            {
                                icon: <FaPlus/>,
                                title: 'New launch option',
                                content: <CreateLaunchOptionForm settingsContext={ settingsContext }/>,
                            },
                            ...settingsContext.settings.launchOptions.map((launchOption) => ({
                                icon: <FaTerminal/>,
                                title: launchOption.name || 'Unnamed',
                                content: <UpdateLaunchOptionForm settingsContext={ settingsContext }
                                                                 key={ launchOption.id }
                                                                 data={ launchOption }/>,
                            })),
                        ] }
                    />
                )
            }
        </div>
    )
}