import {
  QueryClient,
  queryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import {
  backup_original_launch_options,
  delete_original_launch_options_backup,
  delete_original_launch_options_backups,
  get_info,
  get_original_launch_options_backups,
  get_settings,
  set_settings,
} from "../api"
import { Settings } from "../shared"

export const queryClient = new QueryClient()

export const keys = {
  settings: () => ["settings"],
  info: () => ["info"],
  originalLaunchOptionsBackups: (appid: string) => [
    "original-launch-options-backups",
    appid,
  ],
}

export const getInfoQueryOptions = queryOptions({
  queryKey: keys.info(),
  queryFn() {
    return get_info()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})

export const useGetInfoQuery = () => useQuery(getInfoQueryOptions)

export const getSettingsQueryOptions = queryOptions({
  queryKey: keys.settings(),
  queryFn() {
    return get_settings()
  },
})

export const useGetSettingsQuery = () => useQuery(getSettingsQueryOptions)

export const useSetSettingsMutation = () =>
  useMutation<void, Error, Settings>({
    mutationFn(data) {
      return set_settings(data)
    },
    onSuccess(_, settings) {
      // Unload must see saved originals immediately, before the refetch finishes.
      queryClient.setQueryData(keys.settings(), settings)
      queryClient.refetchQueries({
        queryKey: keys.settings(),
      })
    },
  })

export const useBackupOriginalLaunchOptionsMutation = () =>
  useMutation<void, Error, { appid: string; command: string }>({
    mutationFn(data) {
      return backup_original_launch_options(data.appid, data.command)
    },
  })

export const useGetOriginalLaunchOptionsBackupsQuery = (appid: string) =>
  useQuery({
    queryKey: keys.originalLaunchOptionsBackups(appid),
    queryFn() {
      return get_original_launch_options_backups(appid)
    },
  })

export const useDeleteOriginalLaunchOptionsBackupMutation = () =>
  useMutation<void, Error, { appid: string; backupId: string }>({
    mutationFn(data) {
      return delete_original_launch_options_backup(data.appid, data.backupId)
    },
    onSuccess(_, data) {
      queryClient.invalidateQueries({
        queryKey: keys.originalLaunchOptionsBackups(data.appid),
      })
    },
  })

export const useDeleteOriginalLaunchOptionsBackupsMutation = () =>
  useMutation<void, Error, { appid: string }>({
    mutationFn(data) {
      return delete_original_launch_options_backups(data.appid)
    },
    onSuccess(_, data) {
      queryClient.invalidateQueries({
        queryKey: keys.originalLaunchOptionsBackups(data.appid),
      })
    },
  })
