import asyncio
import sys
import types
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch


if "decky" not in sys.modules:
    decky = types.ModuleType("decky")
    decky.DECKY_PLUGIN_DIR = "/plugin"
    decky.logger = types.SimpleNamespace(info=lambda _message: None)
    sys.modules["decky"] = decky

import main


class SettingsFolderBackupTests(unittest.TestCase):
    def test_info_exposes_settings_backup_folder_path(self):
        self.assertEqual(
            main.info["SETTINGS_BACKUP_FOLDER_PATH"],
            main.SETTINGS_BACKUP_FOLDER_PATH,
        )

    def test_prepare_restores_backup_when_settings_folder_is_missing(self):
        with TemporaryDirectory() as temporary_directory:
            home_path = Path(temporary_directory)
            folder_path = home_path / ".dlo"
            backup_folder_path = home_path / ".dlo.backup"
            backup_folder_path.mkdir()
            (backup_folder_path / "settings.json").write_text(
                '{"profiles": {}}',
                encoding="utf-8",
            )

            plugin = main.Plugin()
            with (
                patch.object(main, "SETTINGS_FOLDER_PATH", str(folder_path)),
                patch.object(
                    main,
                    "SETTINGS_BACKUP_FOLDER_PATH",
                    str(backup_folder_path),
                ),
                patch.object(main, "FULL_SH_COMMAND_PATH", str(folder_path / "run")),
                patch.object(
                    plugin,
                    "backup_existing_original_launch_options",
                    new=AsyncMock(),
                ),
            ):
                asyncio.run(plugin.prepare())

            self.assertEqual(
                (folder_path / "settings.json").read_text(encoding="utf-8"),
                '{"profiles": {}}',
            )
            self.assertTrue(backup_folder_path.exists())

    def test_prepare_does_not_restore_over_existing_settings_folder(self):
        with TemporaryDirectory() as temporary_directory:
            home_path = Path(temporary_directory)
            folder_path = home_path / ".dlo"
            backup_folder_path = home_path / ".dlo.backup"
            folder_path.mkdir()
            backup_folder_path.mkdir()
            (folder_path / "settings.json").write_text("current", encoding="utf-8")
            (backup_folder_path / "settings.json").write_text(
                "backup",
                encoding="utf-8",
            )

            plugin = main.Plugin()
            with (
                patch.object(main, "SETTINGS_FOLDER_PATH", str(folder_path)),
                patch.object(
                    main,
                    "SETTINGS_BACKUP_FOLDER_PATH",
                    str(backup_folder_path),
                ),
                patch.object(main, "FULL_SH_COMMAND_PATH", str(folder_path / "run")),
                patch.object(
                    plugin,
                    "backup_existing_original_launch_options",
                    new=AsyncMock(),
                ),
            ):
                asyncio.run(plugin.prepare())

            self.assertEqual(
                (folder_path / "settings.json").read_text(encoding="utf-8"),
                "current",
            )

    def test_uninstall_replaces_backup_with_current_settings(self):
        with TemporaryDirectory() as temporary_directory:
            home_path = Path(temporary_directory)
            folder_path = home_path / ".dlo"
            backup_folder_path = home_path / ".dlo.backup"
            folder_path.mkdir()
            backup_folder_path.mkdir()
            (folder_path / "settings.json").write_text("current", encoding="utf-8")
            (backup_folder_path / "stale.json").write_text("stale", encoding="utf-8")

            plugin = main.Plugin()
            with (
                patch.object(main, "SETTINGS_FOLDER_PATH", str(folder_path)),
                patch.object(
                    main,
                    "SETTINGS_BACKUP_FOLDER_PATH",
                    str(backup_folder_path),
                ),
                patch.object(main, "FULL_SH_COMMAND_PATH", str(folder_path / "run")),
            ):
                asyncio.run(plugin._uninstall())

            self.assertEqual(
                (backup_folder_path / "settings.json").read_text(encoding="utf-8"),
                "current",
            )
            self.assertFalse((backup_folder_path / "stale.json").exists())
            self.assertEqual(
                (backup_folder_path / "run").read_text(encoding="utf-8"),
                '#!/bin/bash\nexec "$@"\n',
            )


if __name__ == "__main__":
    unittest.main()
