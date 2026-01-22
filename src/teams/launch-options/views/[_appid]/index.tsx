import { ButtonItem, findModule, Navigation, PanelSectionRow, Tabs, ToggleField, useParams } from '@decky/ui'
import { useMemo, useState } from 'react'
import { useConfig } from '../../../../hooks'
import { routes } from '../../../../shared'

export function AppLaunchOptionsPage() {
    const { appid } = useParams<{ appid: string }>()
    const [tab, setTab] = useState<'local' | 'global'>('local')
    const { config } = useConfig()
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
                    title: 'Local',
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
                                        description={ [launchOption.onCommand && `ON: ${ launchOption.onCommand }`, launchOption.offCommand && `OFF: ${ launchOption.offCommand }`].filter(Boolean).join(' | ') }
                                        checked={ false }
                                        label={ launchOption.name }/>
                                </div>
                            )) }
                        </div>
                    ),
                    renderTabAddon: () => <span className={ TabCount }>1</span>,
                },
                {
                    id: 'global',
                    title: 'Global',
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
                                        description={ [launchOption.onCommand && `ON: ${ launchOption.onCommand }`, launchOption.offCommand && `OFF: ${ launchOption.offCommand }`].filter(Boolean).join(' | ') }
                                        checked={ false }
                                        label={ launchOption.name }/>
                                </div>
                            )) }
                        </div>
                    ),
                    renderTabAddon: () => <span className={ TabCount }>1</span>,
                },
            ] }/>
        </div>
    )

}