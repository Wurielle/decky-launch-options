import { SidebarNavigation, SteamSpinner } from '@decky/ui'
import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../../hooks'
import { FaPlus, FaTerminal } from "react-icons/fa"
import { PluginProvider } from '../../../components/plugin-provider'
import { CreateLaunchOptionForm } from "../../../components/create-launch-option-form"
import { UpdateLaunchOptionForm } from "../../../components/update-launch-option-form"

export function LaunchOptionsPage() {
    const { settings, loading } = useSettings()
    const [activePage, setActivePage] = useState<string>('new-launch-option')

    const navKey = useMemo(
        () => settings.launchOptions.map(({ id }) => id).join('|'),
        [settings.launchOptions],
    )

    const pageIds = useMemo(() => new Set<string>([
        'new-launch-option',
        ...settings.launchOptions.map((item) => item.id),
    ]), [settings.launchOptions])

    useEffect(() => {
        if (!pageIds.has(activePage)) {
            setActivePage('new-launch-option')
        }
    }, [activePage, pageIds])

    return (
        <PluginProvider>
            <div
                style={ {
                    marginTop: "40px",
                    height: "calc(100% - 40px)",
                } }
            >
                {
                    loading ? (
                        <SteamSpinner width={ "100%" } height={ "100%" }/>
                    ) : (
                        <SidebarNavigation
                            key={ navKey }
                            title={ 'Launch options' }
                            showTitle={ true }
                            disableRouteReporting={ true }
                            page={ activePage }
                            onPageRequested={ setActivePage }
                            pages={ [
                                {
                                    icon: <FaPlus/>,
                                    title: 'New launch option',
                                    identifier: 'new-launch-option',
                                    route: 'new-launch-option',
                                    content: <CreateLaunchOptionForm/>,
                                },
                                ...settings.launchOptions.map(({ id, name }) => ({
                                    icon: <FaTerminal/>,
                                    title: name || 'Unnamed',
                                    identifier: id,
                                    route: id,
                                    content: <UpdateLaunchOptionForm
                                        key={ id || '' }
                                        id={ id }
                                        commonOnly={ false }
                                        syncCommonFields={ false }
                                    />,
                                })),
                            ] }
                        />
                    )
                }
            </div>
        </PluginProvider>
    )
}
