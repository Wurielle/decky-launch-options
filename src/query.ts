import { callable } from '@decky/api'
import { Config } from './shared'
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query'

export const queryClient = new QueryClient()

const keys = {
    config: () => ['config'],
}

const get_config = callable<[], Config | null>("get_config")
const set_config = callable<[Config], void>("set_config")

export const useGetConfigQuery = () => useQuery({
    queryKey: keys.config(),
    queryFn() {
        return get_config()
    },
})

export const useSetConfigMutation = () => useMutation<void, Error, Config>({
    mutationFn(data) {
        return set_config(data)
    },
    onSuccess() {
        queryClient.refetchQueries({
            queryKey: keys.config(),
        })
    },
})