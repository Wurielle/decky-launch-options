#!/usr/bin/env python3
"""
Test script to verify launch option parsing behavior.
Run with: python test_launch_options.py
"""

import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add current directory to path to import run.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import patch
from run import parse_launch_option, get_final_args_details

def test_case(name, raw_command, expected=None):
    print(f"\n{'='*60}")
    print(f"Test: {name}")
    print(f"{'='*60}")
    print(f"Input: {raw_command}")
    print()

    result = parse_launch_option(raw_command)

    print(f"Env vars: {result['env_vars']}")
    print(f"Prefix:   {result['prefix']}")
    print(f"Suffix:   {result['suffix']}")

    if expected:
        print(f"\nExpected:")
        print(f"Env vars: {expected.get('env_vars', {})}")
        print(f"Prefix:   {expected.get('prefix', [])}")
        print(f"Suffix:   {expected.get('suffix', [])}")

        matches = (
            result['env_vars'] == expected.get('env_vars', {}) and
            result['prefix'] == expected.get('prefix', []) and
            result['suffix'] == expected.get('suffix', [])
        )
        print(f"\n✓ PASS" if matches else "\n✗ FAIL")

    return result

if __name__ == "__main__":
    print("Launch Option Parser Tests")
    print("="*60)

    # Test 1: Simple env var
    test_case(
        "Simple environment variable",
        "SteamDeck=1 %command%",
        {
            'env_vars': {'SteamDeck': '1'},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 2: Env var with prefix
    test_case(
        "Env var with prefix",
        "PROTON_NO_ESYNC=1 MANGOHUD_DLSYM=1 ~/lsfg mangohud %command%",
        {
            'env_vars': {'PROTON_NO_ESYNC': '1', 'MANGOHUD_DLSYM': '1'},
            'prefix': ['~/lsfg', 'mangohud'],
            'suffix': []
        }
    )

    # Test 3: Complex launch option
    test_case(
        "Complex launch option with args on both sides",
        "MANGOHUD=1 gamemoderun gamescope -w 1280 -h 720 -W 1920 -H 1080 -f --mangoapp -- %command% -novid -console +fps_max 60",
        {
            'env_vars': {'MANGOHUD': '1'},
            'prefix': ['gamemoderun', 'gamescope', '-w', '1280', '-h', '720', '-W', '1920', '-H', '1080', '-f', '--mangoapp', '--'],
            'suffix': ['-novid', '-console', '+fps_max', '60']
        }
    )

    # Test 4: Just prefix
    test_case(
        "Just prefix command",
        "mangohud %command%",
        {
            'env_vars': {},
            'prefix': ['mangohud'],
            'suffix': []
        }
    )

    # Test 5: Just suffix
    test_case(
        "Just suffix args",
        "%command% -novid -console",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': ['-novid', '-console']
        }
    )

    # Test 6: No %command% - prefix only
    test_case(
        "Prefix only (no %command%)",
        "mangohud",
        {
            'env_vars': {},
            'prefix': ['mangohud'],
            'suffix': []
        }
    )

    # Test 7: No %command% - env vars only
    test_case(
        "Env vars only (no %command%)",
        "PROTON_NO_ESYNC=1 DXVK_ASYNC=1",
        {
            'env_vars': {'PROTON_NO_ESYNC': '1', 'DXVK_ASYNC': '1'},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 8: No %command% - args only
    test_case(
        "Args only (no %command%)",
        "-novid -console +fps_max 60",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': ['-novid', '-console', '+fps_max', '60']
        }
    )

    # Test 9: No %command% - env + args
    test_case(
        "Env + args (no %command%)",
        "DXVK_HUD=fps -novid -console",
        {
            'env_vars': {'DXVK_HUD': 'fps'},
            'prefix': [],
            'suffix': ['-novid', '-console']
        }
    )

    # Test 10: No %command% - env + prefix
    test_case(
        "Env + prefix (no %command%)",
        "MANGOHUD=1 mangohud",
        {
            'env_vars': {'MANGOHUD': '1'},
            'prefix': ['mangohud'],
            'suffix': []
        }
    )

    # Test 11: No %command% - complex (env + prefix + args)
    test_case(
        "Complex without %command% (env + prefix + args)",
        "MANGOHUD=1 mangohud -novid -console",
        {
            'env_vars': {'MANGOHUD': '1'},
            'prefix': ['mangohud'],
            'suffix': ['-novid', '-console']
        }
    )

    # Test 12: Multiple env vars with %command%
    test_case(
        "Multiple environment variables",
        "PROTON_NO_ESYNC=1 DXVK_ASYNC=1 RADV_PERFTEST=aco %command%",
        {
            'env_vars': {'PROTON_NO_ESYNC': '1', 'DXVK_ASYNC': '1', 'RADV_PERFTEST': 'aco'},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 13: Quoted values
    test_case(
        "Quoted values in env vars",
        'MESA_LOADER_DRIVER_OVERRIDE="zink" %command% -fullscreen',
        {
            'env_vars': {'MESA_LOADER_DRIVER_OVERRIDE': 'zink'},
            'prefix': [],
            'suffix': ['-fullscreen']
        }
    )

    # Test 14: Path with = should be treated as prefix
    test_case(
        "Path with = sign",
        "/path/to/script=value something %command%",
        {
            'env_vars': {},
            'prefix': ['/path/to/script=value', 'something'],
            'suffix': []
        }
    )

    # Test 15: Args with = in them
    test_case(
        "Args with = (like --config=value)",
        "-novid --config=myconfig.cfg -console",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': ['-novid', '--config=myconfig.cfg', '-console']
        }
    )

    # Test 16: Multiple prefixes without args
    test_case(
        "Multiple prefix commands",
        "gamemoderun mangohud",
        {
            'env_vars': {},
            'prefix': ['gamemoderun', 'mangohud'],
            'suffix': []
        }
    )

    # Test 17: Empty value env var
    test_case(
        "Env var with empty value",
        "EMPTY_VAR= %command%",
        {
            'env_vars': {'EMPTY_VAR': ''},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 18: Only %command%
    test_case(
        "Only %command% (empty launch option)",
        "%command%",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 19: Args with negative numbers
    test_case(
        "Args with negative numbers",
        "-width -1920 -height -1080",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': ['-width', '-1920', '-height', '-1080']
        }
    )

    # Test 20: Mixed -- in args
    test_case(
        "Args with -- separator",
        "%command% -novid -- -console",
        {
            'env_vars': {},
            'prefix': [],
            'suffix': ['-novid', '--', '-console']
        }
    )

    # Test 21: Env + multiple prefixes + args
    test_case(
        "Complex: env + multiple prefixes + args",
        "DXVK_HUD=fps MANGOHUD=1 gamemoderun mangohud -novid +fps_max 144",
        {
            'env_vars': {'DXVK_HUD': 'fps', 'MANGOHUD': '1'},
            'prefix': ['gamemoderun', 'mangohud'],
            'suffix': ['-novid', '+fps_max', '144']
        }
    )

    # Test 22: Wine with complex WINEDLLOVERRIDES, tilde prefix, and suffix args
    test_case(
        "Wine WINEDLLOVERRIDES with semicolons, tilde prefix, and suffix",
        'ENABLE_VKBASALT=1 WINEDLLOVERRIDES="ScriptHook=n,b;dinput8=n,b;AdvancedHook=n,b" ~/lsfg %command% -norestrictions -nomemrestrict -availablevidmem 6144 -width 1280 -height 800 -refreshrate 60',
        {
            'env_vars': {'ENABLE_VKBASALT': '1', 'WINEDLLOVERRIDES': 'ScriptHook=n,b;dinput8=n,b;AdvancedHook=n,b'},
            'prefix': ['~/lsfg'],
            'suffix': ['-norestrictions', '-nomemrestrict', '-availablevidmem', '6144', '-width', '1280', '-height', '800', '-refreshrate', '60']
        }
    )

    # =========================================================
    # Priority ordering tests
    # =========================================================
    print("\n" + "="*60)
    print("Priority Ordering Tests")
    print("="*60)

    # Helper to build mock settings for priority tests
    OMIT_ENV_VARIABLE_MERGES = object()

    def make_settings(
        launch_options,
        appid="123",
        state=None,
        env_variable_merges=OMIT_ENV_VARIABLE_MERGES,
        original_launch_options="",
    ):
        settings = {
            "profiles": {
                str(appid): {
                    "state": state or {},
                    "originalLaunchOptions": original_launch_options,
                }
            },
            "launchOptions": launch_options,
        }
        if env_variable_merges is not OMIT_ENV_VARIABLE_MERGES:
            settings["envVariableMerges"] = env_variable_merges or []
        return settings

    def make_opt(opt_id, on, priority=0):
        return {
            "id": opt_id,
            "name": opt_id,
            "on": on,
            "off": "",
            "enableGlobally": True,
            "group": "",
            "valueId": "",
            "valueName": "",
            "fallbackValue": False,
            "priority": priority,
        }

    # Save and override sys.argv for tests, mock shutil.which so prefix
    # executables aren't skipped due to not existing on this machine.
    original_argv = sys.argv
    sys.argv = ["run.py", "/path/to/game"]

    with patch("run.shutil.which", return_value="/usr/bin/fake"):

        # Test A: Higher priority prefix comes first (leftmost)
        print(f"\n{'='*60}")
        print("Test: Priority ordering - higher priority runs first")
        print(f"{'='*60}")
        settings_a = make_settings([
            make_opt("a", "mangohud %command%", priority=0),
            make_opt("b", "gamescope %command%", priority=10),
        ])
        final_args_a, _ = get_final_args_details(settings_a, "123")
        # gamescope (priority 10) should be before mangohud (priority 0)
        expected_a = ["gamescope", "mangohud", "/path/to/game"]
        match_a = final_args_a == expected_a
        print(f"Result:   {final_args_a}")
        print(f"Expected: {expected_a}")
        print(f"\n{'✓ PASS' if match_a else '✗ FAIL'}")

        # Test B: Stable sort - equal priorities keep original order
        print(f"\n{'='*60}")
        print("Test: Stable sort - equal priorities keep original array order")
        print(f"{'='*60}")
        settings_b = make_settings([
            make_opt("a", "first %command%", priority=0),
            make_opt("b", "middle %command%", priority=5),
            make_opt("c", "last %command%", priority=0),
        ])
        final_args_b, _ = get_final_args_details(settings_b, "123")
        # middle (priority 5) first, then first and last keep their relative order
        expected_b = ["middle", "first", "last", "/path/to/game"]
        match_b = final_args_b == expected_b
        print(f"Result:   {final_args_b}")
        print(f"Expected: {expected_b}")
        print(f"\n{'✓ PASS' if match_b else '✗ FAIL'}")

        # Test C: All default priority (0) preserves original order
        print(f"\n{'='*60}")
        print("Test: Default priority preserves original array order")
        print(f"{'='*60}")
        settings_c = make_settings([
            make_opt("a", "alpha %command%"),
            make_opt("b", "beta %command%"),
            make_opt("c", "gamma %command%"),
        ])
        final_args_c, _ = get_final_args_details(settings_c, "123")
        expected_c = ["alpha", "beta", "gamma", "/path/to/game"]
        match_c = final_args_c == expected_c
        print(f"Result:   {final_args_c}")
        print(f"Expected: {expected_c}")
        print(f"\n{'✓ PASS' if match_c else '✗ FAIL'}")

        # Test D: Missing/undefined priority treated as 0
        print(f"\n{'='*60}")
        print("Test: Missing priority treated as 0")
        print(f"{'='*60}")
        opt_no_priority = {
            "id": "x",
            "name": "x",
            "on": "tool_x %command%",
            "off": "",
            "enableGlobally": True,
            "group": "",
            "valueId": "",
            "valueName": "",
            "fallbackValue": False,
            # no "priority" key at all
        }
        settings_d = make_settings([
            opt_no_priority,
            make_opt("y", "tool_y %command%", priority=1),
        ])
        final_args_d, _ = get_final_args_details(settings_d, "123")
        # tool_y (priority 1) should be before tool_x (no priority = 0)
        expected_d = ["tool_y", "tool_x", "/path/to/game"]
        match_d = final_args_d == expected_d
        print(f"Result:   {final_args_d}")
        print(f"Expected: {expected_d}")
        print(f"\n{'✓ PASS' if match_d else '✗ FAIL'}")

        # Test E: Merge configured env var values with a semicolon delimiter
        print(f"\n{'='*60}")
        print("Test: Env variable merge - WINEDLLOVERRIDES uses semicolon")
        print(f"{'='*60}")
        settings_e = make_settings(
            [
                make_opt("wine-a", 'WINEDLLOVERRIDES="dinput8=n,b"', priority=0),
                make_opt("wine-b", 'WINEDLLOVERRIDES="dxgi=n,b"', priority=0),
            ],
            env_variable_merges=[
                {
                    "id": "winedlloverrides",
                    "name": "WINEDLLOVERRIDES",
                    "delimiter": ";",
                }
            ],
        )
        _, env_vars_e = get_final_args_details(settings_e, "123")
        expected_e = {"WINEDLLOVERRIDES": "dinput8=n,b;dxgi=n,b"}
        match_e = env_vars_e == expected_e
        print(f"Result:   {env_vars_e}")
        print(f"Expected: {expected_e}")
        print(f"\n{'PASS' if match_e else 'FAIL'}")

        # Test F: Merge configured env var values with a comma delimiter
        print(f"\n{'='*60}")
        print("Test: Env variable merge - MANGOHUD_CONFIG uses comma")
        print(f"{'='*60}")
        settings_f = make_settings(
            [
                make_opt("mango-a", 'MANGOHUD_CONFIG="cpu_temp,gpu_temp"', priority=0),
                make_opt(
                    "mango-b",
                    'MANGOHUD_CONFIG="position=top-right,height=500,font_size=32"',
                    priority=0,
                ),
            ],
            env_variable_merges=[
                {
                    "id": "mangohud-config",
                    "name": "MANGOHUD_CONFIG",
                    "delimiter": ",",
                }
            ],
        )
        _, env_vars_f = get_final_args_details(settings_f, "123")
        expected_f = {
            "MANGOHUD_CONFIG": "cpu_temp,gpu_temp,position=top-right,height=500,font_size=32"
        }
        match_f = env_vars_f == expected_f
        print(f"Result:   {env_vars_f}")
        print(f"Expected: {expected_f}")
        print(f"\n{'PASS' if match_f else 'FAIL'}")

        # Test G: Without a merge rule, repeated env vars keep last-value-wins behavior
        print(f"\n{'='*60}")
        print("Test: Env variable merge - unconfigured variables still replace")
        print(f"{'='*60}")
        settings_g = make_settings(
            [
                make_opt("custom-a", "CUSTOM_ENV=fps", priority=0),
                make_opt("custom-b", "CUSTOM_ENV=compiler", priority=0),
            ],
            env_variable_merges=[],
        )
        _, env_vars_g = get_final_args_details(settings_g, "123")
        expected_g = {"CUSTOM_ENV": "compiler"}
        match_g = env_vars_g == expected_g
        print(f"Result:   {env_vars_g}")
        print(f"Expected: {expected_g}")
        print(f"\n{'PASS' if match_g else 'FAIL'}")

        # Test H: Original launch options participate in configured env var merges
        print(f"\n{'='*60}")
        print("Test: Env variable merge - original launch options merge first")
        print(f"{'='*60}")
        settings_h = make_settings(
            [
                make_opt("wine-a", 'WINEDLLOVERRIDES="dxgi=n,b"', priority=0),
            ],
            original_launch_options='WINEDLLOVERRIDES="dinput8=n,b"',
            env_variable_merges=[
                {
                    "id": "winedlloverrides",
                    "name": "WINEDLLOVERRIDES",
                    "delimiter": ";",
                }
            ],
        )
        _, env_vars_h = get_final_args_details(settings_h, "123")
        expected_h = {"WINEDLLOVERRIDES": "dinput8=n,b;dxgi=n,b"}
        match_h = env_vars_h == expected_h
        print(f"Result:   {env_vars_h}")
        print(f"Expected: {expected_h}")
        print(f"\n{'PASS' if match_h else 'FAIL'}")

        # Test I: Default merge rules apply when older settings omit envVariableMerges
        print(f"\n{'='*60}")
        print("Test: Env variable merge - defaults apply to older settings")
        print(f"{'='*60}")
        settings_i = make_settings([
            make_opt("hud-a", "DXVK_HUD=fps", priority=0),
            make_opt("hud-b", "DXVK_HUD=frametimes", priority=0),
        ])
        _, env_vars_i = get_final_args_details(settings_i, "123")
        expected_i = {"DXVK_HUD": "fps,frametimes"}
        match_i = env_vars_i == expected_i
        print(f"Result:   {env_vars_i}")
        print(f"Expected: {expected_i}")
        print(f"\n{'PASS' if match_i else 'FAIL'}")

    # Restore sys.argv
    sys.argv = original_argv

    print("\n" + "="*60)
    print("All tests completed!")
    print("="*60)
