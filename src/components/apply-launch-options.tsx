import { useParams } from '@decky/ui'
import { PropsWithChildren, useEffect } from 'react'
import { queryClient, useApplyLaunchOptionsMutation, useGetInfoQuery } from '../query'
import { QueryClientProvider } from '@tanstack/react-query'

export function ApplyLaunchOptionsLogic(props: PropsWithChildren & { appid?: number }) {
    const appid = useParams<{ appid: string }>().appid || props.appid
    
    const getInfoQuery = useGetInfoQuery()
    const applyLaunchOptionsMutation = useApplyLaunchOptionsMutation()

    useEffect(() => {
        if (typeof appid !== 'undefined' && getInfoQuery.data) {
            applyLaunchOptionsMutation.mutate({
                appid: Number(appid),
                command: getInfoQuery.data.COMMAND,
            })
        }
    }, [appid, getInfoQuery.data])
    return props.children
}

export function ApplyLaunchOptions(props: PropsWithChildren & { appid?: number }) {
    return (
        <QueryClientProvider client={ queryClient }>
            <ApplyLaunchOptionsLogic appid={ props.appid }>
                { props.children }
            </ApplyLaunchOptionsLogic>
        </QueryClientProvider>
    )
}