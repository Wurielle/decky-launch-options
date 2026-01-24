import asyncio
import json
import os
import stat
from pathlib import Path

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky

PY_LAUNCHER_PATH = os.path.join(decky.DECKY_PLUGIN_DIR, "run.py")

CONFIG_FOLDER_NAME = 'dlo'
CONFIG_FOLDER_PATH = os.path.join(decky.DECKY_USER_HOME, CONFIG_FOLDER_NAME)
CONFIG_PATH = f"{os.path.join(CONFIG_FOLDER_PATH, 'config.json')}"

SH_COMMAND_NAME = "run"
SHORT_SH_COMMAND_PATH = os.path.join('~', CONFIG_FOLDER_NAME, SH_COMMAND_NAME)
FULL_SH_COMMAND_PATH = os.path.join(CONFIG_FOLDER_PATH, SH_COMMAND_NAME)
COMMAND = f"{SHORT_SH_COMMAND_PATH} %command%"

folder_path = Path(CONFIG_FOLDER_PATH)
folder_path.mkdir(parents=True, exist_ok=True)

with open(FULL_SH_COMMAND_PATH, "w") as file:
    file.write("#!/bin/bash\n")
    file.write(f"python \"{PY_LAUNCHER_PATH}\" \"$@\"\n")

current_stat = os.stat(FULL_SH_COMMAND_PATH)
os.chmod(FULL_SH_COMMAND_PATH, current_stat.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

info = {
    "CONFIG_FOLDER_NAME": CONFIG_FOLDER_NAME,
    "CONFIG_FOLDER_PATH": CONFIG_FOLDER_PATH,
    "CONFIG_PATH": CONFIG_PATH,
    "SH_COMMAND_NAME": SH_COMMAND_NAME,
    "SHORT_SH_COMMAND_PATH": SHORT_SH_COMMAND_PATH,
    "FULL_SH_COMMAND_PATH": FULL_SH_COMMAND_PATH,
    "COMMAND": COMMAND,
}


def log(str):
    decky.logger.info(f"------- DLO: {str}")


class Plugin:
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
        userdata_path = await self.get_steam_path() / "userdata"

        if not userdata_path.exists():
            raise FileNotFoundError(f"Steam userdata directory not found at: {userdata_path}")

        # Find user directories (numeric directories)
        user_dirs = [d for d in userdata_path.iterdir() if d.is_dir() and d.name.isdigit()]

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

    async def get_original_command(self, appid):
        print(f"Getting original command for app {appid}")
        return 'ooo'

    async def get_info(self):
        return info

    async def set_config(self, data):
        return await asyncio.to_thread(self._write_json, CONFIG_PATH, data)

    async def get_config(self):
        return await asyncio.to_thread(self._read_json, CONFIG_PATH)

    async def cleanup(self):
        pass

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        print(await self.get_localconfig_vdf_path())

    async def _unload(self):
        await self.cleanup()

    async def _uninstall(self):
        pass

    async def _migration(self):
        pass
