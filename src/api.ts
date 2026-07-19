import { callable } from "@decky/api"
import { Settings } from "./shared"

export const get_info = callable<
  [],
  {
    SETTINGS_FOLDER_NAME: string
    SETTINGS_FOLDER_PATH: string
    SETTINGS_BACKUP_FOLDER_PATH: string
    SETTINGS_PATH: string
    SH_COMMAND_NAME: string
    SHORT_SH_COMMAND_PATH: string
    FULL_SH_COMMAND_PATH: string
    COMMAND: string
    DEBUG_LOG_PATH: string
    BACKUPS_PATH: string
  }
>("get_info")
export const get_settings = callable<[], Settings | null>("get_settings")
export const set_settings = callable<[Settings], void>("set_settings")
export const has_shell_script = callable<[], boolean>("has_shell_script")
export const get_debug_log = callable<[], string | null>("get_debug_log")
export const get_shortcut_launch_options = callable<
  [appid: string],
  string | null
>("get_shortcut_launch_options")
export const backup_original_launch_options = callable<
  [appid: string, command: string],
  void
>("backup_original_launch_options")
export const get_original_launch_options_backups = callable<
  [appid: string],
  OriginalLaunchOptionsBackup[]
>("get_original_launch_options_backups")
export const delete_original_launch_options_backup = callable<
  [appid: string, backupId: string],
  void
>("delete_original_launch_options_backup")
export const delete_original_launch_options_backups = callable<
  [appid: string],
  void
>("delete_original_launch_options_backups")

export interface OriginalLaunchOptionsBackup {
  id: string
  date: string
  command: string
}
