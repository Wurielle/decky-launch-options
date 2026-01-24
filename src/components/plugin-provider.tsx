import { createContext, PropsWithChildren, useContext } from 'react'
import { useSettings } from '../hooks'

type PluginContextType = {
    settings: ReturnType<typeof useSettings>
}

export const PluginContext = createContext<PluginContextType>({} as PluginContextType)

export const usePlugin = () => {
    return useContext(PluginContext)
}

export function PluginProvider(props: PropsWithChildren) {
    return (
        <PluginContext.Provider value={ {
            settings: useSettings(),
        } }>
            {
                props.children
            }
        </PluginContext.Provider>
    )
}