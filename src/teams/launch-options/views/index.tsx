import {SidebarNavigation, SteamSpinner,} from '@decky/ui'
import {useSettings} from '../../../hooks'
import {FaPlus, FaTerminal} from "react-icons/fa"
import {PluginProvider} from '../../../components/plugin-provider'
import {CreateLaunchOptionForm} from "../../../components/create-launch-option-form";
import {UpdateLaunchOptionForm} from "../../../components/update-launch-option-form";

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
                            key={settings.launchOptions.length}
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