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

    # Test 6: No %command%
    test_case(
        "No %command% (treated as prefix)",
        "gamemoderun",
        {
            'env_vars': {},
            'prefix': ['gamemoderun'],
            'suffix': []
        }
    )

    # Test 7: Multiple env vars only
    test_case(
        "Multiple environment variables",
        "PROTON_NO_ESYNC=1 DXVK_ASYNC=1 RADV_PERFTEST=aco %command%",
        {
            'env_vars': {'PROTON_NO_ESYNC': '1', 'DXVK_ASYNC': '1', 'RADV_PERFTEST': 'aco'},
            'prefix': [],
            'suffix': []
        }
    )

    # Test 8: Quoted values
    test_case(
        "Quoted values in env vars",
        'MESA_LOADER_DRIVER_OVERRIDE="zink" %command% -fullscreen',
        {
            'env_vars': {'MESA_LOADER_DRIVER_OVERRIDE': 'zink'},
            'prefix': [],
            'suffix': ['-fullscreen']
        }
    )

    # Test 9: Path with = should be treated as prefix
    test_case(
        "Path with = sign",
        "/path/to/script=value something %command%",
        {
            'env_vars': {},
            'prefix': ['/path/to/script=value', 'something'],
            'suffix': []
        }
    )

    print("\n" + "="*60)
    print("All tests completed!")
    print("="*60)
