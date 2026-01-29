import datetime
import json
import os
import sys
from pathlib import Path

from shared import SETTINGS_FOLDER_PATH, SETTINGS_PATH

LOG_FILE = os.path.join(SETTINGS_FOLDER_PATH, 'debug.log')

executable = sys.argv[1] if len(sys.argv) > 1 else None
args = sys.argv[1:]


def _write_json(file_path, data):
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)


def _read_json(file_path):
    path = Path(file_path)
    if not path.exists():
        return None

    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return None


def get_settings():
    return _read_json(SETTINGS_PATH)


def get_steam_appid():
    appid_arg = next((arg for arg in sys.argv if "AppId=" in arg), None)

    if appid_arg:
        return appid_arg.split("=")[1]
    return None


def detect_launch_option_type(command):
    if not command or not command.strip():
        return None

    stripped = command.strip()

    # Flags: starts with - or --
    if stripped.startswith('-'):
        return 'flag'

    # Environment variables: contains = and doesn't look like a command
    # Check if it has = and the part before = doesn't contain / or spaces
    if '=' in command:
        first_token = command.split()[0] if ' ' in command else command
        key_part = first_token.split('=')[0]
        # If the key part looks like an env var name (no /, no -)
        if '/' not in key_part and not key_part.startswith('-'):
            return 'env'

    # Default: prefix command
    return 'prefix'


def apply_env_vars(raw_env):
    if not raw_env:
        return

    import shlex
    try:
        # Use shlex to properly handle quoted values
        parts = shlex.split(raw_env)
    except ValueError:
        # Fallback to simple split if shlex fails
        parts = raw_env.split()

    for part in parts:
        if '=' in part:
            key, value = part.split('=', 1)
            os.environ[key] = value


def apply_flags(raw_flags, current_args):
    if not raw_flags:
        return current_args

    import shlex
    try:
        # Use shlex to properly handle quoted values and complex arguments
        flag_parts = shlex.split(raw_flags)
    except ValueError:
        # Fallback to simple split if shlex fails
        flag_parts = raw_flags.split()

    if len(current_args) > 0:
        return [current_args[0]] + flag_parts + current_args[1:]
    else:
        return flag_parts + current_args


def apply_command_to_args(raw_command, current_args):
    if not raw_command:
        return current_args

    full_path_cmd = raw_command.replace("~", os.path.expanduser("~"))

    import shlex
    try:
        # Use shlex to properly handle quoted paths and arguments
        parts = shlex.split(full_path_cmd)
    except ValueError:
        # Fallback to simple split if shlex fails
        parts = full_path_cmd.split()

    if "%command%" in parts:
        idx = parts.index("%command%")
        return parts[:idx] + current_args + parts[idx + 1:]
    else:
        return parts + current_args


def get_final_args(settings, appid):
    final_args = sys.argv[1:]
    profile = settings["profiles"].get(str(appid), {})
    profile_state = profile.get("state", {})
    profile_original_launch_options = profile.get("originalLaunchOptions", "")

    # Add original launch options if they exist (treat as prefix command)
    final_args = apply_command_to_args(profile_original_launch_options, final_args)

    # Collect all flags to apply at the end
    collected_flags = []

    # Iterate through EVERY possible launch option
    for opt in settings["launchOptions"]:
        opt_id = opt["id"]
        enable_globally = opt.get("enableGlobally", False)
        is_enabled = profile_state.get(opt_id, enable_globally)

        raw_command = opt["on"] if is_enabled else opt["off"]

        # Detect type and apply accordingly
        cmd_type = detect_launch_option_type(raw_command)

        if cmd_type == 'env':
            apply_env_vars(raw_command)
        elif cmd_type == 'flag':
            # Collect flags
            import shlex
            try:
                flag_parts = shlex.split(raw_command)
            except ValueError:
                flag_parts = raw_command.split()
            collected_flags.extend(flag_parts)
        else:  # prefix or None
            final_args = apply_command_to_args(raw_command, final_args)

    # Apply all collected flags at the very end
    if collected_flags:
        final_args = final_args + collected_flags

    return final_args


if __name__ == "__main__":
    appid = get_steam_appid()

    settings = get_settings()

    executable_args = get_final_args(settings, appid)


    def write_logs():
        with open(LOG_FILE, "w") as f:
            f.write(f"--- {datetime.datetime.now()} Launch Attempt for app: {appid} ---\n")
            f.write(f"Full Command List: {args}\n\n")

            for i, arg in enumerate(args):
                f.write(f"Arg {i}: {arg}\n")
            f.write("-" * 40 + "\n\n")

            f.write(f"Executable: {executable_args}\n\n")

            for i, arg in enumerate(executable_args):
                f.write(f"Arg {i}: {arg}\n")
            f.write("-" * 40 + "\n\n")


    write_logs()

    if len(sys.argv) > 1 and settings:
        executable_args = get_final_args(settings, appid)
        if executable_args:
            executable = executable_args[0]
            os.execvpe(executable, executable_args, os.environ)
        else:
            os.execvpe(executable, args, os.environ)
    else:
        os.execvpe(executable, args, os.environ)
