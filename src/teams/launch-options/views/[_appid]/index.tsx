import { ButtonItem, findModule, Navigation, PanelSectionRow, Tabs, ToggleField, useParams } from '@decky/ui'
import { useMemo, useState } from 'react'
import { useConfig } from '../../../../hooks'
import { routes } from '../../../../shared'

export function AppLaunchOptionsPage() {
    const { appid } = useParams<{ appid: string }>()
    const [tab, setTab] = useState<'local' | 'global'>('local')
    const { config, getAppLaunchOptionState, setAppLaunchOptionState } = useConfig()
    const localLaunchOptions = useMemo(() => {
        return config.launchOptions.filter((item) => !item.enableGlobally)
    }, [config])
    const globalLaunchOptions = useMemo(() => {
        return config.launchOptions.filter((item) => item.enableGlobally)
    }, [config])
    const { TabCount } = findModule((mod) => {
        if (typeof mod !== 'object') return false

        if (mod.TabCount && mod.TabTitle) {
            return true
        }

        return false
    })
    console.log(appid)
    return (
        <div
            style={ {
                marginTop: "40px",
                height: "calc(100% - 40px)",
            } }
        >
            <Tabs activeTab={ tab } onShowTab={ setTab } tabs={ [
                {
                    id: 'local',
                    title: 'Locally enabled',
                    content: (
                        <div>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={ () => {
                                        Navigation.Navigate(routes.launchOptions())
                                        Navigation.CloseSideMenus()
                                    } }
                                >
                                    Manage launch options
                                </ButtonItem>
                            </PanelSectionRow>
                            { localLaunchOptions.map((launchOption) => (
                                <div>
                                    <ToggleField
                                        checked={ getAppLaunchOptionState(appid, launchOption.id) }
                                        onChange={ (value) => setAppLaunchOptionState(appid, launchOption.id, value) }
                                        description={ [launchOption.onCommand && `ON: ${ launchOption.onCommand }`, launchOption.offCommand && `OFF: ${ launchOption.offCommand }`].filter(Boolean).join(' | ') }
                                        label={ launchOption.name }/>
                                </div>
                            )) }
                        </div>
                    ),
                    renderTabAddon: () => <span
                        className={ TabCount }>{ localLaunchOptions.filter((launchOption) => getAppLaunchOptionState(appid, launchOption.id)).length }</span>,
                },
                {
                    id: 'global',
                    title: 'Globally enabled',
                    content: (
                        <div>
                            <PanelSectionRow>
                                <ButtonItem
                                    layout="below"
                                    onClick={ () => {
                                        Navigation.Navigate(routes.launchOptions())
                                        Navigation.CloseSideMenus()
                                    } }
                                >
                                    Manage launch options
                                </ButtonItem>
                            </PanelSectionRow>
                            { globalLaunchOptions.map((launchOption) => (
                                <div>
                                    <ToggleField
                                        checked={ getAppLaunchOptionState(appid, launchOption.id) }
                                        onChange={ (value) => setAppLaunchOptionState(appid, launchOption.id, value) }
                                        description={ [launchOption.onCommand && `ON: ${ launchOption.onCommand }`, launchOption.offCommand && `OFF: ${ launchOption.offCommand }`].filter(Boolean).join(' | ') }
                                        label={ launchOption.name }/>
                                </div>
                            )) }
                        </div>
                    ),
                    renderTabAddon: () => <span
                        className={ TabCount }>{ globalLaunchOptions.filter((launchOption) => launchOption.enableGlobally && getAppLaunchOptionState(appid, launchOption.id)).length }</span>,
                },
            ] }/>
        </div>
    )

}