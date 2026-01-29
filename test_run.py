#!/usr/bin/env python3
"""Test script for launch option type detection and handling."""

import sys
import os

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from run import detect_launch_option_type, apply_env_vars, apply_flags, apply_command_to_args


def test_detection():
    """Test launch option type detection."""
    print("=== Testing Type Detection ===\n")

    test_cases = [
        # Environment variables
        ("DXVK_HUD=1", "env"),
        ("VK_INSTANCE_LAYERS=VK_LAYER_MESA_overlay", "env"),
        ('GAME_PATH="/path with spaces"', "env"),
        ("VAR1=value1 VAR2=value2", "env"),

        # Flags
        ("--fullscreen", "flag"),
        ("--width 1920 --height 1080", "flag"),
        ("-w", "flag"),
        ("--args=value", "flag"),

        # Prefix commands
        ("gamemoderun %command%", "prefix"),
        ("mangohud %command%", "prefix"),
        ("~/my_script run", "prefix"),
        ("/usr/bin/wrapper %command%", "prefix"),
        ("", None),
    ]

    all_passed = True
    for command, expected in test_cases:
        result = detect_launch_option_type(command)
        status = "✓" if result == expected else "✗"
        if result != expected:
            all_passed = False
        print(f"{status} '{command}' -> {result} (expected: {expected})")

    print(f"\n{'All tests passed!' if all_passed else 'Some tests failed!'}\n")
    return all_passed


def test_env_vars():
    """Test environment variable handling."""
    print("=== Testing Environment Variables ===\n")

    # Save original env
    original_env = os.environ.copy()

    try:
        # Test simple env var
        apply_env_vars("TEST_VAR=hello")
        assert os.environ.get("TEST_VAR") == "hello", "Simple env var failed"
        print("✓ Simple env var: TEST_VAR=hello")

        # Test env var with spaces (quoted)
        apply_env_vars('SPACED="value with spaces"')
        assert os.environ.get("SPACED") == "value with spaces", "Quoted env var failed"
        print("✓ Quoted env var: SPACED=\"value with spaces\"")

        # Test multiple env vars
        apply_env_vars("VAR1=one VAR2=two")
        assert os.environ.get("VAR1") == "one", "Multiple env vars (VAR1) failed"
        assert os.environ.get("VAR2") == "two", "Multiple env vars (VAR2) failed"
        print("✓ Multiple env vars: VAR1=one VAR2=two")

        print("\nAll environment variable tests passed!\n")
        return True

    finally:
        # Restore original env
        os.environ.clear()
        os.environ.update(original_env)


def test_flags():
    """Test flag handling."""
    print("=== Testing Flags ===\n")

    base_args = ["/usr/bin/game", "arg1", "arg2"]

    # Test simple flag
    result = apply_flags("--fullscreen", base_args.copy())
    expected = ["--fullscreen", "/usr/bin/game", "arg1", "arg2"]
    assert result == expected, f"Simple flag failed: {result} != {expected}"
    print(f"✓ Simple flag: {result}")

    # Test multiple flags
    result = apply_flags("--width 1920 --height 1080", base_args.copy())
    expected = ["--width", "1920", "--height", "1080", "/usr/bin/game", "arg1", "arg2"]
    assert result == expected, f"Multiple flags failed: {result} != {expected}"
    print(f"✓ Multiple flags: {result}")

    # Test flag with equals
    result = apply_flags("--config=test.ini", base_args.copy())
    expected = ["--config=test.ini", "/usr/bin/game", "arg1", "arg2"]
    assert result == expected, f"Flag with equals failed: {result} != {expected}"
    print(f"✓ Flag with equals: {result}")

    print("\nAll flag tests passed!\n")
    return True


def test_prefix_commands():
    """Test prefix command handling."""
    print("=== Testing Prefix Commands ===\n")

    base_args = ["/usr/bin/game", "arg1", "arg2"]

    # Test simple prefix
    result = apply_command_to_args("gamemoderun %command%", base_args.copy())
    expected = ["gamemoderun", "/usr/bin/game", "arg1", "arg2"]
    assert result == expected, f"Simple prefix failed: {result} != {expected}"
    print(f"✓ Simple prefix: {result}")

    # Test prefix without %command%
    result = apply_command_to_args("mangohud", base_args.copy())
    expected = ["mangohud", "/usr/bin/game", "arg1", "arg2"]
    assert result == expected, f"Prefix without %command% failed: {result} != {expected}"
    print(f"✓ Prefix without %command%: {result}")

    # Test prefix with arguments and %command%
    result = apply_command_to_args("wrapper --arg1 %command% --arg2", base_args.copy())
    expected = ["wrapper", "--arg1", "/usr/bin/game", "arg1", "arg2", "--arg2"]
    assert result == expected, f"Prefix with args failed: {result} != {expected}"
    print(f"✓ Prefix with args around %command%: {result}")

    print("\nAll prefix command tests passed!\n")
    return True


if __name__ == "__main__":
    results = []

    results.append(test_detection())
    results.append(test_env_vars())
    results.append(test_flags())
    results.append(test_prefix_commands())

    print("=" * 50)
    if all(results):
        print("✓ ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("✗ SOME TESTS FAILED!")
        sys.exit(1)
