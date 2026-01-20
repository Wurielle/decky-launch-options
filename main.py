import asyncio
import os
import subprocess
import signal
import stat
import json
from pathlib import Path
# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
CONFIG_FOLDER_NAME = 'dlo'
CONFIG_FOLDER = os.path.join(decky.DECKY_USER_HOME, CONFIG_FOLDER_NAME)
LAUNCH_OPTIONS_WATCHER_SCRIPT = "launch_options_watcher.py"
SH_COMMAND_NAME = "run"
SHORT_SH_COMMAND_PATH=os.path.join('~', CONFIG_FOLDER_NAME, SH_COMMAND_NAME)
FULL_SH_COMMAND_PATH=os.path.join(CONFIG_FOLDER, SH_COMMAND_NAME)
PY_LAUNCHER_PATH = os.path.join(decky.DECKY_PLUGIN_DIR, "run.py")
COMMAND = f"{SHORT_SH_COMMAND_PATH} %command%"
CONFIG_PATH = f"{os.path.join(CONFIG_FOLDER, 'config.json')}"

folder_path = Path(CONFIG_FOLDER)
folder_path.mkdir(parents=True, exist_ok=True)

with open(FULL_SH_COMMAND_PATH, "w") as file:
    file.write("#!/bin/bash\n")
    file.write(f"python \"{PY_LAUNCHER_PATH}\" \"$@\"\n")

current_stat = os.stat(FULL_SH_COMMAND_PATH)
os.chmod(FULL_SH_COMMAND_PATH, current_stat.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _stop_steam():
    """Stop Steam and wait for it to fully close."""
    try:
        # Find and kill the main Steam process
        result = subprocess.run(['pgrep', '-f', 'ubuntu12_32/steam'], capture_output=True, text=True)
        if result.returncode == 0:
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid.strip():
                    try:
                        subprocess.run(['kill', pid.strip()], check=False)
                    except:
                        pass

        # Fallback: try standard kill methods
        subprocess.run(["pkill", "-f", "ubuntu12_32/steam"], check=False, stderr=subprocess.DEVNULL)
        subprocess.run(["killall", "steam"], check=False, stderr=subprocess.DEVNULL)

        # Kill steamwebhelper processes
        subprocess.run(["pkill", "steamwebhelper"], check=False, stderr=subprocess.DEVNULL)

        # Verify Steam is closed
        import time
        time.sleep(2)
        result = subprocess.run(['pgrep', '-f', 'steam'], capture_output=True, text=True)
        if result.returncode == 0:
            log("⚠️  Steam processes still running. Waiting longer...")
            time.sleep(3)

    except Exception as e:
        decky.logger.error(f"❌ Error stopping Steam: {e}")

def _start_steam():
    """Start Steam."""
    try:
        log("🚀 Starting Steam...")
        # Try multiple ways to start Steam
        start_commands = [
            ["steam"],
            ["/usr/bin/steam"],
            ["flatpak", "run", "com.valvesoftware.Steam"],
            ["snap", "run", "steam"]
        ]

        steam_started = False
        for cmd in start_commands:
            try:
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                steam_started = True
                log(f"✅ Steam started using: {' '.join(cmd)}")
                break
            except FileNotFoundError:
                continue

        if not steam_started:
            decky.logger.error("❌ Could not start Steam automatically")
        else:
            log("✅ Steam is starting...")

    except Exception as e:
        decky.logger.error(f"❌ Error starting Steam: {e}")

def _restart_steam():
    """Restart Steam to apply configuration changes."""
    log("🔄 Restarting Steam...")
    _stop_steam()
    import time
    time.sleep(3)
    _start_steam()

async def kill_process_by_name(script_name):
    """Kills processes using native system commands (No psutil required)."""
    current_pid = str(os.getpid())

    try:
        # 1. Use pgrep to find all PIDs matching the script name
        output = subprocess.check_output(["pgrep", "-f", script_name])
        pids = output.decode().split()

        for pid in pids:
            # 2. Safety: Don't kill the current script
            if pid == current_pid:
                continue

            try:
                log(f"Attempting to kill PID: {pid}")
                # 3. Send SIGTERM (graceful)
                os.kill(int(pid), signal.SIGTERM)

                # 4. Optional: check if it actually died, if not, SIGKILL
                await asyncio.sleep(0.5)
                try:
                    os.kill(int(pid), 0) # Check if still exists
                    os.kill(int(pid), signal.SIGKILL) # Force kill
                    log(f"Force killed PID: {pid}")
                except OSError:
                    log(f"PID {pid} terminated successfully.")

            except ProcessLookupError:
                continue

    except subprocess.CalledProcessError:
        log("No existing processes found.")

async def spawn_detached_process(script_name, args = ''):
    cmd = f"python {os.path.join(decky.DECKY_PLUGIN_DIR, script_name)} {args}"
    try:
        env = os.environ.copy()
        # fixes: https://github.com/SteamDeckHomebrew/decky-loader/issues/756#issuecomment-3139645629
        env["LD_LIBRARY_PATH"] = ""
        process = await asyncio.create_subprocess_shell(
            cmd,
            env=env
        )
        print(f"Successfully spawned {cmd}, pid: {process.pid}")
    except Exception as e:
        print(f"Failed to spawn: {e}")

async def launch_singleton_process(script_name, args = ''):
    """Launches the process only if no other instance is running."""
    try:
        output = subprocess.check_output(["pgrep", "-f", script_name])
        pids = output.decode().strip().split()

        current_pid = str(os.getpid())
        pids = [pid for pid in pids if pid != current_pid]

        log(f"------------ Found {len(pids)} existing processes")

        if len(pids) > 0:
            log(f"------------ Instance already running, skipping launch")
            return

    except subprocess.CalledProcessError:
        log(f"------------ No existing instances of {script_name}")

    log(f"------------ Launching {script_name}...")

    await spawn_detached_process(script_name, args)

def log(str):
    decky.logger.info(f"------- DLO: {str}")

# debug with: journalctl -u plugin_loader -f
class Plugin:
    async def restart_steam(self):
        """Restart Steam."""
        try:
            log("Restarting Steam...")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _restart_steam)
            log("Steam restart complete")
        except Exception as e:
            decky.logger.error(f"Error restarting Steam: {e}")
            import traceback
            decky.logger.error(traceback.format_exc())

    async def debug_logs(self):
        log("------------ Debug logs")
        log("Debug logs ------------")
        pass

    def _write_json(self, file_path, data):
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)

    def _read_json(self, file_path):
        path = Path(file_path)
        if not path.exists():
            return None

        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return None

    async def set_config(self, data):
        return await asyncio.to_thread(self._write_json, CONFIG_PATH, data)

    async def get_config(self):
        return await asyncio.to_thread(self._read_json, CONFIG_PATH)

    async def apply_launch_options(self):
        await launch_singleton_process(LAUNCH_OPTIONS_WATCHER_SCRIPT, f"\"{COMMAND}\"")
        await self.restart_steam()

    async def start_watcher(self):
        await launch_singleton_process(LAUNCH_OPTIONS_WATCHER_SCRIPT, f"\"{COMMAND}\"")

    async def stop_watcher(self):
        await kill_process_by_name(LAUNCH_OPTIONS_WATCHER_SCRIPT)

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        await self.cleanup()

    async def _unload(self):
        await self.cleanup()

    async def _uninstall(self):
        await self.cleanup()

    async def cleanup(self):
        await self.stop_watcher()

    async def _migration(self):
        pass
