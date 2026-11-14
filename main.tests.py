import asyncio
import concurrent.futures
import errno
import json
import os
import signal
import stat
import subprocess
import sys
import threading
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
            self.assertIn(
                f'exec python "{main.PY_LAUNCHER_PATH}" "$@"\n',
                (folder_path / "run").read_text(encoding="utf-8"),
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


class SettingsFileTests(unittest.TestCase):
    def setUp(self):
        temporary_directory = TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        self.path = Path(temporary_directory.name) / "settings.json"
        self.plugin = main.Plugin()
        settings_patch = patch.object(main, "SETTINGS_PATH", str(self.path))
        settings_patch.start()
        self.addCleanup(settings_patch.stop)

    def read(self):
        return asyncio.run(self.plugin.get_settings())

    def save(self, data):
        return asyncio.run(self.plugin.set_settings(data))

    def backups(self):
        return sorted(self.path.parent.glob("settings.json.corrupt-*"))

    def test_atomic_save_leaves_no_temporary_files(self):
        self.path.write_text('{"old": true}', encoding="utf-8")
        self.save({"profiles": {}})
        self.assertEqual(self.read(), {"profiles": {}})
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_serialization_and_replace_failures_keep_previous_file(self):
        original = '{"old": true}'
        self.path.write_text(original, encoding="utf-8")
        with self.assertRaises(TypeError):
            self.save({"bad": object()})
        with patch.object(main.os, "replace", side_effect=OSError("replace failed")):
            with self.assertRaises(OSError):
                self.save({"new": True})
        self.assertEqual(self.path.read_text(encoding="utf-8"), original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_corrupt_bytes_are_preserved_before_read_returns_empty(self):
        for original in (b'{"profiles": {', b'\xff\xfeinvalid utf8'):
            with self.subTest(original=original):
                previous = set(self.backups())
                self.path.write_bytes(original)
                self.assertIsNone(self.read())
                new_backups = set(self.backups()) - previous
                self.assertEqual(len(new_backups), 1)
                self.assertEqual(new_backups.pop().read_bytes(), original)
                self.assertEqual(self.path.read_bytes(), original)

    def test_failed_preservation_blocks_reads_and_direct_saves(self):
        original = b'only recoverable original {'
        self.path.write_bytes(original)
        with patch.object(
            self.plugin,
            "_preserve_corrupt_json",
            side_effect=PermissionError("backup failed"),
        ):
            with self.assertRaises(PermissionError):
                self.read()
            with self.assertRaises(PermissionError):
                self.save({"profiles": {}})
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_direct_save_preserves_corruption_without_a_prior_read(self):
        original = b'original {'
        self.path.write_bytes(original)
        self.save({"profiles": {}})
        self.assertEqual(self.read(), {"profiles": {}})
        self.assertEqual([p.read_bytes() for p in self.backups()], [original])

    def test_repeated_recovery_never_replaces_an_earlier_backup(self):
        for contents in (b'first {', b'second {'):
            self.path.write_bytes(contents)
            self.assertIsNone(self.read())
        self.assertCountEqual(
            [p.read_bytes() for p in self.backups()],
            [b'first {', b'second {'],
        )

    def test_backup_name_collision_fails_without_overwriting(self):
        self.path.write_bytes(b'new corrupt original {')
        collision = self.path.with_name("settings.json.corrupt-collision")
        collision.write_bytes(b'previous backup {')
        with patch.object(
            main.uuid, "uuid4", return_value=types.SimpleNamespace(hex="collision")
        ):
            with self.assertRaises(FileExistsError):
                self.read()
            with self.assertRaises(FileExistsError):
                self.save({"profiles": {}})
        self.assertEqual(collision.read_bytes(), b'previous backup {')
        self.assertEqual(self.path.read_bytes(), b'new corrupt original {')
        self.assertEqual(list(self.path.parent.glob("*.tmp")), [])

    def test_external_replacement_is_not_quarantined_by_old_reader(self):
        original = b'corrupt inode {'
        self.path.write_bytes(original)
        real_loads = json.loads

        def replace_after_read(contents):
            replacement = self.path.with_name("replacement.json")
            replacement.write_text('{"new valid save": true}', encoding="utf-8")
            os.replace(replacement, self.path)
            return real_loads(contents)

        with patch.object(main.json, "loads", side_effect=replace_after_read):
            self.assertIsNone(self.read())
        self.assertEqual(self.read(), {"new valid save": True})
        self.assertEqual([p.read_bytes() for p in self.backups()], [original])

    def test_public_read_and_save_serialize_recovery(self):
        self.path.write_bytes(b'corrupt {')
        entered_recovery = threading.Event()
        release_recovery = threading.Event()
        entered_write = threading.Event()
        real_preserve = self.plugin._preserve_corrupt_json
        real_write = self.plugin._write_json

        def preserve(*args):
            entered_recovery.set()
            if not release_recovery.wait(5):
                raise TimeoutError("test did not release recovery")
            return real_preserve(*args)

        def write(*args):
            entered_write.set()
            return real_write(*args)

        with (
            patch.object(self.plugin, "_preserve_corrupt_json", side_effect=preserve),
            patch.object(self.plugin, "_write_json", side_effect=write),
        ):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                reader = pool.submit(self.read)
                try:
                    self.assertTrue(entered_recovery.wait(5))
                    writer = pool.submit(self.save, {"new valid save": True})
                    self.assertTrue(entered_write.wait(5))
                    self.assertFalse(writer.done())
                finally:
                    release_recovery.set()
                self.assertIsNone(reader.result(timeout=5))
                writer.result(timeout=5)
        self.assertEqual(self.read(), {"new valid save": True})
        self.assertTrue(all(p.read_bytes() == b'corrupt {' for p in self.backups()))

    def test_valid_and_corrupt_symlink_targets_keep_the_link(self):
        target = self.path.parent / "target.json"
        target.write_text('{}', encoding="utf-8")
        self.path.symlink_to(target.name)
        self.save({"first": True})
        self.assertTrue(self.path.is_symlink())
        self.assertEqual(json.loads(target.read_text()), {"first": True})
        target.write_bytes(b'corrupt {')
        self.assertIsNone(self.read())
        self.assertTrue(self.path.is_symlink())
        self.save({"second": True})
        self.assertTrue(self.path.is_symlink())
        self.assertEqual(json.loads(target.read_text()), {"second": True})
        backups = list(target.parent.glob("*.corrupt-*"))
        self.assertTrue(backups)
        self.assertTrue(all(not p.is_symlink() for p in backups))
        self.assertTrue(all(p.read_bytes() == b'corrupt {' for p in backups))

    def test_existing_private_permissions_are_preserved(self):
        self.path.write_bytes(b'corrupt {')
        self.path.chmod(0o600)
        self.save({"profiles": {}})
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.backups()[0].stat().st_mode), 0o600)

    def test_new_file_respects_creation_umask(self):
        for mask, expected in ((0o077, 0o600), (0o022, 0o644)):
            with self.subTest(mask=mask):
                self.path.unlink(missing_ok=True)
                previous = os.umask(mask)
                try:
                    self.save({"profiles": {}})
                finally:
                    os.umask(previous)
                self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), expected)

    def test_file_and_directory_sync_order(self):
        events = []
        real_fsync = os.fsync
        real_replace = os.replace

        def sync(fd):
            is_directory = stat.S_ISDIR(os.fstat(fd).st_mode)
            events.append("directory" if is_directory else "file")
            return real_fsync(fd)

        def replace(*args):
            events.append("replace")
            return real_replace(*args)

        with (
            patch.object(main.os, "fsync", side_effect=sync),
            patch.object(main.os, "replace", side_effect=replace),
        ):
            self.save({"valid": True})
            self.assertEqual(events, ["file", "replace", "directory"])
            events.clear()
            self.path.write_bytes(b'corrupt {')
            self.save({"valid": True})
            self.assertEqual(
                events, ["file", "file", "directory", "replace", "directory"]
            )

    def test_backup_sync_failure_prevents_replacement(self):
        self.path.write_bytes(b'corrupt {')
        with patch.object(
            self.plugin, "_sync_json_directory", side_effect=OSError("sync failed")
        ):
            with self.assertRaises(OSError):
                self.save({"valid": True})
        self.assertEqual(self.path.read_bytes(), b'corrupt {')
        self.assertEqual([p.read_bytes() for p in self.backups()], [b'corrupt {'])
        self.assertEqual(list(self.path.parent.glob("*.tmp")), [])

    def test_file_sync_failure_keeps_original_and_removes_partial_backup(self):
        self.path.write_bytes(b'corrupt {')
        with patch.object(main.os, "fsync", side_effect=OSError("sync failed")):
            with self.assertRaises(OSError):
                self.read()
            with self.assertRaises(OSError):
                self.save({"valid": True})
        self.assertEqual(self.path.read_bytes(), b'corrupt {')
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_temporary_name_collision_does_not_remove_existing_file(self):
        self.path.write_text('{}', encoding="utf-8")
        collision = self.path.with_name(".settings.json.collision.tmp")
        collision.write_bytes(b'existing temporary file')
        with patch.object(
            main.uuid, "uuid4", return_value=types.SimpleNamespace(hex="collision")
        ):
            with self.assertRaises(FileExistsError):
                self.save({"valid": True})
        self.assertEqual(collision.read_bytes(), b'existing temporary file')
        self.assertEqual(self.read(), {})

    def test_partial_disk_full_writes_keep_original_and_clean_up(self):
        original = b'corrupt original {'
        real_open = Path.open

        for failing_mode in ("x", "xb"):
            with self.subTest(failing_mode=failing_mode):
                self.path.write_bytes(original)

                def open_with_failure(path, mode="r", *args, **kwargs):
                    stream = real_open(path, mode, *args, **kwargs)
                    if mode == failing_mode:
                        real_write = stream.write

                        def partial_write(contents):
                            real_write(contents[:1])
                            raise OSError(errno.ENOSPC, "disk full")

                        stream.write = partial_write
                    return stream

                with patch.object(Path, "open", new=open_with_failure):
                    with self.assertRaises(OSError) as raised:
                        self.save({"new": True})
                self.assertEqual(raised.exception.errno, errno.ENOSPC)
                self.assertEqual(self.path.read_bytes(), original)
                self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_unlocked_launcher_readers_see_complete_concurrent_saves(self):
        def value(sequence):
            return {"sequence": sequence, "payload": str(sequence) * 8192}

        self.save(value(0))
        stop = threading.Event()

        def reader(ready):
            count = 0
            ready.set()
            while not stop.is_set():
                # The standalone launcher does not share the backend's lock.
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self.assertEqual(data, value(data["sequence"]))
                count += 1
            return count

        def writer(offset):
            for sequence in range(offset, offset + 20):
                self.save(value(sequence))

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            ready = [threading.Event(), threading.Event()]
            readers = [pool.submit(reader, event) for event in ready]
            try:
                self.assertTrue(all(event.wait(5) for event in ready))
                writers = [pool.submit(writer, offset) for offset in (1, 21)]
                for future in writers:
                    future.result(timeout=15)
            finally:
                stop.set()
            self.assertTrue(all(future.result(timeout=5) > 0 for future in readers))
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_failed_directory_sync_after_replace_reports_error_with_valid_file(self):
        self.path.write_text('{"old": true}', encoding="utf-8")
        with patch.object(
            self.plugin, "_sync_json_directory", side_effect=OSError("sync failed")
        ):
            with self.assertRaises(OSError):
                self.save({"new": True})
        self.assertEqual(self.read(), {"new": True})
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_process_death_before_and_after_replace_keeps_complete_json(self):
        script = '''
import os, signal, sys, types
from unittest.mock import patch
sys.path.insert(0, sys.argv[1])
decky = types.ModuleType("decky")
decky.DECKY_PLUGIN_DIR = sys.argv[1]
decky.logger = types.SimpleNamespace(info=lambda _: None)
sys.modules["decky"] = decky
import main
real_replace = os.replace
def replace(*args):
    if sys.argv[3] == "after":
        real_replace(*args)
    os.kill(os.getpid(), signal.SIGKILL)
with patch.object(main.os, "replace", side_effect=replace):
    main.Plugin()._write_json(sys.argv[2], {"new": True})
'''
        for phase, original, expected in (
            ("before", b'{"old": true}', {"old": True}),
            ("after", b'{"old": true}', {"new": True}),
            ("before", b'corrupt original {', None),
            ("after", b'corrupt original {', {"new": True}),
        ):
            with self.subTest(phase=phase, original=original):
                self.path.write_bytes(original)
                result = subprocess.run(
                    [sys.executable, "-c", script,
                     str(Path(main.__file__).parent), str(self.path), phase],
                    capture_output=True,
                    timeout=10,
                )
                self.assertEqual(
                    result.returncode, -signal.SIGKILL, result.stderr.decode()
                )
                if expected is None:
                    self.assertEqual(self.path.read_bytes(), original)
                else:
                    self.assertEqual(self.read(), expected)
                if original == b'corrupt original {':
                    self.assertIn(original, [p.read_bytes() for p in self.backups()])


if __name__ == "__main__":
    unittest.main()
