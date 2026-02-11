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
import {LaunchOption} from "../../../../shared";

interface ModalWrapperProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

function ModalWrapper({title, children, onClose}: ModalWrapperProps) {
    return (
        <ModalRoot onCancel={onClose}>
            <DialogHeader>{title}</DialogHeader>
            <DialogBody>
                <QueryClientProvider client={queryClient}>
                    <PluginProvider>
                        {children}
                    </PluginProvider>
                </QueryClientProvider>
            </DialogBody>
        </ModalRoot>
    );
}

interface LaunchOptionItemProps {
    launchOption: LaunchOption;
    isChecked: boolean;
    onToggle: (value: boolean) => void;
    onEdit: () => void;
}

function LaunchOptionItem({launchOption, isChecked, onToggle, onEdit}: LaunchOptionItemProps) {
    const activeColor = 'oklch(80.9% 0.105 251.813)'
    const description = (
        <span style={{color: 'oklch(55.4% 0.046 257.417)'}}>
            {launchOption.on && (
                <span style={{color: isChecked ? activeColor : undefined}}>
                    ON: {launchOption.on}
                </span>
            )}
            {launchOption.on && launchOption.off && ' | '}
            {launchOption.off && (
                <span style={{color: !isChecked ? activeColor : undefined}}>
                    OFF: {launchOption.off}
                </span>
            )}
            {!launchOption.on && !launchOption.off && 'None'}
        </span>
    );

    return (
        <Focusable style={{display: 'flex', gap: 10}}>
            <Focusable style={{flex: 1}}>
                <ToggleField
                    checked={isChecked}
                    onChange={onToggle}
                    description={description}
                    label={launchOption.name}
                />
            </Focusable>
            <Focusable style={{flexShrink: 0, padding: '10px 0'}}>
                <DialogButton
                    style={{minWidth: 46, height: 46, padding: 0}}
                    onClick={onEdit}
                >
                    <FaPen/>
                </DialogButton>
            </Focusable>
        </Focusable>
    );
}

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
        return settings.launchOptions.filter((item) => !item.enableGlobally).sort((a, b) => a.name.localeCompare(b.name))
    }, [settings])
    const globalLaunchOptions = useMemo(() => {
        return settings.launchOptions.filter((item) => item.enableGlobally).sort((a, b) => a.name.localeCompare(b.name))
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
            <ModalWrapper title="Add launch option" onClose={() => modalResult.Close()}>
                <CreateLaunchOptionForm
                    defaultValue={{enableGlobally: tab === 'global'}}
                    onSubmit={() => modalResult.Close()}
                />
            </ModalWrapper>
        );
    }, [tab])

    const showUpdateLaunchOptionFormModal = useCallback((id: string) => {
        const modalResult = showModal(
            <ModalWrapper title="Edit launch option" onClose={() => modalResult.Close()}>
                <UpdateLaunchOptionForm
                    id={id}
                    onDelete={() => modalResult.Close()}
                />
            </ModalWrapper>
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
                                <LaunchOptionItem
                                    key={launchOption.id}
                                    launchOption={launchOption}
                                    isChecked={getAppLaunchOptionState(appid, launchOption.id)}
                                    onToggle={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                    onEdit={() => showUpdateLaunchOptionFormModal(launchOption.id)}
                                />
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
                                <LaunchOptionItem
                                    key={launchOption.id}
                                    launchOption={launchOption}
                                    isChecked={getAppLaunchOptionState(appid, launchOption.id)}
                                    onToggle={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                    onEdit={() => showUpdateLaunchOptionFormModal(launchOption.id)}
                                />
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