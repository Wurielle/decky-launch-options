import asyncio
import json
import os
import stat
import shutil
from pathlib import Path

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky

SETTINGS_FOLDER_NAME = '.dlo'
SETTINGS_FOLDER_PATH = os.path.join(os.path.expanduser('~'), SETTINGS_FOLDER_NAME)
SETTINGS_PATH = f"{os.path.join(SETTINGS_FOLDER_PATH, 'settings.json')}"

PY_LAUNCHER_PATH = os.path.join(decky.DECKY_PLUGIN_DIR, "run.py")

SH_COMMAND_NAME = "run"
SHORT_SH_COMMAND_PATH = os.path.join('~', SETTINGS_FOLDER_NAME, SH_COMMAND_NAME)
FULL_SH_COMMAND_PATH = os.path.join(SETTINGS_FOLDER_PATH, SH_COMMAND_NAME)
COMMAND = f"{SHORT_SH_COMMAND_PATH} %command%"

info = {
    "SETTINGS_FOLDER_NAME": SETTINGS_FOLDER_NAME,
    "SETTINGS_FOLDER_PATH": SETTINGS_FOLDER_PATH,
    "SETTINGS_PATH": SETTINGS_PATH,
    "SH_COMMAND_NAME": SH_COMMAND_NAME,
    "SHORT_SH_COMMAND_PATH": SHORT_SH_COMMAND_PATH,
    "FULL_SH_COMMAND_PATH": FULL_SH_COMMAND_PATH,
    "COMMAND": COMMAND,
}


def log(str):
    decky.logger.info(f"------- DLO: {str}")


class Plugin:
    async def prepare(self):
        folder_path = Path(SETTINGS_FOLDER_PATH)
        folder_path.mkdir(parents=True, exist_ok=True)

        try:
            with open(FULL_SH_COMMAND_PATH, "w") as file:
                file.write("#!/bin/bash\n")
                file.write(f"if command -v python &> /dev/null && [ -f \"{PY_LAUNCHER_PATH}\" ]; then\n")
                file.write(f"    python \"{PY_LAUNCHER_PATH}\" \"$@\"\n")
                file.write("else\n")
                file.write("    exec \"$@\"\n")
                file.write("fi\n")

            current_stat = os.stat(FULL_SH_COMMAND_PATH)
            os.chmod(FULL_SH_COMMAND_PATH, current_stat.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        except (OSError, IOError) as e:
            raise RuntimeError(f"Failed to create or configure launcher script: {e}")

    async def get_steam_path(self) -> Path:
        steam_paths = [
            Path.home() / ".steam" / "steam",
            Path.home() / ".local" / "share" / "Steam",
            Path("/usr/share/steam"),
            Path.home() / ".steam" / "root",
            Path.home() / "snap" / "steam" / "common" / ".steam" / "steam",
            Path("/var/lib/flatpak/app/com.valvesoftware.Steam/home/.steam/steam"),
            Path.home() / ".var" / "app" / "com.valvesoftware.Steam" / "home" / ".steam" / "steam",
        ]

        for path in steam_paths:
            if path.exists():
                return path

        raise FileNotFoundError("Steam installation not found")

    async def get_localconfig_vdf_path(self) -> Path:
        userdata_path = (await self.get_steam_path()) / "userdata"

        if not userdata_path.exists():
            raise FileNotFoundError(f"Steam userdata directory not found at: {userdata_path}")

        try:
            # Find user directories (numeric directories)
            user_dirs = [d for d in userdata_path.iterdir() if d.is_dir() and d.name.isdigit()]
        except PermissionError as e:
            raise PermissionError(f"Permission denied accessing userdata directory: {userdata_path}") from e

        if not user_dirs:
            raise FileNotFoundError("No Steam user directories found")

        # Use the most recently modified user directory
        user_dir = max(user_dirs, key=lambda x: x.stat().st_mtime)
        localconfig_path = user_dir / "config" / "localconfig.vdf"

        if not localconfig_path.exists():
            raise FileNotFoundError(f"localconfig.vdf not found at: {localconfig_path}")

        return localconfig_path

    async def debug_logs(self):
        log("------------ Debug logs")
        log('You can debug the python process with:')
        log('journalctl -u plugin_loader -f')
        log('')
        log('Info:')
        log(info)
        log('')
        log("Debug logs ------------")
        pass

    def _write_json(self, file_path, data):
        try:
            path = Path(file_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except (OSError, IOError, TypeError) as e:
            log(f"Failed to write JSON to {file_path}: {e}")
            raise

    def _read_json(self, file_path):
        path = Path(file_path)
        if not path.exists():
            return None

        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return None

    async def get_original_command(self, appid):
        import re

        localconfig_path = await self.get_localconfig_vdf_path()

        try:
            with open(localconfig_path, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()
        except (OSError, IOError) as e:
            raise IOError(f"Failed to read localconfig.vdf at {localconfig_path}: {e}") from e

        # Find the specific app section
        app_pattern = rf'"{appid}"\s*\{{'
        app_match = re.search(app_pattern, config_content)

        if not app_match:
            raise FileNotFoundError(f"App {appid} not found in localconfig.vdf")

        # Find the app section boundaries
        brace_start = app_match.end() - 1
        brace_count = 1
        brace_end = -1

        for i in range(brace_start + 1, len(config_content)):
            if config_content[i] == '{':
                brace_count += 1
            elif config_content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    brace_end = i
                    break

        if brace_end == -1:
            return None

        app_section = config_content[brace_start:brace_end]

        # Check for LaunchOptions
        launch_options_match = re.search(r'"LaunchOptions"\s+"([^"]*)"', app_section)

        if not launch_options_match:
            return None

        launch_options = launch_options_match.group(1)

        # If LaunchOptions equals COMMAND, return None, otherwise return the launch options
        if launch_options == COMMAND:
            return None

        return launch_options

    async def has_shell_script(self):
        return os.path.exists(FULL_SH_COMMAND_PATH)

    async def get_info(self):
        return info

    async def set_settings(self, data):
        return await asyncio.to_thread(self._write_json, SETTINGS_PATH, data)

    async def get_settings(self):
        return await asyncio.to_thread(self._read_json, SETTINGS_PATH)

    async def cleanup(self):
        pass

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        await self.prepare()

    async def _unload(self):
        await self.cleanup()

    async def _uninstall(self):
        if os.path.exists(SETTINGS_FOLDER_PATH):
            try:
                shutil.rmtree(SETTINGS_FOLDER_PATH)
            except (OSError, PermissionError) as e:
                log(f"Failed to remove settings folder during uninstall: {e}")
                raise

    async def _migration(self):
        pass
