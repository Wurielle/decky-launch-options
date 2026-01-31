import {
    ButtonItem,
    Field,
    findModule,
    Navigation,
    PanelSectionRow,
    Tabs,
    TextField,
    ToggleField,
    useParams,
} from '@decky/ui'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useSettings} from '../../../../hooks'
import {routes} from '../../../../shared'

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
    return (
        <div
            style={{
                marginTop: "40px",
                height: "calc(100% - 40px)",
                overflow: "hidden",
            }}
        >
            <Tabs activeTab={tab} onShowTab={setTab} tabs={[
                {
                    id: 'local',
                    title: 'Locally enabled',
                    content: (
                        readyToShow &&
                        <div>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={() => {
                                        Navigation.Navigate(routes.launchOptions())
                                        Navigation.CloseSideMenus()
                                    }}
                                >
                                    Manage launch options
                                </ButtonItem>
                            </PanelSectionRow>
                            <Field label={'Original launch options'}>
                                <TextField
                                    value={getAppOriginalLaunchOptions(appid)}
                                    onChange={(e) => setAppOriginalLaunchOptions(appid, e.target.value)}
                                    style={{width: 400}}/>
                            </Field>
                            {localLaunchOptions.map((launchOption) => (
                                <div>
                                    <ToggleField
                                        checked={getAppLaunchOptionState(appid, launchOption.id)}
                                        onChange={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                        description={[launchOption.on && `ON: ${launchOption.on}`, launchOption.off && `OFF: ${launchOption.off}`].filter(Boolean).join(' | ')}
                                        label={launchOption.name}/>
                                </div>
                            ))}
                        </div>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{localLaunchOptions.filter((launchOption) => getAppLaunchOptionState(appid, launchOption.id)).length + (Number(!!getAppOriginalLaunchOptions(appid)))}</span>,
                },
                {
                    id: 'global',
                    title: 'Globally enabled',
                    content: (
                        readyToShow &&
                        <div>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={() => {
                                        Navigation.Navigate(routes.launchOptions())
                                        Navigation.CloseSideMenus()
                                    }}
                                >
                                    Manage launch options
                                </ButtonItem>
                            </PanelSectionRow>
                            {globalLaunchOptions.map((launchOption) => (
                                <div>
                                    <ToggleField
                                        checked={getAppLaunchOptionState(appid, launchOption.id)}
                                        onChange={(value) => setAppLaunchOptionState(appid, launchOption.id, value)}
                                        description={[launchOption.on && `ON: ${launchOption.on}`, launchOption.off && `OFF: ${launchOption.off}`].filter(Boolean).join(' | ')}
                                        label={launchOption.name}/>
                                </div>
                            ))}
                        </div>
                    ),
                    renderTabAddon: () => <span
                        className={TabCount}>{globalLaunchOptions.filter((launchOption) => launchOption.enableGlobally && getAppLaunchOptionState(appid, launchOption.id)).length}</span>,
                },
            ]}/>
        </div>
    )

}