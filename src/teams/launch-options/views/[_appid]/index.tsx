import {
    ButtonItem,
    DialogBody,
    DialogButton,
    DialogHeader,
    DropdownItem,
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
import { SingleDropdownOption } from '@decky/ui/dist/components/Dropdown'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../../../hooks'
import { FaPen } from 'react-icons/fa'
import { UpdateLaunchOptionForm } from "../../../../components/update-launch-option-form"
import { PluginProvider } from "../../../../components/plugin-provider"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "../../../../query"
import { CreateLaunchOptionForm } from "../../../../components/create-launch-option-form"
import { LaunchOption } from "../../../../shared"
import { settingsStore } from "../../../../stores"
import { useStore } from "@tanstack/react-store"

interface HierarchicalLaunchOption {
    launchOption: LaunchOption;
    displayName: string;
    indentLevel: number;
}

function buildHierarchy(options: LaunchOption[]): HierarchicalLaunchOption[] {
    const result: HierarchicalLaunchOption[] = []

    // Track which options have been processed as children
    const processed = new Set<string>()

    function findChildren(parent: LaunchOption, parentIndent: number, parentPrefix: string): HierarchicalLaunchOption[] {
        const children: HierarchicalLaunchOption[] = []

        for (const option of options) {
            if (processed.has(option.id) || option.id === parent.id) continue

            // Check if this option starts with the parent's name (plus a space)
            if (option.name.startsWith(parentPrefix+' ')) {
                processed.add(option.id)
                const displayName = option.name.substring(parentPrefix.length+1).trim()

                children.push({
                    launchOption: option,
                    displayName,
                    indentLevel: parentIndent+1,
                })

                // Recursively find children of this child
                const grandchildren = findChildren(option, parentIndent+1, option.name)
                children.push(...grandchildren)
            }
        }

        return children
    }

    // First pass: identify root-level items and build hierarchy
    for (const option of options) {
        if (processed.has(option.id)) continue

        // Add the root item
        result.push({
            launchOption: option,
            displayName: option.name,
            indentLevel: 0,
        })
        processed.add(option.id)

        // Find and add all children recursively
        const children = findChildren(option, 0, option.name)
        result.push(...children)
    }

    return result
}

interface ModalWrapperProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

function ModalWrapper({ title, children, onClose }: ModalWrapperProps) {
    return (
        <ModalRoot onCancel={ onClose }>
            <DialogHeader>{ title }</DialogHeader>
            <DialogBody>
                <QueryClientProvider client={ queryClient }>
                    <PluginProvider>
                        { children }
                    </PluginProvider>
                </QueryClientProvider>
            </DialogBody>
        </ModalRoot>
    )
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
                              onEdit,
                          }: LaunchOptionItemProps) {
    const activeColor = 'oklch(80.9% 0.105 251.813)'
    const description = (
        <span style={ { color: 'oklch(55.4% 0.046 257.417)' } }>
            { launchOption.on && (
                <span style={ { color: isChecked ? activeColor : undefined } }>
                    ON: { launchOption.on }
                </span>
            ) }
            { launchOption.on && launchOption.off && ' | ' }
            { launchOption.off && (
                <span style={ { color: !isChecked ? activeColor : undefined } }>
                    OFF: { launchOption.off }
                </span>
            ) }
            { !launchOption.on && !launchOption.off && 'None' }
        </span>
    )

    return (
        <Focusable style={ { display: 'flex', gap: 10 } }>
            <Focusable style={ { flex: 1 } }>
                <ToggleField
                    indentLevel={ indentLevel }
                    checked={ isChecked }
                    onChange={ onToggle }
                    description={ description }
                    label={ displayName }
                />
            </Focusable>
            <Focusable style={ { flexShrink: 0, padding: '10px 0' } }>
                <DialogButton
                    style={ { minWidth: 46, height: 46, padding: 0 } }
                    onClick={ onEdit }
                >
                    <FaPen/>
                </DialogButton>
            </Focusable>
        </Focusable>
    )
}

interface ValueIdSelectItemProps {
    valueId: string;
    launchOptions: LaunchOption[];
    displayName: string;
    indentLevel: number;
    appid: string;
    getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean;
    setAppValueIdState: (appid: string, valueId: string, selectedLaunchOptionId: string | null) => void;
    onEdit: (id: string) => void;
}

function ValueIdSelectItem({
                               valueId,
                               launchOptions,
                               displayName,
                               indentLevel,
                               appid,
                               getAppLaunchOptionState,
                               setAppValueIdState,
                               onEdit,
                           }: ValueIdSelectItemProps) {
    const activeColor = 'oklch(80.9% 0.105 251.813)'

    const selectedOption = launchOptions.find((lo) => getAppLaunchOptionState(appid, lo.id))
    const selectedId = selectedOption?.id ?? null

    const rgOptions = [
        { data: null, label: 'Disabled' },
        ...launchOptions.map((lo) => ({
            data: lo.id,
            label: lo.valueName || lo.on || lo.name,
        })),
    ]

    const description = (
        <span style={ { color: 'oklch(55.4% 0.046 257.417)' } }>
            { selectedOption ? (
                <span style={ { color: activeColor } }>
                    ON: { selectedOption.on }
                </span>
            ) : (
                'Disabled'
            ) }
        </span>
    )

    return (
        <Focusable style={ { display: 'flex', gap: 10 } }>
            <Focusable style={ { flex: 1 } }>
                <DropdownItem
                    indentLevel={ indentLevel }
                    label={ displayName }
                    description={ description }
                    rgOptions={ rgOptions }
                    selectedOption={ selectedId }
                    onChange={ (option: SingleDropdownOption) => {
                        setAppValueIdState(appid, valueId, option.data)
                    } }
                />
            </Focusable>
            <Focusable style={ { flexShrink: 0, padding: '10px 0' } }>
                <DialogButton
                    style={ { minWidth: 46, height: 46, padding: 0 } }
                    onClick={ () => onEdit(selectedOption?.id ?? launchOptions[0].id) }
                >
                    <FaPen/>
                </DialogButton>
            </Focusable>
        </Focusable>
    )
}

interface RenderItemsParams {
    items: HierarchicalLaunchOption[];
    appid: string;
    getAppLaunchOptionState: (appid: string, launchOptionId: string) => boolean;
    setAppLaunchOptionState: (appid: string, launchOptionId: string, value: boolean) => void;
    setAppValueIdState: (appid: string, valueId: string, selectedLaunchOptionId: string | null) => void;
    onEdit: (id: string) => void;
}

function renderLaunchOptionItems({
                                     items,
                                     appid,
                                     getAppLaunchOptionState,
                                     setAppLaunchOptionState,
                                     setAppValueIdState,
                                     onEdit,
                                 }: RenderItemsParams) {
    const result: React.ReactNode[] = []
    const processedValueIds = new Set<string>()

    for (const item of items) {
        const { launchOption } = item

        // If this item has a valueId, render it as part of a dropdown group
        if (launchOption.valueId) {
            if (processedValueIds.has(launchOption.valueId)) continue
            processedValueIds.add(launchOption.valueId)

            // Collect all items in this list that share the same valueId
            const siblings = items
                .filter((i) => i.launchOption.valueId === launchOption.valueId)
                .map((i) => i.launchOption)

            result.push(
                <ValueIdSelectItem
                    key={ `valueId-${launchOption.valueId}` }
                    valueId={ launchOption.valueId }
                    launchOptions={ siblings }
                    displayName={ item.displayName }
                    indentLevel={ item.indentLevel }
                    appid={ appid }
                    getAppLaunchOptionState={ getAppLaunchOptionState }
                    setAppValueIdState={ setAppValueIdState }
                    onEdit={ onEdit }
                />
            )
        } else {
            // Normal toggle item
            result.push(
                <LaunchOptionItem
                    key={ launchOption.id }
                    launchOption={ launchOption }
                    displayName={ item.displayName }
                    indentLevel={ item.indentLevel }
                    isChecked={ getAppLaunchOptionState(appid, launchOption.id) }
                    onToggle={ (value) => setAppLaunchOptionState(appid, launchOption.id, value) }
                    onEdit={ () => onEdit(launchOption.id) }
                />
            )
        }
    }

    return result
}

/**
 * Count active launch options, treating valueId groups as at most 1.
 */
function countActiveLaunchOptions(
    launchOptions: LaunchOption[],
    appProfile: { state: Record<string, boolean> } | undefined,
    filter?: (item: LaunchOption) => boolean,
): number {
    const filtered = filter ? launchOptions.filter(filter) : launchOptions
    const countedValueIds = new Set<string>()
    let count = 0

    for (const item of filtered) {
        const state = appProfile?.state?.[item.id]
        const isActive = state !== undefined ? state : !!item.enableGlobally
        const hasCommand = isActive ? !!item.on : !!item.off

        if (!hasCommand) continue

        if (item.valueId) {
            if (countedValueIds.has(item.valueId)) continue
            countedValueIds.add(item.valueId)
        }

        count++
    }

    return count
}

export function AppLaunchOptionsPage() {
    const { appid } = useParams<{ appid: string }>()
    const [tab, setTab] = useState<string>('local')
    const useHierarchy = useStore(settingsStore, (state) => state.useHierarchy)
    const {
        settings,
        getAppLaunchOptionState,
        setAppLaunchOptionState,
        setAppValueIdState,
        getAppOriginalLaunchOptions,
        setAppOriginalLaunchOptions,
    } = useSettings()
    const groups = useMemo(() => {
        const groupSet = new Set<string>()
        settings.launchOptions.forEach((item) => {
            if (item.group) groupSet.add(item.group)
        })
        return Array.from(groupSet).sort((a, b) => a.localeCompare(b))
    }, [settings])
    const groupedLaunchOptions = useMemo(() => {
        const map: Record<string, { local: HierarchicalLaunchOption[], global: HierarchicalLaunchOption[] }> = {}
        for (const group of groups) {
            const inGroup = settings.launchOptions
                .filter((item) => item.group === group)
                .sort((a, b) => a.name.localeCompare(b.name))
            const localFiltered = inGroup.filter((item) => !item.enableGlobally)
            const globalFiltered = inGroup.filter((item) => item.enableGlobally)
            map[group] = {
                local: useHierarchy ? buildHierarchy(localFiltered) : localFiltered.map(item => ({
                    launchOption: item,
                    displayName: item.name,
                    indentLevel: 0,
                })),
                global: useHierarchy ? buildHierarchy(globalFiltered) : globalFiltered.map(item => ({
                    launchOption: item,
                    displayName: item.name,
                    indentLevel: 0,
                })),
            }
        }
        return map
    }, [settings, groups, useHierarchy])
    const localLaunchOptions = useMemo(() => {
        const filtered = settings.launchOptions.filter((item) => !item.enableGlobally && !item.group).sort((a, b) => a.name.localeCompare(b.name))
        return useHierarchy ? buildHierarchy(filtered) : filtered.map(item => ({
            launchOption: item,
            displayName: item.name,
            indentLevel: 0,
        }))
    }, [settings, useHierarchy])
    const globalLaunchOptions = useMemo(() => {
        const filtered = settings.launchOptions.filter((item) => item.enableGlobally && !item.group).sort((a, b) => a.name.localeCompare(b.name))
        return useHierarchy ? buildHierarchy(filtered) : filtered.map(item => ({
            launchOption: item,
            displayName: item.name,
            indentLevel: 0,
        }))
    }, [settings, useHierarchy])
    const { TabCount } = findModule((mod) => {
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
        const isGroupTab = tab !== 'local' && tab !== 'global'
        const modalResult = showModal(
            <ModalWrapper title="Add launch option" onClose={ () => modalResult.Close() }>
                <CreateLaunchOptionForm
                    defaultValue={ {
                        enableGlobally: tab === 'global',
                        ...(isGroupTab ? { group: tab } : {}),
                    } }
                    onSubmit={ () => modalResult.Close() }
                />
            </ModalWrapper>,
        )
    }, [tab])

    const showUpdateLaunchOptionFormModal = useCallback((id: string) => {
        const modalResult = showModal(
            <ModalWrapper title="Edit launch option" onClose={ () => modalResult.Close() }>
                <UpdateLaunchOptionForm
                    id={ id }
                    onDelete={ () => modalResult.Close() }
                />
            </ModalWrapper>,
        )
    }, [])

    return (
        <div
            style={ {
                marginTop: "40px",
                height: "calc(100% - 40px - 42px)",
                overflow: "hidden",
            } }
        >
            <Tabs activeTab={ tab } onShowTab={ setTab } tabs={ [
                ...groups.map((group) => ({
                    id: group,
                    title: group,
                    content: (
                        readyToShow &&
                        <Focusable style={ { height: '100%' } }>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={ () => {
                                        showCreateLaunchOptionFormModal()
                                    } }
                                >
                                    Add launch option
                                </ButtonItem>
                            </PanelSectionRow>
                            { groupedLaunchOptions[group]?.global.length > 0 && (
                                <div>
                                    <div style={ { marginTop: '16px' } }>
                                        <strong>Global</strong>
                                    </div>
                                    { renderLaunchOptionItems({
                                        items: groupedLaunchOptions[group].global,
                                        appid,
                                        getAppLaunchOptionState,
                                        setAppLaunchOptionState,
                                        setAppValueIdState,
                                        onEdit: showUpdateLaunchOptionFormModal,
                                    }) }
                                </div>
                            ) }
                            { groupedLaunchOptions[group]?.local.length > 0 && (
                                <div>
                                    <div style={ { marginTop: '16px' } }>
                                        <strong>Local</strong>
                                    </div>
                                    { renderLaunchOptionItems({
                                        items: groupedLaunchOptions[group].local,
                                        appid,
                                        getAppLaunchOptionState,
                                        setAppLaunchOptionState,
                                        setAppValueIdState,
                                        onEdit: showUpdateLaunchOptionFormModal,
                                    }) }
                                </div>
                            ) }
                        </Focusable>
                    ),
                    renderTabAddon: () => {
                        const appProfile = settings.profiles[appid]
                        const count = countActiveLaunchOptions(
                            settings.launchOptions,
                            appProfile,
                            (item) => item.group === group,
                        )
                        return <span className={ TabCount }>{ count }</span>
                    },
                })),
                {
                    id: 'local',
                    title: 'Local',
                    content: (
                        readyToShow &&
                        <Focusable style={ { height: '100%' } }>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={ () => {
                                        showCreateLaunchOptionFormModal()
                                    } }
                                >
                                    Add launch option
                                </ButtonItem>
                            </PanelSectionRow>
                            <Field label={ 'Original launch options' }>
                                <TextField
                                    value={ getAppOriginalLaunchOptions(appid) }
                                    onChange={ (e) => setAppOriginalLaunchOptions(appid, e.target.value) }
                                    style={ { width: 400 } }/>
                            </Field>
                            { renderLaunchOptionItems({
                                items: localLaunchOptions,
                                appid,
                                getAppLaunchOptionState,
                                setAppLaunchOptionState,
                                setAppValueIdState,
                                onEdit: showUpdateLaunchOptionFormModal,
                            }) }
                        </Focusable>
                    ),
                    renderTabAddon: () => {
                        const appProfile = settings.profiles[appid]
                        const count = countActiveLaunchOptions(
                            settings.launchOptions,
                            appProfile,
                            (item) => !item.enableGlobally && !item.group,
                        )
                        return <span className={ TabCount }>{ count + (Number(!!getAppOriginalLaunchOptions(appid))) }</span>
                    },
                },
                {
                    id: 'global',
                    title: 'Global',
                    content: (
                        readyToShow &&
                        <Focusable style={ { height: '100%' } }>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={ () => {
                                        showCreateLaunchOptionFormModal()
                                    } }
                                >
                                    Add launch option
                                </ButtonItem>
                            </PanelSectionRow>
                            { renderLaunchOptionItems({
                                items: globalLaunchOptions,
                                appid,
                                getAppLaunchOptionState,
                                setAppLaunchOptionState,
                                setAppValueIdState,
                                onEdit: showUpdateLaunchOptionFormModal,
                            }) }
                        </Focusable>
                    ),
                    renderTabAddon: () => {
                        const appProfile = settings.profiles[appid]
                        const count = countActiveLaunchOptions(
                            settings.launchOptions,
                            appProfile,
                            (item) => item.enableGlobally && !item.group,
                        )
                        return <span className={ TabCount }>{ count }</span>
                    },
                },
            ] }/>
        </div>
    )

}