#!/usr/bin/env python3
"""
Steam Launch Options Manager

This script provides utilities to manage Steam game launch options programmatically.

Main API Functions:
    - set_launch_options_for_all_apps(localconfig_path, launch_option=None, restart_steam_after=True)
      Set launch options for all games in the Steam library

    - check_app_has_launch_options(localconfig_path, app_id)
      Check if a specific app has launch options configured
      Returns: (has_launch_options: bool, current_launch_options: str)

    - restart_steam()
      Restart Steam to apply configuration changes

    - find_steam_path()
      Find Steam installation path

    - find_localconfig_vdf(steam_path)
      Find the localconfig.vdf file for the current user

Usage:
    1. Set LAUNCH_OPTION variable to your desired launch option
    2. Call set_launch_options_for_all_apps() with the localconfig path
    3. Steam will automatically restart to apply changes
"""

import os
import re
import signal
import subprocess
from pathlib import Path

# Configuration: Define the launch option to set for all games
LAUNCH_OPTION = "notify-send 'Steam Launch Watcher' 'Launch options modified!' && %command%"

def check_app_has_launch_options(localconfig_path: Path, app_id: str) -> tuple[bool, str]:
    """
    Check if a specific app has launch options configured.

    Args:
        localconfig_path: Path to Steam's localconfig.vdf file
        app_id: Steam App ID to check

    Returns:
        Tuple of (has_launch_options: bool, current_launch_options: str)
    """
    try:
        with open(localconfig_path, 'r', encoding='utf-8', errors='ignore') as f:
            config_content = f.read()

        # Find the specific app section
        app_pattern = rf'"{app_id}"\s*\{{'
        app_match = re.search(app_pattern, config_content)

        if not app_match:
            return (False, "")

        # Find the app section boundaries
        brace_start = app_match.end() - 1
        brace_count = 1
        brace_end = -1

        for i in range(brace_start + 1, len(config_content)):
            if config_content[i] == '{':
                brace_count += 1
            elif config_content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    brace_end = i
                    break

        if brace_end == -1:
            return (False, "")

        app_section = config_content[brace_start:brace_end]

        # Check for LaunchOptions
        launch_options_match = re.search(r'"LaunchOptions"\s+"([^"]*)"', app_section)

        if launch_options_match:
            return (True, launch_options_match.group(1))
        else:
            return (False, "")

    except Exception as e:
        print(f"❌ Error checking app {app_id}: {e}")
        return (False, "")

def set_launch_options_for_all_apps(localconfig_path: Path, launch_option: str = None, restart_steam_after: bool = True) -> bool:
    """
    Set launch options for all games in Steam library.

    Args:
        localconfig_path: Path to Steam's localconfig.vdf file
        launch_option: The launch option to set (uses LAUNCH_OPTION global if None)
        restart_steam_after: Whether to restart Steam after applying changes

    Returns:
        True if successful, False otherwise
    """
    if launch_option is None:
        launch_option = LAUNCH_OPTION

    try:
        print("📝 Reading Steam configuration...")

        # Read the config file
        with open(localconfig_path, 'r', encoding='utf-8', errors='ignore') as f:
            config_content = f.read()

        # Create backup before any processing
        # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # backup_path = localconfig_path.with_suffix(f'.vdf.backup_{timestamp}')
        # shutil.copy2(localconfig_path, backup_path)
        # print(f"✓ Backed up original config to: {backup_path.name}")

        # Find the apps section
        apps_section_start = config_content.find('"apps"')
        if apps_section_start == -1:
            print("❌ apps section not found in Steam config")
            return False

        # Find the end of apps section
        brace_count = 0
        apps_section_end = -1
        found_opening = False

        for i in range(apps_section_start, len(config_content)):
            if config_content[i] == '{':
                brace_count += 1
                found_opening = True
            elif config_content[i] == '}':
                brace_count -= 1
                if found_opening and brace_count == 0:
                    apps_section_end = i
                    break

        if apps_section_end == -1:
            print("❌ Could not find end of apps section")
            return False

        apps_content = config_content[apps_section_start:apps_section_end]

        # Collect all modifications
        modifications = []
        apps_processed = 0
        apps_with_launch_options = 0

        apps_brace_start = config_content.find('{', apps_section_start)
        pos = apps_brace_start + 1

        while pos < apps_section_start + len(apps_content):
            app_id_match = re.search(r'^\s*"(\d{4,10})"\s*\{', config_content[pos:apps_section_end], re.MULTILINE)
            if not app_id_match:
                break

            app_id = app_id_match.group(1)
            app_start = pos + app_id_match.start()
            brace_start = pos + app_id_match.end() - 1

            # Find matching closing brace
            brace_count = 1
            brace_end = -1
            for i in range(brace_start + 1, len(config_content)):
                if config_content[i] == '{':
                    brace_count += 1
                elif config_content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        brace_end = i
                        break

            if brace_end == -1 or brace_end > apps_section_end:
                break

            app_section = config_content[brace_start + 1:brace_end]

            # Only process games that have cloud sync state
            has_cloud = '"cloud"' in app_section and '"last_sync_state"' in app_section

            if not has_cloud:
                pos = brace_end + 1
                continue

            name_match = re.search(r'"name"\s+"([^"]+)"', app_section)
            game_name = name_match.group(1) if name_match else f"App {app_id}"

            apps_processed += 1
            print(f"  Processing: {app_id} ({game_name})")

            # Check for LaunchOptions
            launch_options_match = re.search(r'"LaunchOptions"\s+"([^"]*)"', app_section)

            if launch_options_match:
                apps_with_launch_options += 1
                current_options = launch_options_match.group(1)

                if launch_option not in current_options:
                    new_options = launch_option

                    for tab_variation in ['\t\t', '\t', '  ']:
                        old_line = f'"LaunchOptions"{tab_variation}"{current_options}"'
                        new_line = f'"LaunchOptions"{tab_variation}"{new_options}"'

                        if old_line in app_section:
                            modifications.append({
                                'type': 'replace',
                                'old': old_line,
                                'new': new_line,
                                'app_id': app_id,
                                'game_name': game_name,
                                'current_options': current_options,
                                'new_options': new_options
                            })
                            break
            else:
                insert_pos = config_content.find('\n', brace_start) + 1
                next_line_match = re.search(r'^(\s+)"', config_content[insert_pos:insert_pos + 50], re.MULTILINE)
                if next_line_match:
                    indent = next_line_match.group(1)
                else:
                    indent = '\t\t\t\t\t'

                new_launch_line = f'{indent}"LaunchOptions"\t\t"{launch_option}"\n'

                modifications.append({
                    'type': 'insert',
                    'position': insert_pos,
                    'text': new_launch_line,
                    'app_id': app_id,
                    'game_name': game_name
                })

            pos = brace_end + 1

        # Apply modifications
        if modifications:
            new_config = config_content

            for mod in reversed(modifications) if any(m['type'] == 'insert' for m in modifications) else modifications:
                if mod['type'] == 'replace':
                    new_config = new_config.replace(mod['old'], mod['new'], 1)
                    print(f"✓ Updated App ID {mod['app_id']} ({mod['game_name']})")
                    print(f"  Old: '{mod['current_options']}'")
                    print(f"  New: '{mod['new_options']}'")
                elif mod['type'] == 'insert':
                    new_config = new_config[:mod['position']] + mod['text'] + new_config[mod['position']:]
                    print(f"✓ Created LaunchOptions for App ID {mod['app_id']} ({mod['game_name']})")
                    print(f"  New: '{launch_option}'")

            modified = True
        else:
            modified = False

        print(f"📊 Processed {apps_processed} apps ({apps_with_launch_options} with launch options)")

        if modified:
            # Validate the new config before writing
            if len(new_config) < len(config_content) * 0.9:
                print("⚠️  Warning: New config is significantly smaller than original. Aborting to prevent data loss.")
                return False

            if new_config.count('{') != new_config.count('}'):
                print("⚠️  Warning: Brace mismatch in new config. Aborting to prevent corruption.")
                return False

            # Write the modified config atomically
            temp_path = localconfig_path.with_suffix('.vdf.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                f.write(new_config)

            os.replace(temp_path, localconfig_path)
            print("✅ Steam configuration updated successfully!")

            if restart_steam_after:
                restart_steam()

            return True
        else:
            print("ℹ️  No launch options needed updating")
            return True

    except Exception as e:
        print(f"❌ Error setting launch options: {e}")
        import traceback
        traceback.print_exc()
        return False

def restart_steam():
    try:
        print("🔄 Stopping Steam...")
        # Kill Steam processes but not this watcher script
        # Use exact process name matching to avoid killing ourselves
        subprocess.run(["pkill", "-x", "steam"], check=False)
        subprocess.run(["pkill", "-x", "Steam"], check=False)
        subprocess.run(["killall", "-q", "steam"], check=False, stderr=subprocess.DEVNULL)
        subprocess.run(["killall", "-q", "Steam"], check=False, stderr=subprocess.DEVNULL)

        # Also kill steamwebhelper and other Steam-specific processes
        for proc in ["steamwebhelper", "streaming_client", "fossilize_replay"]:
            subprocess.run(["pkill", "-x", proc], check=False, stderr=subprocess.DEVNULL)

        # Wait for Steam to fully close
        import time
        print("⏳ Waiting for Steam to close completely...")
        time.sleep(5)

        # Verify Steam is closed
        result = subprocess.run(['pgrep', '-f', 'steam'], capture_output=True, text=True)
        if result.returncode == 0:
            print("⚠️  Steam processes still running. Waiting longer...")
            time.sleep(3)

        print("🚀 Starting Steam...")
        # Try multiple ways to start Steam
        start_commands = [
            ["steam"],
            ["/usr/bin/steam"],
            ["flatpak", "run", "com.valvesoftware.Steam"],
            ["snap", "run", "steam"]
        ]

        steam_started = False
        for cmd in start_commands:
            try:
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                steam_started = True
                print(f"✅ Steam started using: {' '.join(cmd)}")
                break
            except FileNotFoundError:
                continue

        if not steam_started:
            print("❌ Could not start Steam automatically")
            print("Please manually start Steam from your applications menu")
        else:
            print("✅ Steam is restarting...")
            print("   Please wait for Steam to fully load, then check your game's launch options")

    except Exception as e:
        print(f"❌ Error restarting Steam: {e}")
        print("Please manually restart Steam to apply launch options.")

def find_steam_path() -> Path:
    """Find Steam installation path."""
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

def find_localconfig_vdf(steam_path: Path) -> Path:
    """Find the localconfig.vdf file."""
    userdata_path = steam_path / "userdata"

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

def main():
    print("=" * 60)
    print("🎮 Steam Launch Options Manager")
    print("=" * 60)

    # Ignore SIGHUP to prevent the script from being killed
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

    try:
        # Find Steam installation
        print("\n🔍 Locating Steam installation...")
        steam_path = find_steam_path()
        print(f"✓ Found Steam at: {steam_path}")

        # Find localconfig.vdf
        print("\n🔍 Locating Steam configuration...")
        localconfig_path = find_localconfig_vdf(steam_path)
        print(f"✓ Found localconfig.vdf at: {localconfig_path}")

        # Example: Set launch options for all apps
        print(f"\n📝 Setting launch option: {LAUNCH_OPTION}")
        print("⚠️  This will restart Steam!\n")

        input("Press Enter to continue or Ctrl+C to cancel...")

        success = set_launch_options_for_all_apps(localconfig_path, restart_steam_after=False)

        if success:
            print("\n✅ Done!")
        else:
            print("\n❌ Failed to set launch options")
            return 1

    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
