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

interface HierarchicalLaunchOption {
    launchOption: LaunchOption;
    displayName: string;
    indentLevel: number;
}

function buildHierarchy(options: LaunchOption[]): HierarchicalLaunchOption[] {
    const result: HierarchicalLaunchOption[] = [];

    // Track which options have been processed as children
    const processed = new Set<string>();

    function findChildren(parent: LaunchOption, parentIndent: number, parentPrefix: string): HierarchicalLaunchOption[] {
        const children: HierarchicalLaunchOption[] = [];

        for (const option of options) {
            if (processed.has(option.id) || option.id === parent.id) continue;

            // Check if this option starts with the parent's name (plus a space)
            if (option.name.startsWith(parentPrefix + ' ')) {
                processed.add(option.id);
                const displayName = option.name.substring(parentPrefix.length + 1).trim();

                children.push({
                    launchOption: option,
                    displayName,
                    indentLevel: parentIndent + 1
                });

                // Recursively find children of this child
                const grandchildren = findChildren(option, parentIndent + 1, option.name);
                children.push(...grandchildren);
            }
        }

        return children;
    }

    // First pass: identify root-level items and build hierarchy
    for (const option of options) {
        if (processed.has(option.id)) continue;

        // Add the root item
        result.push({
            launchOption: option,
            displayName: option.name,
            indentLevel: 0
        });
        processed.add(option.id);

        // Find and add all children recursively
        const children = findChildren(option, 0, option.name);
        result.push(...children);
    }

    return result;
}

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
    displayName: string;
    indentLevel: number;
    isChecked: boolean;
    onToggle: (value: boolean) => void;
    onEdit: () => void;
}

function LaunchOptionItem({
                              launchOption,
                              displayName,
                              indentLevel,
                              isChecked,
                              onToggle,
                              onEdit
                          }: LaunchOptionItemProps) {
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
                    indentLevel={indentLevel}
                    checked={isChecked}
                    onChange={onToggle}
                    description={description}
                    label={displayName}
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
    const [enableHierarchy] = useState(false)
    const {
        settings,
        getAppLaunchOptionState,
        setAppLaunchOptionState,
        getAppOriginalLaunchOptions,
        setAppOriginalLaunchOptions,
    } = useSettings()
    const localLaunchOptions = useMemo(() => {
        const filtered = settings.launchOptions.filter((item) => !item.enableGlobally).sort((a, b) => a.name.localeCompare(b.name))
        return enableHierarchy ? buildHierarchy(filtered) : filtered.map(item => ({
            launchOption: item,
            displayName: item.name,
            indentLevel: 0
        }))
    }, [settings, enableHierarchy])
    const globalLaunchOptions = useMemo(() => {
        const filtered = settings.launchOptions.filter((item) => item.enableGlobally).sort((a, b) => a.name.localeCompare(b.name))
        return enableHierarchy ? buildHierarchy(filtered) : filtered.map(item => ({
            launchOption: item,
            displayName: item.name,
            indentLevel: 0
        }))
    }, [settings, enableHierarchy])
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
                            {localLaunchOptions.map((item) => (
                                <LaunchOptionItem
                                    key={item.launchOption.id}
                                    launchOption={item.launchOption}
                                    displayName={item.displayName}
                                    indentLevel={item.indentLevel}
                                    isChecked={getAppLaunchOptionState(appid, item.launchOption.id)}
                                    onToggle={(value) => setAppLaunchOptionState(appid, item.launchOption.id, value)}
                                    onEdit={() => showUpdateLaunchOptionFormModal(item.launchOption.id)}
                                />
                            ))}
                        </Focusable>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{localLaunchOptions.filter((item) => getAppLaunchOptionState(appid, item.launchOption.id)).length + (Number(!!getAppOriginalLaunchOptions(appid)))}</span>,
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
                            {globalLaunchOptions.map((item) => (
                                <LaunchOptionItem
                                    key={item.launchOption.id}
                                    launchOption={item.launchOption}
                                    displayName={item.displayName}
                                    indentLevel={item.indentLevel}
                                    isChecked={getAppLaunchOptionState(appid, item.launchOption.id)}
                                    onToggle={(value) => setAppLaunchOptionState(appid, item.launchOption.id, value)}
                                    onEdit={() => showUpdateLaunchOptionFormModal(item.launchOption.id)}
                                />
                            ))}
                        </Focusable>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{globalLaunchOptions.filter((item) => item.launchOption.enableGlobally && getAppLaunchOptionState(appid, item.launchOption.id)).length}</span>,
                },
            ]}/>
        </div>
    )

}