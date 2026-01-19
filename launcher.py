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

appid = get_steam_appid()

def write_logs():
    with open(LOG_FILE, "a") as f:
        f.write(f"--- {datetime.datetime.now()} Launch Attempt for app: {appid} ---\n")
        f.write(f"Full Command List: {args}\n\n")

        for i, arg in enumerate(args):
            f.write(f"Arg {i}: {arg}\n")
        f.write("-" * 40 + "\n\n")

write_logs()

if len(sys.argv) > 1:
    os.execvpe(executable, args, os.environ)
else:
    print("Error: No game command received from Steam.")