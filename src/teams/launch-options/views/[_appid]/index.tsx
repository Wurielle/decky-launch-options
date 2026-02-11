import {
    ButtonItem,
    DialogBody,
    DialogButton,
    DialogHeader,
    Field,
    findModule,
    Focusable,
    ModalRoot,
    PanelSectionRow,
    showModal,
    Tabs,
    TextField,
    ToggleField,
    useParams,
} from '@decky/ui'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useSettings} from '../../../../hooks'
import {FaPen} from 'react-icons/fa'
import {UpdateLaunchOptionForm} from "../../../../components/update-launch-option-form";
import {PluginProvider} from "../../../../components/plugin-provider";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "../../../../query";
import {CreateLaunchOptionForm} from "../../../../components/create-launch-option-form";

export function AppLaunchOptionsPage() {
    const {appid} = useParams<{ appid: string }>()
    const [tab, setTab] = useState<'local' | 'global'>('local')
    const {
        settings,
        getAppLaunchOptionState,
        setAppLaunchOptionState,
        getAppOriginalLaunchOptions,
        setAppOriginalLaunchOptions,
    } = useSettings()
    const localLaunchOptions = useMemo(() => {
        return settings.launchOptions.filter((item) => !item.enableGlobally)
    }, [settings])
    const globalLaunchOptions = useMemo(() => {
        return settings.launchOptions.filter((item) => item.enableGlobally)
    }, [settings])
    const {TabCount} = findModule((mod) => {
        if (typeof mod !== 'object') return false

        if (mod.TabCount && mod.TabTitle) {
            return true
        }

        return false
    })

    // this fixes weird issues when switching tab by forcing the blur on the active element (no document.activeElement.blur doesn't work)
    const [readyToShow, setReadyToShow] = useState(true)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        if (timeoutRef.current) clearInterval(timeoutRef.current)
        timeoutRef.current = setInterval(() => {
            setReadyToShow(true)
        }, 100)
        setReadyToShow(false)
    }, [tab])

    const showCreateLaunchOptionFormModal = useCallback(() => {
        const modalResult = showModal(
            (
                <ModalRoot onCancel={() => modalResult.Close()}>
                    <DialogHeader>
                        Add launch option
                    </DialogHeader>
                    <DialogBody>
                        <QueryClientProvider client={queryClient}>
                            <PluginProvider>
                                <CreateLaunchOptionForm
                                    defaultValue={{
                                        enableGlobally: tab === 'global'
                                    }}
                                    onSubmit={() => modalResult.Close()}
                                />
                            </PluginProvider>
                        </QueryClientProvider>
                    </DialogBody>
                </ModalRoot>
            ),
        );
    }, [tab])

    const showUpdateLaunchOptionFormModal = useCallback((id: string) => {
        const modalResult = showModal(
            (
                <ModalRoot onCancel={() => modalResult.Close()}>
                    <DialogHeader>
                        Edit launch option
                    </DialogHeader>
                    <DialogBody>
                        <QueryClientProvider client={queryClient}>
                            <PluginProvider>
                                <UpdateLaunchOptionForm
                                    id={id}
                                    onDelete={() => modalResult.Close()}
                                />
                            </PluginProvider>
                        </QueryClientProvider>
                    </DialogBody>
                </ModalRoot>
            ),
        );
    }, [])
    return (
        <div
            style={{
                marginTop: "40px",
                height: "calc(100% - 40px - 42px)",
                overflow: "hidden",
            }}
        >
            <Tabs activeTab={tab} onShowTab={setTab} tabs={[
                {
                    id: 'local',
                    title: 'Locally enabled',
                    content: (
                        readyToShow &&
                        <Focusable style={{height: '100%'}}>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={() => {
                                        showCreateLaunchOptionFormModal()
                                    }}
                                >
                                    Add launch option
                                </ButtonItem>
                            </PanelSectionRow>
                            <Field label={'Original launch options'}>
                                <TextField
                                    value={getAppOriginalLaunchOptions(appid)}
                                    onChange={(e) => setAppOriginalLaunchOptions(appid, e.target.value)}
                                    style={{width: 400}}/>
                            </Field>
                            {localLaunchOptions.map((launchOption) => (
                                <Focusable style={{display: 'flex', gap: 10}}>
                                    <Focusable style={{flex: 1}}>
                                        <ToggleField
                                            checked={getAppLaunchOptionState(appid, launchOption.id)}
                                            onChange={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                            description={<span
                                                style={{color: 'oklch(55.4% 0.046 257.417)'}}>{[launchOption.on && `ON: ${launchOption.on}`, launchOption.off && `OFF: ${launchOption.off}`].filter(Boolean).join(' | ') || 'None'}</span>}
                                            label={launchOption.name}/>
                                    </Focusable>
                                    <Focusable style={{flexShrink: 0, padding: '10px 0'}}>
                                        <DialogButton
                                            style={{minWidth: 46, height: 46, padding: 0}}
                                            onClick={() => showUpdateLaunchOptionFormModal(launchOption.id)}
                                        >
                                            <FaPen/>
                                        </DialogButton>
                                    </Focusable>
                                </Focusable>
                            ))}
                        </Focusable>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{localLaunchOptions.filter((launchOption) => getAppLaunchOptionState(appid, launchOption.id)).length + (Number(!!getAppOriginalLaunchOptions(appid)))}</span>,
                },
                {
                    id: 'global',
                    title: 'Globally enabled',
                    content: (
                        readyToShow &&
                        <Focusable style={{height: '100%'}}>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={() => {
                                        showCreateLaunchOptionFormModal()
                                    }}
                                >
                                    Add launch option
                                </ButtonItem>
                            </PanelSectionRow>
                            {globalLaunchOptions.map((launchOption) => (
                                <Focusable style={{display: 'flex', gap: 10}}>
                                    <Focusable style={{flex: 1}}>
                                        <ToggleField
                                            checked={getAppLaunchOptionState(appid, launchOption.id)}
                                            onChange={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                            description={<span
                                                style={{color: 'oklch(55.4% 0.046 257.417)'}}>{[launchOption.on && `ON: ${launchOption.on}`, launchOption.off && `OFF: ${launchOption.off}`].filter(Boolean).join(' | ') || 'None'}</span>}
                                            label={launchOption.name}/>
                                    </Focusable>
                                    <Focusable style={{flexShrink: 0, padding: '10px 0'}}>
                                        <DialogButton
                                            style={{minWidth: 46, height: 46, padding: 0}}
                                            onClick={() => showUpdateLaunchOptionFormModal(launchOption.id)}
                                        >
                                            <FaPen/>
                                        </DialogButton>
                                    </Focusable>
                                </Focusable>
                            ))}
                        </Focusable>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{globalLaunchOptions.filter((launchOption) => launchOption.enableGlobally && getAppLaunchOptionState(appid, launchOption.id)).length}</span>,
                },
            ]}/>
        </div>
    )

}