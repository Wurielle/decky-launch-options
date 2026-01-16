#!/usr/bin/env python3

import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class SteamConfigHandler(FileSystemEventHandler):
    """Watches for changes to Steam's localconfig.vdf and modifies launch options."""

    def __init__(self, localconfig_path: Path, steam_path: Path):
        self.localconfig_path = localconfig_path
        self.steam_path = steam_path
        self.processing = False

    def on_modified(self, event):
        if event.src_path == str(self.localconfig_path) and not self.processing:
            print(f"\n🔍 Detected change in {self.localconfig_path.name} (modified)")
            self.process_launch_options()

    def on_created(self, event):
        if event.src_path == str(self.localconfig_path) and not self.processing:
            print(f"\n🔍 Detected change in {self.localconfig_path.name} (created)")
            self.process_launch_options()

    def on_moved(self, event):
        # Handle atomic writes (temp file renamed to target)
        if hasattr(event, 'dest_path') and event.dest_path == str(self.localconfig_path) and not self.processing:
            print(f"\n🔍 Detected change in {self.localconfig_path.name} (moved/renamed)")
            self.process_launch_options()

    def process_launch_options(self):
        """Process all game launch options in the config file."""
        self.processing = True
        try:
            print("📝 Reading Steam configuration...")

            # Read the config file
            with open(self.localconfig_path, 'r', encoding='utf-8', errors='ignore') as f:
                config_content = f.read()

            # Create backup before any processing
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.localconfig_path.with_suffix(f'.vdf.backup_{timestamp}')
            shutil.copy2(self.localconfig_path, backup_path)
            print(f"✓ Backed up original config to: {backup_path.name}")

            # Find the apps section
            apps_section_start = config_content.find('"apps"')
            if apps_section_start == -1:
                print("❌ apps section not found in Steam config")
                return

            # Find the end of apps section by finding its closing brace
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
                return

            # Only search within the apps section
            apps_content = config_content[apps_section_start:apps_section_end]

            # Collect all modifications first, then apply them in reverse order
            modifications = []
            apps_processed = 0
            apps_with_launch_options = 0

            # Find all app IDs (they should be at the top level of the apps section)
            # We need to find the first opening brace of apps section
            apps_brace_start = config_content.find('{', apps_section_start)
            pos = apps_brace_start + 1

            while pos < apps_section_start + len(apps_content):
                # Find next app ID (numeric string in quotes at the beginning of a line or after whitespace)
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

                # Extract app section content
                app_section = config_content[brace_start + 1:brace_end]

                # Only process games that have cloud sync state (indicates they've been configured/launched)
                has_cloud = '"cloud"' in app_section and '"last_sync_state"' in app_section

                if not has_cloud:
                    # Skip games that haven't been launched yet
                    pos = brace_end + 1
                    continue

                # Try to get game name for better logging
                name_match = re.search(r'"name"\s+"([^"]+)"', app_section)
                game_name = name_match.group(1) if name_match else f"App {app_id}"

                apps_processed += 1
                print(f"  Processing: {app_id} ({game_name})")

                # Check for LaunchOptions in this section
                launch_options_match = re.search(r'"LaunchOptions"\s+"([^"]*)"', app_section)

                if launch_options_match:
                    # LaunchOptions exists, update it
                    apps_with_launch_options += 1
                    current_options = launch_options_match.group(1)

                    # Skip if already contains %command%
                    if '%command%' not in current_options:
                        # Add %command% to the existing launch options
                        if current_options.strip():
                            new_options = f"{current_options} %command%"
                        else:
                            new_options = "%command%"

                        # Try different tab variations that Steam might use
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
                    # LaunchOptions doesn't exist, create it
                    # Find the newline after the opening brace
                    insert_pos = config_content.find('\n', brace_start) + 1

                    # Determine indentation by looking at the next line
                    next_line_match = re.search(r'^(\s+)"', config_content[insert_pos:insert_pos + 50], re.MULTILINE)
                    if next_line_match:
                        indent = next_line_match.group(1)
                    else:
                        indent = '\t\t\t\t\t'  # Default Steam indentation

                    new_launch_line = f'{indent}"LaunchOptions"\t\t"%command%"\n'

                    modifications.append({
                        'type': 'insert',
                        'position': insert_pos,
                        'text': new_launch_line,
                        'app_id': app_id,
                        'game_name': game_name
                    })

                # Move to next potential app
                pos = brace_end + 1

            # Apply modifications in reverse order to preserve positions
            if modifications:
                new_config = config_content

                # Sort by position (for inserts) or just apply in order for replaces
                for mod in reversed(modifications) if any(m['type'] == 'insert' for m in modifications) else modifications:
                    if mod['type'] == 'replace':
                        new_config = new_config.replace(mod['old'], mod['new'], 1)
                        print(f"✓ Updated App ID {mod['app_id']} ({mod['game_name']})")
                        print(f"  Old: '{mod['current_options']}'")
                        print(f"  New: '{mod['new_options']}'")
                    elif mod['type'] == 'insert':
                        new_config = new_config[:mod['position']] + mod['text'] + new_config[mod['position']:]
                        print(f"✓ Created LaunchOptions for App ID {mod['app_id']} ({mod['game_name']})")
                        print(f"  New: '%command%'")

                modified = True
            else:
                modified = False

            print(f"📊 Processed {apps_processed} apps ({apps_with_launch_options} with launch options)")

            if modified:
                # Write the modified config atomically
                temp_path = self.localconfig_path.with_suffix('.vdf.tmp')
                with open(temp_path, 'w', encoding='utf-8') as f:
                    f.write(new_config)

                os.replace(temp_path, self.localconfig_path)
                print("✅ Steam configuration updated successfully!")

                # Notify Steam of the changes
                self.notify_steam()
            else:
                print("ℹ️  No launch options needed updating (all already have %command%)")

        except Exception as e:
            print(f"❌ Error processing launch options: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.processing = False

    def notify_steam(self):
        """Notify Steam to reload configuration."""
        try:
            # Method 1: Touch the config file to update mtime
            current_time = time.time()
            os.utime(self.localconfig_path, (current_time, current_time))

            # Method 2: Send SIGHUP to Steam process
            result = subprocess.run(['pgrep', '-f', 'steam'], capture_output=True, text=True)
            if result.returncode == 0:
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid.strip():
                        try:
                            subprocess.run(['kill', '-HUP', pid.strip()], check=False)
                        except:
                            pass
                print("✅ Steam notified of configuration changes")
            else:
                print("ℹ️  Steam is not running - changes will apply when Steam starts")

        except Exception as e:
            print(f"⚠️  Could not signal Steam: {e}")


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
    print("🎮 Steam Launch Options Watcher")
    print("=" * 60)

    try:
        # Find Steam installation
        print("\n🔍 Locating Steam installation...")
        steam_path = find_steam_path()
        print(f"✓ Found Steam at: {steam_path}")

        # Find localconfig.vdf
        print("\n🔍 Locating Steam configuration...")
        localconfig_path = find_localconfig_vdf(steam_path)
        print(f"✓ Found localconfig.vdf at: {localconfig_path}")

        # Set up file watcher
        event_handler = SteamConfigHandler(localconfig_path, steam_path)
        observer = Observer()
        observer.schedule(event_handler, str(localconfig_path.parent), recursive=False)
        observer.start()

        print("\n👀 Watching for changes to Steam configuration...")
        print("   Press Ctrl+C to stop\n")

        # Process current launch options on startup
        print("📝 Processing current launch options...")
        event_handler.process_launch_options()

        # Keep the script running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
            print("\n\n✋ Stopping watcher...")

        observer.join()
        print("✅ Watcher stopped")

    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
