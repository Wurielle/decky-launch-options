import datetime
import json
import os
import sys
from pathlib import Path

CONFIG_FOLDER_NAME = 'dlo'
CONFIG_FOLDER_PATH = os.path.join('/home/deck', CONFIG_FOLDER_NAME)
CONFIG_PATH = f"{os.path.join(CONFIG_FOLDER_PATH, 'config.json')}"

LOG_FILE = os.path.join(CONFIG_FOLDER_PATH, 'debug.log')

executable = sys.argv[1]
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


def get_config():
    return _read_json(CONFIG_PATH)


def get_steam_appid():
    appid_arg = next((arg for arg in sys.argv if "AppId=" in arg), None)

    if appid_arg:
        return appid_arg.split("=")[1]
    return None


def get_final_args(config, appid):
    final_args = sys.argv[1:]
    profile = config["profiles"].get(str(appid), {})
    profile_state = profile.get("state", {})
    profile_original_launch_options = profile.get("originalLaunchOptions", "")

    # Add original launch options if they exist
    if profile_original_launch_options:
        full_path_cmd = profile_original_launch_options.replace("~", os.path.expanduser("~"))
        parts = full_path_cmd.split()
        if "%command%" in parts:
            idx = parts.index("%command%")
            final_args = parts[:idx] + final_args + parts[idx + 1:]
        else:
            final_args = parts + final_args

    # Iterate through EVERY possible launch option
    for opt in config["launchOptions"]:
        opt_id = opt["id"]
        enable_globally = opt.get("enableGlobally", False)
        is_enabled = profile_state.get(opt_id, enable_globally)

        raw_command = opt["onCommand"] if is_enabled else opt["offCommand"]

        if not raw_command:
            continue

        full_path_cmd = raw_command.replace("~", os.path.expanduser("~"))
        parts = full_path_cmd.split()

        if "%command%" in parts:
            idx = parts.index("%command%")
            final_args = parts[:idx] + final_args + parts[idx + 1:]
        else:
            final_args = parts + final_args

    return final_args


appid = get_steam_appid()

config = get_config()

executable_args = get_final_args(config, appid)


def write_logs():
    with open(LOG_FILE, "w") as f:
        f.write(f"--- {datetime.datetime.now()} Launch Attempt for app: {appid} ---\n")
        f.write(f"Full Command List: {args}\n\n")
        f.write(f"Executable: {executable_args}\n\n")

        for i, arg in enumerate(args):
            f.write(f"Arg {i}: {arg}\n")
        f.write("-" * 40 + "\n\n")


write_logs()

if len(sys.argv) > 1 and config:
    executable_args = get_final_args(config, appid)
    if executable_args:
        executable = executable_args[0]
        os.execvpe(executable, executable_args, os.environ)
    else:
        os.execvpe(executable, args, os.environ)
else:
    os.execvpe(executable, args, os.environ)
