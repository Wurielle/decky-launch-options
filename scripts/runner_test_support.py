"""Use the real backend installation path with a temporary Decky user home."""
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("runner_plugin", ROOT / "main.py")
plugin = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, decky=SimpleNamespace(DECKY_USER_HOME="/unused", DECKY_PLUGIN_DIR=str(ROOT), logger=SimpleNamespace(info=lambda _message: None))):
    spec.loader.exec_module(plugin)


def install_runner(home):
    with patch.object(plugin.decky, "DECKY_USER_HOME", str(home)):
        plugin._install_runner()
