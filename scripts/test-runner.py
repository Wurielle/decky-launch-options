"""Offline runner/import checks: python3 scripts/test-runner.py (Linux/WSL)."""
import asyncio
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from runner_test_support import ROOT, install_runner, plugin


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dlor runner ")
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        install_runner(self.home)
        self.source = {"recipe": "optiscaler", "script": "update-nightly", "sha": "1" * 40}
        self.source["url"] = ("https://raw.githubusercontent.com/Wurielle/decky-launch-options-recipes/"
                              + self.source["sha"] + "/recipes/optiscaler/scripts/update-nightly.sh")
        self.bin = self.home / "bin"
        self.bin.mkdir()
        self.downloads = self.home / "tmp"
        self.downloads.mkdir()
        self.env = dict(os.environ, HOME=str(self.home),
                        PATH=f"{self.bin}:{os.environ['PATH']}",
                        TMPDIR=str(self.downloads), STEAM_COMPAT_INSTALL_PATH="game with spaces")
        self.env["SYSTEM_PATH"] = self.env["PATH"]
        self.payload = self.home / "remote.sh"
        self.payload.write_text('printf "%s" "$1" > "$HOME/helper-ran"\n')
        self.tool("curl", '''
printf '%s\n' "${@: -1}" >> "$HOME/downloads"
while [[ "$1" != --output ]]; do shift; done
cat "$HOME/remote.sh" > "$2"
exit "${DOWNLOAD_STATUS:-0}"
''')

    def tool(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/bash\n" + body)
        path.chmod(0o755)

    def command(self, source=None, pinned=True):
        source = self.source if source is None else source
        return [str(self.home / ".dlor/run"), source["recipe"], source["script"],
                *([source["sha"]] if pinned else []), "--",
                "/bin/bash", "-c", 'printf game > "$HOME/game-ran"; exit "${GAME_STATUS:-0}"']

    def run_game(self, source=None, pinned=True):
        result = subprocess.run(self.command(source, pinned), env=self.env,
                                capture_output=True, text=True, timeout=15)
        self.assertEqual((self.home / "game-ran").read_text(), "game")
        self.assertEqual(list(self.downloads.iterdir()), [])
        return result

    def test_pinned_command_is_reused_offline_with_integrity_metadata(self):
        self.assertEqual(self.run_game().returncode, 0)
        (self.home / "helper-ran").unlink()
        self.env["DOWNLOAD_STATUS"] = "22"
        self.assertEqual(self.run_game().returncode, 0)
        self.assertEqual((self.home / "downloads").read_text().splitlines(), [self.source["url"]])
        self.assertEqual((self.home / "helper-ran").read_text(), "game with spaces")
        cached = list((self.home / ".dlor/cache/commands").glob("*/command.sh"))
        self.assertEqual(len(cached), 1)
        import hashlib
        self.assertEqual((cached[0].parent / "sha256").read_text().strip(),
                         hashlib.sha256(cached[0].read_bytes()).hexdigest())

    def test_omitted_sha_downloads_dev_each_time_without_import(self):
        self.assertEqual(self.run_game(pinned=False).returncode, 0)
        self.assertEqual(self.run_game(pinned=False).returncode, 0)
        self.assertEqual(self.run_game().returncode, 0)
        dev_url = self.source["url"].replace(self.source["sha"], "refs/heads/dev")
        self.assertEqual((self.home / "downloads").read_text().splitlines(),
                         [dev_url, dev_url, self.source["url"]])

    def test_repository_override_preserves_fork_source(self):
        self.env["DLOR_REPOSITORY"] = "someone/custom-recipes"
        self.assertEqual(self.run_game().returncode, 0)
        expected = self.source["url"].replace("Wurielle/decky-launch-options-recipes", "someone/custom-recipes")
        self.assertEqual((self.home / "downloads").read_text().strip(), expected)

    def test_invalid_repository_never_downloads(self):
        self.env["DLOR_REPOSITORY"] = "../bad/path"
        self.assertEqual(self.run_game().returncode, 0)
        self.assertFalse((self.home / "downloads").exists())

    def test_unpinned_game_arguments_are_preserved(self):
        args = ["path with spaces", 'with "quotes"', "$literal", "--"]
        command = self.command(pinned=False)
        game_index = command.index("--") + 1
        command[game_index:] = ["python3", "-c",
                               "import json, sys; print(json.dumps(sys.argv[1:]))", *args]
        result = subprocess.run(command, env=self.env, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0)
        import json
        self.assertIn(json.dumps(args), result.stdout)

    def test_failed_partial_download_never_executes_but_game_still_runs(self):
        self.env["DOWNLOAD_STATUS"] = "22"
        result = self.run_game()
        self.assertEqual(result.returncode, 0)
        self.assertFalse((self.home / "helper-ran").exists())
        logs = list((self.home / ".dlor/logs/run").glob("*.log"))
        self.assertIn("finished with exit status 22", logs[0].read_text())

    def test_empty_download_is_rejected(self):
        self.payload.write_text("")
        result = self.run_game()
        self.assertIn("downloaded script is empty", result.stdout)
        self.assertEqual(result.returncode, 0)

    def test_script_failure_and_game_exit_status(self):
        self.payload.write_text('echo "helper failure" >&2\nexit 17\n')
        self.env["GAME_STATUS"] = "42"
        result = self.run_game()
        self.assertEqual(result.returncode, 42)
        self.assertIn("Recipe helper failed (exit 17)", result.stderr)

    def test_invalid_arguments_continue_game(self):
        for source in (
            {**self.source, "recipe": "../../outside"},
            {**self.source, "script": "../update.sh"},
            {**self.source, "script": "update.sh"},
            {**self.source, "sha": "main"},
            {**self.source, "sha": self.source["sha"][:7]},
        ):
            result = self.run_game(source)
            self.assertEqual(result.returncode, 0)
        self.assertFalse((self.home / "downloads").exists())

    def test_log_creation_and_write_failure_do_not_stop_launch(self):
        blocker = self.home / ".dlor/logs"
        blocker.write_text("blocked")
        self.assertEqual(self.run_game().returncode, 0)
        blocker.unlink()
        self.tool("tee", 'exec /usr/bin/tee "$@" /dev/full\n')
        self.assertEqual(self.run_game().returncode, 0)

    def test_concurrent_launches_publish_one_complete_download(self):
        self.tool("curl", '''
printf '%s\\n' "${@: -1}" >> "$HOME/downloads"
while [[ "$1" != --output ]]; do shift; done
printf 'printf complete >> "$HOME/helpers"\\n' > "$2"
sleep 0.2
printf 'printf end >> "$HOME/helpers"\\n' >> "$2"
''')
        processes = [subprocess.Popen(self.command(), env=self.env, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True) for _ in range(4)]
        for process in processes:
            stdout, stderr = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 0, stdout + stderr)
        self.assertEqual(list(self.downloads.iterdir()), [])
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 1)
        self.assertEqual((self.home / "helpers").read_text().count("complete"), 4)
        self.assertEqual((self.home / "helpers").read_text().count("end"), 4)
        self.assertEqual(list((self.home / ".dlor/cache/commands").glob(".download.*")), [])

    def cached_command(self):
        entries = list((self.home / ".dlor/cache/commands").glob("*/command.sh"))
        self.assertEqual(len(entries), 1)
        return entries[0]

    def test_corrupt_command_is_repaired_before_execution(self):
        self.run_game()
        self.cached_command().write_text('touch "$HOME/corrupt-ran"\n')
        self.run_game()
        self.assertFalse((self.home / "corrupt-ran").exists())
        self.assertEqual(self.cached_command().read_bytes(), self.payload.read_bytes())
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 2)

    def test_corrupt_command_offline_is_never_executed(self):
        self.run_game()
        (self.home / "helper-ran").unlink()
        self.cached_command().write_text('touch "$HOME/corrupt-ran"\n')
        self.env["DOWNLOAD_STATUS"] = "22"
        self.run_game()
        self.assertFalse((self.home / "helper-ran").exists())
        self.assertFalse((self.home / "corrupt-ran").exists())

    def test_missing_or_invalid_digest_is_repaired(self):
        self.run_game()
        digest = self.cached_command().parent / "sha256"
        for value in (None, "not a digest", "0" * 64):
            if value is None:
                digest.unlink()
            else:
                digest.write_text(value)
            self.run_game()
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 4)

    def test_repository_revision_recipe_and_script_keys_are_isolated(self):
        self.run_game()
        for key, value in (("sha", "2" * 40), ("recipe", "another"), ("script", "install")):
            self.run_game({**self.source, key: value})
        self.env["DLOR_REPOSITORY"] = "fork/recipes"
        self.run_game()
        self.assertEqual(len(list((self.home / ".dlor/cache/commands").glob("*/command.sh"))), 5)
        self.env.pop("DLOR_REPOSITORY")
        self.env["DOWNLOAD_STATUS"] = "22"
        self.run_game()
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 5)

    def test_failed_transfer_is_not_published_and_next_launch_retries(self):
        self.env["DOWNLOAD_STATUS"] = "22"
        self.run_game()
        self.assertEqual(list((self.home / ".dlor/cache/commands").glob("*/command.sh")), [])
        self.env.pop("DOWNLOAD_STATUS")
        self.run_game()
        self.assertTrue((self.home / "helper-ran").exists())
        self.cached_command()

    def test_invalid_shell_is_not_published_or_executed(self):
        self.payload.write_text('touch "$HOME/invalid-ran"\nif then\n')
        self.run_game()
        self.assertFalse((self.home / "invalid-ran").exists())
        self.assertEqual(list((self.home / ".dlor/cache/commands").glob("*/command.sh")), [])

    def test_failed_publication_cleans_staging_and_retries(self):
        self.tool("mv", "exit 19\n")
        self.run_game()
        self.assertEqual(list((self.home / ".dlor/cache/commands").glob(".download.*")), [])
        self.assertFalse((self.home / "helper-ran").exists())
        (self.bin / "mv").unlink()
        self.run_game()
        self.cached_command()

    def test_mutable_dev_does_not_use_stale_or_pinned_cache_offline(self):
        self.run_game()
        self.run_game(pinned=False)
        (self.home / "helper-ran").unlink()
        self.env["DOWNLOAD_STATUS"] = "22"
        self.run_game(pinned=False)
        self.assertFalse((self.home / "helper-ran").exists())
        self.run_game()
        self.assertTrue((self.home / "helper-ran").exists())
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 3)

    def test_symlinked_home_ancestor_is_supported(self):
        alias = self.home / "alias"
        alias.symlink_to(self.home, target_is_directory=True)
        self.env["HOME"] = str(alias / ".")
        self.run_game()
        self.run_game()
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 1)

    def test_cache_internal_symlink_is_rejected(self):
        outside = self.home / "outside"
        outside.mkdir()
        (self.home / ".dlor/cache").symlink_to(outside, target_is_directory=True)
        self.run_game()
        self.assertFalse((self.home / "downloads").exists())
        self.assertEqual(list(outside.iterdir()), [])

    def test_cached_command_symlink_is_not_followed(self):
        self.run_game()
        command = self.cached_command()
        command.unlink()
        command.symlink_to(self.payload)
        original = self.payload.read_bytes()
        self.run_game()
        self.assertFalse(command.is_symlink())
        self.assertEqual(self.payload.read_bytes(), original)

    def test_warm_cache_preserves_game_argv_environment_stdin_and_exit(self):
        self.run_game()
        self.payload.write_text('exit 99\n')
        self.env.update(DOWNLOAD_STATUS="22", STEAM_RUNTIME="/steam/runtime",
                        LD_LIBRARY_PATH="game-libraries", TEST_VALUE="literal value")
        command = self.command()
        command[command.index("--") + 1:] = ["/usr/bin/python3", "-c",
            'import os,sys,json; print(json.dumps([sys.argv[1:], sys.stdin.read(), '
            '[os.environ[k] for k in ("STEAM_RUNTIME", "LD_LIBRARY_PATH", "TEST_VALUE")]])); sys.exit(42)',
            "space 雪", 'a"b', "$literal", "--"]
        result = subprocess.run(command, env=self.env, input="game input", text=True,
                                capture_output=True, timeout=15)
        self.assertEqual(result.returncode, 42)
        import json
        self.assertIn(json.dumps([["space 雪", 'a"b', "$literal", "--"], "game input",
                                   ["/steam/runtime", "game-libraries", "literal value"]]), result.stdout)
        self.assertEqual(len((self.home / "downloads").read_text().splitlines()), 1)

    def test_helper_inherits_original_umask(self):
        self.payload.write_text('umask > "$HOME/helper-umask"\n')
        command = ["/bin/bash", "-c", 'umask 022; exec "$@"', "--", *self.command()]
        result = subprocess.run(command, env=self.env, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0)
        self.assertEqual((self.home / "helper-umask").read_text().strip(), "0022")

    def test_plugin_startup_repairs_launcher(self):
        with patch.object(plugin.decky, "DECKY_USER_HOME", str(self.home)), \
                patch.object(plugin.Plugin, "prepare", new_callable=AsyncMock):
            (self.home / ".dlor/run").write_text("old launcher")
            asyncio.run(plugin.Plugin()._main())
            self.assertTrue((self.home / ".dlor/run").read_text().startswith("#!/bin/bash"))
        self.assertEqual(self.run_game().returncode, 0)

    def test_packaged_plugin_installs_runner_without_recipe_sources(self):
        package = self.home / "plugin"
        package.mkdir()
        # Match Decky CLI: defaults/dlor-run.sh becomes dlor-run.sh in the ZIP.
        (package / "dlor-run.sh").write_bytes((ROOT / "defaults/dlor-run.sh").read_bytes())
        with patch.object(plugin, "__file__", str(package / "main.py")), \
                patch.object(plugin.decky, "DECKY_USER_HOME", str(self.home)):
            plugin._install_runner()
        self.assertEqual(self.run_game().returncode, 0)


if __name__ == "__main__":
    unittest.main()
