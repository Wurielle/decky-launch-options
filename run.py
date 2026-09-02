import datetime
import json
import os
import shutil
import sys
from pathlib import Path

from shared import SETTINGS_FOLDER_PATH, SETTINGS_PATH

LOG_FILE = os.path.join(SETTINGS_FOLDER_PATH, 'debug.log')
DEFAULT_ENV_VARIABLE_MERGES = [
    {"name": "WINEDLLOVERRIDES", "delimiter": ";"},
    {"name": "MANGOHUD_CONFIG", "delimiter": ","},
    {"name": "DXVK_CONFIG", "delimiter": ";"},
    {"name": "VKD3D_CONFIG", "delimiter": ","},
    {"name": "DXVK_HUD", "delimiter": ","},
    {"name": "RADV_PERFTEST", "delimiter": ","},
]

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


def _to_uint32(value):
    return int(value) & 0xFFFFFFFF


def is_non_steam_appid(appid):
    try:
        return _to_uint32(appid) >= 0x80000000
    except (TypeError, ValueError):
        return False


def split_command_args(raw_command):
    try:
        import shlex
        return shlex.split(raw_command)
    except ValueError:
        return raw_command.split()


def split_unquoted_and_chain(raw_command):
    """Split a command on unquoted, unescaped && shell operators."""
    parts = []
    part_start = 0
    quote = None
    escaped = False
    index = 0

    while index < len(raw_command):
        char = raw_command[index]

        if escaped:
            escaped = False
            index += 1
            continue

        if char == '\\' and quote != "'":
            escaped = True
            index += 1
            continue

        if quote:
            if char == quote:
                quote = None
            index += 1
            continue

        if char in ("'", '"'):
            quote = char
            index += 1
            continue

        if raw_command[index:index + 2] == '&&':
            parts.append(raw_command[part_start:index].strip())
            part_start = index + 2
            index += 2
            continue

        index += 1

    parts.append(raw_command[part_start:].strip())
    return parts


def split_pre_commands(raw_command):
    """Extract shell commands chained before the final launch expression."""
    chain = split_unquoted_and_chain(raw_command)
    if len(chain) == 1 or any(not part for part in chain):
        return [], raw_command

    # Pre-launch chains only apply when %command% is in the final segment. A
    # chain after the game would be a post-launch hook with different lifetime
    # semantics, so leave it to the ordinary parser for now.
    command_segments = [
        index
        for index, part in enumerate(chain)
        if '%command%' in split_command_args(part)
    ]
    if command_segments and command_segments != [len(chain) - 1]:
        return [], raw_command

    return chain[:-1], chain[-1]


def parse_launch_option(raw_command):
    """
    Parse a launch option string into its components.

    Returns:
        dict with keys:
        - 'env_vars': dict of {key: value} environment variables
        - 'pre_commands': shell commands chained with && before the launch
        - 'prefix': list of tokens before %command% (excluding env vars)
        - 'suffix': list of tokens after %command% (game args/flags)
    """
    if not raw_command or not raw_command.strip():
        return {
            'env_vars': {},
            'pre_commands': [],
            'prefix': [],
            'suffix': [],
        }

    pre_commands, launch_command = split_pre_commands(raw_command)

    import shlex
    try:
        parts = shlex.split(launch_command)
    except ValueError:
        parts = launch_command.split()

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
        'pre_commands': pre_commands,
        'prefix': prefix,
        'suffix': right_parts
    }


def get_env_variable_merge_rules(settings):
    rules = {}
    merge_rules = settings.get("envVariableMerges", DEFAULT_ENV_VARIABLE_MERGES)
    for rule in merge_rules:
        name = str(rule.get("name", "")).strip()
        delimiter = rule.get("delimiter")
        if not name or delimiter is None:
            continue
        rules[name] = str(delimiter)
    return rules


def add_env_vars(env_var_values, merge_rules, env_vars):
    for key, value in env_vars.items():
        if key in merge_rules:
            env_var_values.setdefault(key, []).append(value)
        else:
            env_var_values[key] = [value]


def finalize_env_vars(env_var_values, merge_rules):
    final_env_vars = {}
    for key, values in env_var_values.items():
        if key in merge_rules and len(values) > 1:
            final_env_vars[key] = merge_rules[key].join(values)
        elif values:
            final_env_vars[key] = values[-1]
    return final_env_vars


def merge_suffix_args(suffix_groups):
    """Merge suffix token groups around a shared first bare -- boundary."""
    before_separator = []
    after_separator = []
    has_separator = False

    for suffix in suffix_groups:
        try:
            separator_idx = suffix.index('--')
        except ValueError:
            before_separator.extend(suffix)
            continue

        before_separator.extend(suffix[:separator_idx])

        # Each group's first separator denotes the same shared boundary. Any
        # later separators in this group remain in the sliced arguments below.
        has_separator = True
        after_separator.extend(suffix[separator_idx + 1:])

    if not has_separator:
        return before_separator

    return before_separator + ['--'] + after_separator


def wrap_pre_commands(pre_commands, final_args):
    """Build a shell chain which replaces itself with the final executable."""
    if not pre_commands or not final_args:
        return final_args

    import shlex
    shell_command = ' && '.join([
        *pre_commands,
        f"exec {shlex.join(final_args)}",
    ])
    return ['/bin/sh', '-c', shell_command]


def get_shell_command_log_details(executable_args):
    """Extract readable debug details from the generated shell wrapper."""
    if (
        len(executable_args) != 3
        or executable_args[0] != '/bin/sh'
        or executable_args[1] != '-c'
    ):
        return None

    shell_commands = split_unquoted_and_chain(executable_args[2])
    if not shell_commands or not shell_commands[-1].startswith('exec '):
        return None

    final_args = split_command_args(shell_commands[-1][len('exec '):])
    if not final_args:
        return None

    return {
        'pre_commands': shell_commands[:-1],
        'final_args': final_args,
    }


def get_final_args_details(settings, appid):
    base_args = sys.argv[1:]

    # Safely access settings structure
    if not settings or "profiles" not in settings or "launchOptions" not in settings:
        return base_args, {}

    profile = settings["profiles"].get(str(appid), {})
    profile_state = profile.get("state", {})
    profile_original_launch_options = profile.get("originalLaunchOptions", "")
    override_command = profile.get("overrideCommand", "")
    if (
        profile.get("overrideCommandEnabled") is True
        and isinstance(override_command, str)
        and override_command.strip()
    ):
        base_args = split_command_args(override_command)
    is_non_steam_app = is_non_steam_appid(appid)

    # Collections for all launch option components
    env_merge_rules = get_env_variable_merge_rules(settings)
    all_env_var_values = {}
    all_pre_commands = []
    all_prefixes = []
    all_suffix_groups = []

    # Parse original launch options first
    if profile_original_launch_options:
        if is_non_steam_app:
            # Keep shortcut arguments together as a suffix group so tokens such
            # as Flatpak's @@u/@@ remain intact during separator merging.
            protected_original_args = split_command_args(profile_original_launch_options)
            if protected_original_args:
                all_suffix_groups.append(protected_original_args)
        else:
            parsed = parse_launch_option(profile_original_launch_options)
            add_env_vars(all_env_var_values, env_merge_rules, parsed['env_vars'])
            all_pre_commands.extend(parsed['pre_commands'])
            if parsed['prefix']:
                all_prefixes.append(parsed['prefix'])
            if parsed['suffix']:
                all_suffix_groups.append(parsed['suffix'])

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

    # Environment variables use last-value-wins semantics, so process them from
    # lowest to highest priority. The stable sort preserves the existing behavior
    # where a later option wins when priorities are equal.
    for priority, parsed in sorted(launch_option_parts, key=lambda x: x[0]):
        add_env_vars(all_env_var_values, env_merge_rules, parsed['env_vars'])

    # Merge command parts in execution order.
    for priority, parsed in launch_option_parts:
        all_pre_commands.extend(parsed['pre_commands'])
        if parsed['prefix']:
            all_prefixes.append(parsed['prefix'])
        if parsed['suffix']:
            all_suffix_groups.append(parsed['suffix'])

    all_env_vars = finalize_env_vars(all_env_var_values, env_merge_rules)

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

    # Add suffix args after the base command. A bare -- is a shared boundary:
    # ordinary args from every option belong before it, while explicitly
    # separated args stay after it.
    final_args.extend(merge_suffix_args(all_suffix_groups))

    return wrap_pre_commands(all_pre_commands, final_args), all_env_vars


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

                    shell_log_details = get_shell_command_log_details(
                        executable_args
                    )
                    if shell_log_details:
                        f.write("[Pre-launch Shell Commands]\n")
                        for i, command in enumerate(
                            shell_log_details['pre_commands']
                        ):
                            f.write(f"{i:02d}: {command}\n")
                        f.write("\n")

                        f.write("[Final Command Args]\n")
                        for i, arg in enumerate(shell_log_details['final_args']):
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
