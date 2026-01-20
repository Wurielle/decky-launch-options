import { TextField, DialogButton, SidebarNavigation } from '@decky/ui'
import { LaunchOption, useConfig } from '../../../hooks'
import { useImmer } from 'use-immer'
import {v4 as uuid} from 'uuid'
function CreateLaunchOptionForm({ configContext }: {configContext: ReturnType<typeof useConfig>}) {
    const { createLaunchOption } = configContext
    const [data, setData] = useImmer<Omit<LaunchOption, 'id'>>({
        name: '',
        onCommand: '',
        offCommand: '',
    })
    function submit() {
        return createLaunchOption({
            id: uuid(),
            ...data,
        })
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
                <TextField label={'Name'} style={{ width: '100%' }} value={data.name} onChange={(e) => setData((draft) => {
                    draft.name = e.target.value
                })} />
            </div>
            <div>
                <TextField label={'On command'} style={{ width: '100%' }} value={data.onCommand} onChange={(e) => setData((draft) => {
                    draft.onCommand = e.target.value
                })} />
            </div>
            <div>
                <TextField label={'Off command'} style={{ width: '100%' }} value={data.offCommand} onChange={(e) => setData((draft) => {
                    draft.offCommand = e.target.value
                })} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <DialogButton style={{ flex: 1 }}
                              onButtonUp={(e) => { if(e.detail.button === 1) submit(); }}
                              onMouseUp={submit}>
                    Add launch option
                </DialogButton>
            </div>
        </div>
    )
}

function UpdateLaunchOptionForm({ data, configContext }: { data: LaunchOption, configContext: ReturnType<typeof useConfig>}) {
    const {updateLaunchOption, deleteLaunchOption} = configContext
    function deleteLO() {
        return deleteLaunchOption(data.id)
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <form onSubmit={() => {}}>
                <div>
                    <TextField label={'Name'} style={{ width: '100%' }} value={data.name} onChange={(e) => updateLaunchOption(data, 'name', e.target.value)} />
                </div>
                <div>
                    <TextField label={'On command'} style={{ width: '100%' }} value={data.onCommand} onChange={(e) => updateLaunchOption(data, 'onCommand', e.target.value)} />
                </div>
                <div>
                    <TextField label={'Off command'} style={{ width: '100%' }} value={data.offCommand} onChange={(e) => updateLaunchOption(data, 'offCommand', e.target.value)}/>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <DialogButton style={{ flex: 1 }}
                                  onButtonUp={(e) => { if(e.detail.button === 1) deleteLO(); }}
                                  onMouseUp={deleteLO}>
                        Remove launch option
                    </DialogButton>
                </div>
            </form>
        </div>
    )
}

export function LaunchOptionsPage() {
    const configContext = useConfig()
    return (
        <div
            style={{
                marginTop: "40px",
                height: "calc(100% - 40px)",
                background: "#0005",
            }}
        >
            <SidebarNavigation
                title={'Manage launch options'}
                pages={[
                    {
                        title: 'Add launch option',
                        content: <CreateLaunchOptionForm configContext={ configContext }/>,
                    },
                    ...configContext.config.launchOptions.map((launchOption) => ({
                        title: launchOption.name || launchOption.id,
                        content: <UpdateLaunchOptionForm configContext={ configContext } key={launchOption.id} data={launchOption} />
                    }))
                ]}
            />
        </div>
    )
}