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


def get_final_args(settings, appid):
    base_args = sys.argv[1:]

    # Safely access settings structure
    if not settings or "profiles" not in settings or "launchOptions" not in settings:
        return base_args

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

    # Parse each enabled launch option
    for opt in settings["launchOptions"]:
        opt_id = opt["id"]
        enable_globally = opt.get("enableGlobally", False)
        is_enabled = profile_state.get(opt_id, enable_globally)

        raw_command = opt["on"] if is_enabled else opt["off"]

        if raw_command and raw_command.strip():
            parsed = parse_launch_option(raw_command)
            all_env_vars.update(parsed['env_vars'])
            if parsed['prefix']:
                all_prefixes.append(parsed['prefix'])
            all_suffixes.extend(parsed['suffix'])

    # Apply all environment variables
    for key, value in all_env_vars.items():
        os.environ[key] = value

    # Build final command: prefixes (joined with --) + base_args + suffixes
    final_args = []

    # Add all prefixes, separated by --
    for i, prefix in enumerate(all_prefixes):
        # Expand ~ in paths
        expanded_prefix = [part.replace("~", os.path.expanduser("~")) for part in prefix]

        # Check if the command/executable exists
        if expanded_prefix:
            first_part = expanded_prefix[0]
            # Check if it's an executable in PATH or an existing file
            if shutil.which(first_part) or os.path.isfile(first_part):
                final_args.extend(expanded_prefix)
                # Add -- separator between prefixes (but not after the last one)
                # Also skip if the current prefix already ends with --
                if i < len(all_prefixes) - 1:
                    if not (expanded_prefix and expanded_prefix[-1] == '--'):
                        final_args.append('--')
        # else: skip this prefix silently if command doesn't exist
        else:
            final_args.extend(expanded_prefix)

    # Add base game command
    final_args.extend(base_args)

    # Add all suffix args at the end
    final_args.extend(all_suffixes)

    return final_args


if __name__ == "__main__":
    # Ensure we always have fallback values
    if not executable:
        # If no executable provided, just exit
        sys.exit(1)

    try:
        appid = get_steam_appid()
        settings = get_settings()

        # Try to write logs, but don't let it block execution
        try:
            executable_args = get_final_args(settings, appid) if settings else args

            def write_logs():
                with open(LOG_FILE, "w") as f:
                    f.write(f"--- {datetime.datetime.now()} Launch Attempt for app: {appid} ---\n")
                    f.write(f"Full Command List: {args}\n\n")

                    for i, arg in enumerate(args):
                        f.write(f"Arg {i}: {arg}\n")
                    f.write("-" * 40 + "\n\n")

                    f.write(f"Executable: {executable_args}\n\n")

                    for i, arg in enumerate(executable_args):
                        f.write(f"Arg {i}: {arg}\n")
                    f.write("-" * 40 + "\n\n")

            write_logs()
        except Exception:
            # Logging failed, but continue execution
            pass

        # Try to get final args with settings
        if settings:
            try:
                executable_args = get_final_args(settings, appid)
                if executable_args and len(executable_args) > 0:
                    executable = executable_args[0]
                    os.execvpe(executable, executable_args, os.environ)
            except Exception:
                # Failed to apply launch options, fall back to original command
                pass

    except Exception:
        # Any error in settings/appid detection, fall back to original command
        pass

    # Final fallback: execute original command
    os.execvpe(executable, args, os.environ)
