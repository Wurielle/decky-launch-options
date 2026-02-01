#!/usr/bin/env python3
"""
Test script to verify launch option parsing behavior.
Run with: python test_launch_options.py
"""

import sys
import os

# Add current directory to path to import run.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run import parse_launch_option

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

    print("\n" + "="*60)
    print("All tests completed!")
    print("="*60)
