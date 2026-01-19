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
    # 1. Start with the original Steam command
    # sys.argv[1:] is the [executable, arg1, arg2...]
    final_args = sys.argv[1:]

    # 2. Get the profile for this game
    profile = config["profiles"].get(str(appid), {})

    # 3. Create a lookup for launch options by ID for speed
    options_map = {opt["id"]: opt for opt in config["launch_options"]}

    # 4. Iterate through the options in the profile
    for opt_id, is_enabled in profile.items():
        opt = options_map.get(opt_id)
        if not opt:
            continue

        # Determine which command string to use
        raw_command = opt["onCommand"] if is_enabled else opt["offCommand"]

        if not raw_command:
            continue

        # 5. Handle the "%command%" placeholder
        # We split the command string into a list and replace %command% with our current args
        parts = raw_command.replace("~", os.path.expanduser("~")).split()

        if "%command%" in parts:
            idx = parts.index("%command%")
            # Replace the placeholder with the current accumulated command list
            final_args = parts[:idx] + final_args + parts[idx+1:]
        else:
            # Fallback if %command% isn't in the string
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