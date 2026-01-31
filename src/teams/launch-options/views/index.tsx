import {
    ConfirmModal,
    DialogButton,
    showModal,
    SidebarNavigation,
    SteamSpinner,
    TextField,
    ToggleField,
} from '@decky/ui'
import {useSettings} from '../../../hooks'
import {useImmer} from 'use-immer'
import {v4 as uuid} from 'uuid'
import {FaPlus, FaTerminal} from "react-icons/fa"
import {LaunchOption} from '../../../shared'
import {PluginProvider, usePlugin} from '../../../components/plugin-provider'
import {RefObject, ReactNode, useCallback, useMemo, useRef, HTMLAttributes} from "react";

// this isn't 100% robust, but it's better than the behavior without this
function ScrollIntoView(props: Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    children: (context: {
        ref: RefObject<HTMLDivElement | null>
        scrollIntoView: (event?: any) => void
    }) => ReactNode
}) {
    const {children, ...rootProps} = props
    const ref = useRef<HTMLDivElement>(null)
    const scrollIntoView = useCallback((event?: any) => {
        const block = (window.SteamUIStore.GetFocusedWindowInstance() as any).VirtualKeyboardManager.KeyboardLocation.includes('top') ? 'start' : 'end'
        const element = (event?.target || ref.current) as HTMLElement
        element?.scrollIntoView?.({behavior: 'instant', block})
    }, [])
    return <div ref={ref} {...rootProps}>
        {props.children({ref, scrollIntoView})}
    </div>
}

function CreateLaunchOptionForm() {
    const {createLaunchOption} = usePlugin().settings
    const [data, setData] = useImmer<Omit<LaunchOption, 'id'>>({
        name: '',
        on: '',
        off: '',
        enableGlobally: false,
    })

    function submit() {
        createLaunchOption({
            id: uuid(),
            ...data,
        })
        setData({
            name: '',
            on: '',
            off: '',
            enableGlobally: false,
        })
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
                        label={'On'}
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
                        label={'Off'}
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

function UpdateLaunchOptionForm({id}: {
    id: string,
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
                    return deleteLaunchOption(data.id)
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
                        label={'On'}
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
                        label={'Off'}
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

export function LaunchOptionsPage() {
    const {settings, loading} = useSettings()
    return (
        <PluginProvider>
            <div
                style={{
                    marginTop: "40px",
                    height: "calc(100% - 40px)",
                }}
            >
                {
                    loading ? (
                        <SteamSpinner width={"100%"} height={"100%"}/>
                    ) : (
                        <SidebarNavigation
                            title={'Launch options'}
                            showTitle={true}
                            pages={[
                                {
                                    icon: <FaPlus/>,
                                    title: 'New launch option',
                                    content: <CreateLaunchOptionForm/>,
                                },
                                ...settings.launchOptions.map(({id, name}) => ({
                                    icon: <FaTerminal/>,
                                    title: name || 'Unnamed',
                                    content: <UpdateLaunchOptionForm
                                        key={id || ''}
                                        id={id}
                                    />,
                                })),
                            ]}
                        />
                    )
                }
            </div>
        </PluginProvider>
    )
}