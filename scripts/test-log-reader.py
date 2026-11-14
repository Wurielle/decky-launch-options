"""Offline backend checks: python3 scripts/test-log-reader.py."""

import importlib.util
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recipe_plugin", ROOT / "main.py")
plugin_module = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, decky=SimpleNamespace(DECKY_USER_HOME="/unused", DECKY_PLUGIN_DIR=str(ROOT), logger=SimpleNamespace(info=lambda _message: None))):
    spec.loader.exec_module(plugin_module)


class LogReaderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="recipe-log-reader-")
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.logs = self.home / ".dlor/logs"
        user_home = patch.object(plugin_module.decky, "DECKY_USER_HOME", str(self.home))
        user_home.start()
        self.addCleanup(user_home.stop)
        self.plugin = plugin_module.Plugin()

    def write_log(self, content):
        path = self.logs / "reframework/update/2026-09-15.log"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    async def test_picker_directory_is_created_in_decky_user_home(self):
        with patch.dict("os.environ", HOME="/some-other-home"):
            self.assertEqual(await self.plugin.get_logs_directory(), str(self.logs))
        self.assertTrue(self.logs.is_dir())
        self.assertEqual(await self.plugin.get_logs_directory(), str(self.logs))

    async def test_reads_nested_log_as_plain_text(self):
        content = "stdout\nError: failed\n<script>literal text</script>\né\n"
        result = await self.plugin.read_log_file(str(self.write_log(content.encode())))
        self.assertEqual(result, {
            "path": "reframework/update/2026-09-15.log",
            "content": content,
            "truncated": False,
        })

    async def test_empty_log(self):
        result = await self.plugin.read_log_file(str(self.write_log(b"")))
        self.assertEqual(result["content"], "")
        self.assertFalse(result["truncated"])

    async def test_invalid_utf8_is_readable(self):
        result = await self.plugin.read_log_file(str(self.write_log(b"failure: \xff\n")))
        self.assertEqual(result["content"], "failure: \ufffd\n")

    async def test_large_log_returns_bounded_tail(self):
        limit = plugin_module.MAX_LOG_BYTES
        path = self.write_log(b"older data\n" + b"x" * limit + b"\nlatest error\n")
        result = await self.plugin.read_log_file(str(path))
        self.assertTrue(result["truncated"])
        self.assertEqual(len(result["content"]), limit)
        self.assertTrue(result["content"].endswith("latest error\n"))
        self.assertNotIn("older data", result["content"])

    async def test_outside_paths_and_symlinks_are_rejected(self):
        await self.plugin.get_logs_directory()
        outside = self.home / ".dlor/logs-other/private.log"
        outside.parent.mkdir()
        outside.write_text("unrelated")
        link = self.logs / "outside.log"
        link.symlink_to(outside)
        for path in (outside, link, self.logs / "../logs-other/private.log"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "inside ~/.dlor/logs"):
                await self.plugin.read_log_file(str(path))

    async def test_non_log_files_are_rejected(self):
        path = self.write_log(b"log").with_suffix(".ini")
        path.write_text("configuration")
        with self.assertRaises(ValueError):
            await self.plugin.read_log_file(str(path))

    async def test_missing_files_and_directories_are_reported(self):
        await self.plugin.get_logs_directory()
        directory = self.logs / "directory.log"
        directory.mkdir()
        for path in (directory, self.logs / "deleted.log"):
            with self.subTest(path=path), self.assertRaises(FileNotFoundError):
                await self.plugin.read_log_file(str(path))


if __name__ == "__main__":
    unittest.main()
