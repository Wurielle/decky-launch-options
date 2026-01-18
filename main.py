import os
import asyncio
import subprocess

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky

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
            decky.logger.info("⚠️  Steam processes still running. Waiting longer...")
            time.sleep(3)

    except Exception as e:
        decky.logger.error(f"❌ Error stopping Steam: {e}")


def _start_steam():
    """Start Steam."""
    try:
        decky.logger.info("🚀 Starting Steam...")
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
                decky.logger.info(f"✅ Steam started using: {' '.join(cmd)}")
                break
            except FileNotFoundError:
                continue

        if not steam_started:
            decky.logger.error("❌ Could not start Steam automatically")
        else:
            decky.logger.info("✅ Steam is starting...")

    except Exception as e:
        decky.logger.error(f"❌ Error starting Steam: {e}")


def _restart_steam():
    """Restart Steam to apply configuration changes."""
    decky.logger.info("🔄 Restarting Steam...")
    _stop_steam()
    import time
    time.sleep(3)
    _start_steam()


class Plugin:
    async def restart_steam(self):
        """Restart Steam."""
        try:
            decky.logger.info("🔄 Restarting Steam...")
            # Run the restart_steam function in an executor to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _restart_steam)
            decky.logger.info("✅ Steam restart complete")
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error restarting Steam: {e}")
            import traceback
            decky.logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}

    # A normal method. It can be called from the TypeScript side using @decky/api.
    async def add(self, left: int, right: int) -> int:
        return left + right

    async def long_running(self):
        await asyncio.sleep(15)
        # Passing through a bunch of random data, just as an example
        await decky.emit("timer_event", "Hello from the backend!", True, 2)

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Hello World!")

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        decky.logger.info("Goodnight World!")
        pass

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Goodbye World!")
        pass

    async def start_timer(self):
        self.loop.create_task(self.long_running())

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating")
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
