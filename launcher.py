import os
import sys
import datetime

print("Python logic is running...")
LOG_FILE = "/home/deck/dlo_debug.log"
executable = sys.argv[1]
args = sys.argv[1:]

def get_steam_appid():
    appid_arg = next((arg for arg in sys.argv if "AppId=" in arg), None)

    if appid_arg:
        return appid_arg.split("=")[1]
    return None

def get_final_args(config, appid):
    final_args = sys.argv[1:]
    profile = config["profiles"].get(str(appid), {})

    # Iterate through EVERY possible launch option
    for opt in config["launch_options"]:
        opt_id = opt["id"]

        # Check if the profile has a setting; if not, default to False
        is_enabled = profile.get(opt_id, False)

        # Determine command
        raw_command = opt["onCommand"] if is_enabled else opt["offCommand"]

        if not raw_command:
            continue

        # Standard replacement logic
        full_path_cmd = raw_command.replace("~", os.path.expanduser("~"))
        parts = full_path_cmd.split()

        if "%command%" in parts:
            idx = parts.index("%command%")
            final_args = parts[:idx] + final_args + parts[idx+1:]
        else:
            final_args = parts + final_args

    return final_args

appid = get_steam_appid()

config = {
    "profiles": {
        "3527290": {
            "123456789": True,
            "987654321": True,
        },
    },
    "launch_options": [
        {
            "id": "123456789",
            "name": "lsfg",
            "onCommand": "~/lsfg %command%",
            "offCommand": "",
        },
        {
            "id": "987654321",
            "name": "fgmod",
            "onCommand": "~/fgmod/fgmod %command%",
            "offCommand": "~/fgmod/fgmod-uninstaller.sh %command%",
        },
    ]
}

executable_args = get_final_args(config, appid)

def write_logs():
    with open(LOG_FILE, "a") as f:
        f.write(f"--- {datetime.datetime.now()} Launch Attempt for app: {appid} ---\n")
        f.write(f"Full Command List: {args}\n\n")
        f.write(f"Executable: {executable_args}\n\n")

        for i, arg in enumerate(args):
            f.write(f"Arg {i}: {arg}\n")
        f.write("-" * 40 + "\n\n")

write_logs()

if len(sys.argv) > 1:
    executable_args = get_final_args(config, appid)

    if executable_args:
        executable = executable_args[0]
        os.execvpe(executable, executable_args, os.environ)
    else:
        os.execvpe(executable, args, os.environ)

else:
    print("Error: No game command received from Steam.")