import datetime
import json
import os
import shutil
import sys
from pathlib import Path

from shared import SETTINGS_FOLDER_PATH, SETTINGS_PATH

LOG_FILE = os.path.join(SETTINGS_FOLDER_PATH, 'debug.log')

executable = sys.argv[1] if len(sys.argv) > 1 else None
args = sys.argv[1:]


def _write_json(file_path, data):
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)


def _read_json(file_path):
    path = Path(file_path)
    if not path.exists():
        return None

    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return None


def get_settings():
    return _read_json(SETTINGS_PATH)


def get_steam_appid():
    appid_arg = next((arg for arg in sys.argv if "AppId=" in arg), None)

    if appid_arg:
        return appid_arg.split("=")[1]

    compat_appid = os.environ.get("STEAM_COMPAT_APP_ID")
    if compat_appid:
        return compat_appid

    return None


def parse_launch_option(raw_command):
    """
    Parse a launch option string into its components.

    Returns:
        dict with keys:
        - 'env_vars': dict of {key: value} environment variables
        - 'prefix': list of tokens before %command% (excluding env vars)
        - 'suffix': list of tokens after %command% (game args/flags)
    """
    if not raw_command or not raw_command.strip():
        return {'env_vars': {}, 'prefix': [], 'suffix': []}

    import shlex
    try:
        parts = shlex.split(raw_command)
    except ValueError:
        parts = raw_command.split()

    # Find %command% position
    try:
        command_idx = parts.index('%command%')
        left_parts = parts[:command_idx]
        right_parts = parts[command_idx + 1:]
    except ValueError:
        # No %command% found - need to infer what these parts are
        # Separate env vars first, then check remaining tokens
        temp_left = []
        temp_right = []

        for part in parts:
            # Check if it's an env var
            if '=' in part and not part.startswith('-'):
                key_part = part.split('=', 1)[0]
                if '/' not in key_part:
                    # It's an env var, goes to left
                    temp_left.append(part)
                    continue

            # Not an env var - check if it looks like a game arg
            if part.startswith('-') or part.startswith('+'):
                # Everything from here onwards is a game arg
                temp_right.append(part)
                # Add remaining parts to right as well
                idx = parts.index(part)
                temp_right.extend(parts[idx + 1:])
                break
            else:
                # Looks like a prefix command
                temp_left.append(part)

        left_parts = temp_left
        right_parts = temp_right

    # Separate env vars from prefix in left parts
    env_vars = {}
    prefix = []

    for part in left_parts:
        if '=' in part and not part.startswith('-'):
            # Check if it looks like an env var (key part has no /)
            key_part = part.split('=', 1)[0]
            if '/' not in key_part:
                key, value = part.split('=', 1)
                env_vars[key] = value
            else:
                # Looks like a path with =, treat as prefix
                prefix.append(part)
        else:
            prefix.append(part)

    return {
        'env_vars': env_vars,
        'prefix': prefix,
        'suffix': right_parts
    }


def get_final_args_details(settings, appid):
    base_args = sys.argv[1:]

    # Safely access settings structure
    if not settings or "profiles" not in settings or "launchOptions" not in settings:
        return base_args, {}

    profile = settings["profiles"].get(str(appid), {})
    profile_state = profile.get("state", {})
    profile_original_launch_options = profile.get("originalLaunchOptions", "")

    # Collections for all launch option components
    all_env_vars = {}
    all_prefixes = []
    all_suffixes = []

    # Parse original launch options first
    if profile_original_launch_options:
        parsed = parse_launch_option(profile_original_launch_options)
        all_env_vars.update(parsed['env_vars'])
        if parsed['prefix']:
            all_prefixes.append(parsed['prefix'])
        all_suffixes.extend(parsed['suffix'])

    # Resolve selected option per valueId group.
    value_id_groups = {}
    for opt in settings["launchOptions"]:
        value_id = opt.get("valueId", "")
        if value_id:
            value_id_groups.setdefault(value_id, []).append(opt)

    selected_by_value_id = {}
    for value_id, siblings in value_id_groups.items():
        explicit_true = next((opt["id"] for opt in siblings if profile_state.get(opt["id"]) is True), None)
        if explicit_true is not None:
            selected_by_value_id[value_id] = explicit_true
            continue

        has_explicit_state = any(opt["id"] in profile_state for opt in siblings)
        if has_explicit_state:
            selected_by_value_id[value_id] = None
            continue

        global_selected = next((opt["id"] for opt in siblings if opt.get("enableGlobally", False)), None)
        if global_selected is not None:
            selected_by_value_id[value_id] = global_selected
            continue

        fallback = next((opt["id"] for opt in siblings if opt.get("fallbackValue", False)), None)
        selected_by_value_id[value_id] = fallback if fallback is not None else siblings[0]["id"]

    # Parse each enabled launch option, collecting with priority for sorting
    launch_option_parts = []
    for opt in settings["launchOptions"]:
        opt_id = opt["id"]
        value_id = opt.get("valueId", "")
        enable_globally = opt.get("enableGlobally", False)
        priority = opt.get("priority", 0) or 0
        if value_id:
            is_enabled = selected_by_value_id.get(value_id) == opt_id
            # For valueId groups, only the selected option contributes commands.
            # Sibling options do not contribute off commands.
            raw_command = opt["on"] if is_enabled else ""
        else:
            is_enabled = profile_state.get(opt_id, enable_globally)
            raw_command = opt["on"] if is_enabled else opt["off"]

        if raw_command and raw_command.strip():
            parsed = parse_launch_option(raw_command)
            launch_option_parts.append((priority, parsed))

    # Sort by priority descending (higher priority = leftmost prefix command).
    # Python's sort is stable, so equal-priority options keep their original order.
    launch_option_parts.sort(key=lambda x: x[0], reverse=True)

    # Merge sorted results into collectors
    for priority, parsed in launch_option_parts:
        all_env_vars.update(parsed['env_vars'])
        if parsed['prefix']:
            all_prefixes.append(parsed['prefix'])
        all_suffixes.extend(parsed['suffix'])

    # Apply all environment variables
    for key, value in all_env_vars.items():
        os.environ[key] = value

    # Build final command: prefixes + base_args + suffixes
    final_args = []

    # Add all prefixes
    for prefix in all_prefixes:
        # Expand ~ in paths
        expanded_prefix = [part.replace("~", os.path.expanduser("~")) for part in prefix]

        # Check if the command/executable exists
        if expanded_prefix:
            first_part = expanded_prefix[0]
            # Check if it's an executable in PATH or an existing file
            if shutil.which(first_part) or os.path.isfile(first_part):
                final_args.extend(expanded_prefix)
        # else: skip this prefix silently if command doesn't exist
        else:
            final_args.extend(expanded_prefix)

    # Add base game command
    final_args.extend(base_args)

    # Add all suffix args at the end
    final_args.extend(all_suffixes)

    return final_args, all_env_vars


def get_final_args(settings, appid):
    final_args, _ = get_final_args_details(settings, appid)
    return final_args


if __name__ == "__main__":
    # Ensure we always have fallback values
    if not executable:
        # If no executable provided, just exit
        sys.exit(1)

    try:
        appid = get_steam_appid()
        settings = get_settings()

        executable_args = args
        applied_env_vars = {}
        if settings:
            try:
                executable_args, applied_env_vars = get_final_args_details(settings, appid)
            except Exception:
                # Failed to apply launch options, fall back to original command
                executable_args = args
                applied_env_vars = {}

        # Try to write logs, but don't let it block execution
        try:
            def write_logs():
                log_path = Path(LOG_FILE)
                log_path.parent.mkdir(parents=True, exist_ok=True)

                with open(LOG_FILE, "w", encoding="utf-8") as f:
                    f.write("=== CURRENT LAUNCH ===\n")
                    f.write(f"Timestamp: {datetime.datetime.now().isoformat()}\n")
                    f.write(f"AppID: {appid}\n")
                    f.write("\n")

                    f.write("[Original Args]\n")
                    for i, arg in enumerate(args):
                        f.write(f"{i:02d}: {arg}\n")
                    f.write("\n")

                    f.write("[Final Executable Args]\n")
                    for i, arg in enumerate(executable_args):
                        f.write(f"{i:02d}: {arg}\n")
                    f.write("\n")

                    f.write("[Applied Environment Variables]\n")
                    if applied_env_vars:
                        for key in sorted(applied_env_vars.keys()):
                            f.write(f"{key}={applied_env_vars[key]}\n")
                    else:
                        f.write("(none)\n")
                    f.write("\n")

                    f.write("=== END CURRENT LAUNCH ===\n")

            write_logs()
        except Exception:
            # Logging failed, but continue execution
            pass

        # Try to execute with computed args
        if executable_args and len(executable_args) > 0:
            executable = executable_args[0]
            os.execvpe(executable, executable_args, os.environ)

    except Exception:
        # Any error in settings/appid detection, fall back to original command
        pass

    # Final fallback: execute original command
    os.execvpe(executable, args, os.environ)
