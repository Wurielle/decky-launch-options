import asyncio
import sys
import os
import subprocess
import signal
import time

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky

LAUNCH_OPTIONS_WATCHER_SCRIPT = "launch_options_watcher.py"

# Steam utility functions (from steam_launch_watcher.py)
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

def kill_process_by_name(script_name):
    """Kills processes using native system commands (No psutil required)."""
    current_pid = str(os.getpid())

    try:
        # 1. Use pgrep to find all PIDs matching the script name
        # -f: match full command line
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
                time.sleep(0.5)
                try:
                    os.kill(int(pid), 0) # Check if still exists
                    os.kill(int(pid), signal.SIGKILL) # Force kill
                    log(f"Force killed PID: {pid}")
                except OSError:
                    log(f"PID {pid} terminated successfully.")

            except ProcessLookupError:
                continue
    except subprocess.CalledProcessError:
        # pgrep returns non-zero if no processes are found
        log("No existing processes found.")

async def spawn_detached_process(script_path):
    # Use the absolute path to ensure the child can find the script
    script_abs_path = os.path.abspath(script_path)

    # We use 'preexec_fn' to call os.setsid, which creates a new session
    # and makes this process the leader.
    # On Steam Deck (Linux), this is very effective.
    cmd = f"python {decky.DECKY_PLUGIN_DIR}/launch_options_watcher.py"
    log(cmd)
    try:
        env = os.environ.copy()
        # fixes: https://github.com/SteamDeckHomebrew/decky-loader/issues/756#issuecomment-3139645629
        env["LD_LIBRARY_PATH"] = ""
        process = await asyncio.create_subprocess_shell(
            cmd,
            env=env
        )
        print(f"Successfully spawned {script_path}, pid: {process.pid}")
    except Exception as e:
        print(f"Failed to spawn: {e}")

async def launch_singleton_process(script_name):
    """Launches the process only if no other instance is running."""

    try:
        output = subprocess.check_output(["pgrep", "-f", script_name])
        pids = output.decode().strip().split()

        # Filter out the current process if it's in the list
        current_pid = str(os.getpid())
        pids = [pid for pid in pids if pid != current_pid]

        log(f"------------ Found {len(pids)} existing processes")

        if len(pids) > 0:
            log(f"------------ Instance already running, skipping launch")
            return  # Don't launch if already running

    except subprocess.CalledProcessError:
        # pgrep returns non-zero if no processes found - this is fine
        log(f"------------ No existing instances of {script_name}")

    # Launch only if we get here (no existing processes)
    log(f"------------ Launching {script_name}...")

    await spawn_detached_process(script_name)

def log(str):
    decky.logger.info(f"------- DLO: {str}")

# debug with: journalctl -u plugin_loader -f
class Plugin:
    async def restart_steam(self):
        """Restart Steam."""
        try:
            await launch_singleton_process(LAUNCH_OPTIONS_WATCHER_SCRIPT)
            log("🔄 Restarting Steam...")
            # Run the restart_steam function in an executor to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _restart_steam)
            log("✅ Steam restart complete")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error restarting Steam: {e}")
            import traceback
            decky.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    async def debug_logs(self):
        log("------------ Debug logs")
        try:
            output = subprocess.check_output(["pgrep", "-f", LAUNCH_OPTIONS_WATCHER_SCRIPT])
            pids = output.decode().strip().split()

            # Filter out the current process if it's in the list
            current_pid = str(os.getpid())
            pids = [pid for pid in pids if pid != current_pid]

            log(f"------------ Found {len(pids)} existing processes")
        except subprocess.CalledProcessError:
            # pgrep returns non-zero if no processes found - this is fine
            log(f"------------ Error occured in debug")
        log("Debug logs ------------")
        pass

    # A normal method. It can be called from the TypeScript side using @decky/api.
    async def add(self, left: int, right: int) -> int:
        return left + right

    async def long_running(self):
        await asyncio.sleep(15)
        # Passing through a bunch of random data, just as an example
        await decky.emit("timer_event", "Hello from the backend!", True, 2)

    async def start_watcher(self):
        await launch_singleton_process(LAUNCH_OPTIONS_WATCHER_SCRIPT)
        pass

    async def stop_watcher(self):
        kill_process_by_name(LAUNCH_OPTIONS_WATCHER_SCRIPT)
        pass

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        log("Hello World!")
        kill_process_by_name(LAUNCH_OPTIONS_WATCHER_SCRIPT)

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        log("Goodnight World!")
        kill_process_by_name(LAUNCH_OPTIONS_WATCHER_SCRIPT)
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        log("Goodbye World!")
        kill_process_by_name(LAUNCH_OPTIONS_WATCHER_SCRIPT)
        pass

    async def start_timer(self):
        self.loop.create_task(self.long_running())

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        log("Migrating")
        # Here's a migration example for logs:
        # - `~/.config/decky-template/template.log` will be migrated to `decky.decky_LOG_DIR/template.log`
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
                                               ".config", "decky-template", "template.log"))
        # Here's a migration example for settings:
        # - `~/homebrew/settings/template.json` is migrated to `decky.decky_SETTINGS_DIR/template.json`
        # - `~/.config/decky-template/` all files and directories under this root are migrated to `decky.decky_SETTINGS_DIR/`
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        # Here's a migration example for runtime data:
        # - `~/homebrew/template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # - `~/.local/share/decky-template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))
