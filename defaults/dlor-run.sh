#!/bin/bash
# Generic launcher: reuse integrity-checked commit pins; always refresh mutable dev.
# Keep game argv and Steam's environment untouched outside the helper subshell.
usage() {
    printf 'Usage: ~/.dlor/run <recipe-name> <script-name> [commit-sha] -- <game command...>\n' >&2
    printf 'A full commit SHA is recommended; omitting it downloads from the dev branch.\n' >&2
}
if (( $# < 4 )); then
    usage
    exit 2
fi
recipe="$1"
script="$2"
sha=''
use_default=0
if [[ "$3" == -- ]]; then
    use_default=1
    shift 3
elif (( $# >= 5 )) && [[ "$4" == -- ]]; then
    sha="$3"
    shift 4
else
    usage
    exit 2
fi

(
    # Shell builtins must precede every host subprocess, including logging tools.
    unset LD_PRELOAD
    if [[ "${STEAM_RUNTIME:-}" == /* ]]; then
        export LD_LIBRARY_PATH="${SYSTEM_LD_LIBRARY_PATH:-}"
        export PATH="${SYSTEM_PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"
        unset STEAM_RUNTIME
    fi

    log_dir="$HOME/.dlor/logs/run"
    printf -v timestamp '%(%Y-%m-%dT%H-%M-%S)T' -1
    log_file="$log_dir/$timestamp.${EPOCHREALTIME##*.}.$BASHPID.log"
    if mkdir -p -- "$log_dir" && command -v tee >/dev/null 2>&1 && : >> "$log_file"; then
        exec > >(tee --output-error=warn -a -- "$log_file") 2>&1
        # Timestamped filenames sort oldest first; keep the latest 10 per folder.
        # Stay self-contained for scripts downloaded separately, including bash -s.
        (
            export LC_ALL=C
            shopt -s nullglob
            logs=()
            for candidate in "$log_dir/"*.log; do
                if [[ -f "$candidate" && ! -L "$candidate" ]]; then
                    logs+=("$candidate")
                fi
            done
            excess=$(( ${#logs[@]} - 10 ))
            if (( excess > 0 )); then
                rm -f -- "${logs[@]:0:excess}" ||
                    printf 'Warning: could not remove old logs in %s; continuing.\n' "$log_dir" >&2
            fi
        )
    else
        printf 'Warning: could not enable logging to %s; continuing.\n' "$log_file" >&2
    fi

    set -Eeuo pipefail
    download=''
    staging=''
    cleanup() {
        status=$?
        set +e
        if [[ -n "$download" ]]; then rm -f -- "$download"; fi
        if [[ -n "$staging" ]]; then
            rm -f -- "$staging/command.sh" "$staging/sha256"
            rmdir -- "$staging"
        fi
        printf 'run finished with exit status %s.\n' "$status"
        exit "$status"
    }
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    trap 'printf "Error: run line %s: %s (exit %s)\n" "$LINENO" "$BASH_COMMAND" "$?" >&2' ERR

    if [[ ! "$recipe" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ||
          ! "$script" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
        printf 'Error: invalid recipe or script name (omit .sh).\n' >&2
        exit 2
    fi
    if (( use_default )); then
        revision='refs/heads/dev'
    elif [[ "$sha" =~ ^[a-f0-9]{40}$ ]]; then
        revision="$sha"
    else
        printf 'Error: invalid full commit SHA.\n' >&2
        exit 2
    fi
    repository="${DLOR_REPOSITORY-Wurielle/decky-launch-options-recipes}"
    if [[ ! "$repository" =~ ^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$ ]]; then
        printf 'Error: invalid repository; expected owner/repository.\n' >&2
        exit 2
    fi
    url="https://raw.githubusercontent.com/$repository/$revision/recipes/$recipe/scripts/$script.sh"
    printf 'Starting %s/%s at %s\n' "$recipe" "$script" "$revision"

    acquire() {
        printf 'Downloading %s\n' "$url"
        curl -fsSL --proto '=https' --proto-redir '=https' \
            --connect-timeout 10 --max-time 60 --retry 3 --retry-delay 1 --retry-max-time 90 \
            --output "$download" "$url"
        if [[ ! -s "$download" ]]; then
            printf 'Error: downloaded script is empty.\n' >&2
            exit 1
        fi
        bash -n "$download"
    }

    # Execute an invocation-private snapshot, never a shared mutable cache file.
    original_umask="$(umask)"
    umask 077
    download="$(mktemp "${TMPDIR:-/tmp}/dlor-script.XXXXXXXX.sh")"
    if (( use_default )); then
        # Mutable dev commands are always fresh; never fall back to stale bytes.
        acquire
    else
        # Accept symlinked home ancestors, but not redirection inside our cache.
        cache_root="$(cd -- "$HOME" && pwd -P)"
        for component in .dlor cache commands; do
            cache_root="$cache_root/$component"
            if [[ -L "$cache_root" ]]; then
                printf 'Error: symlink in command cache path.\n' >&2
                exit 1
            fi
            mkdir -p -- "$cache_root"
            [[ -d "$cache_root" && -O "$cache_root" ]]
        done
        key="$(printf '%s\n' "$repository" "$sha" "$recipe" "$script" | sha256sum)"
        key="${key%% *}"
        entry="$cache_root/$key"
        lock="$cache_root/$key.lock"
        if [[ -L "$lock" || ( -e "$lock" && ( ! -f "$lock" || ! -O "$lock" ) ) ]]; then
            printf 'Error: unsafe command cache lock.\n' >&2
            exit 1
        fi
        exec 9>> "$lock"
        flock -w 100 9
        if [[ -L "$entry" || ( -e "$entry" && ( ! -d "$entry" || ! -O "$entry" ) ) ]]; then
            printf 'Error: unsafe command cache entry.\n' >&2
            exit 1
        fi

        cached_digest=''
        if [[ -f "$entry/sha256" && ! -L "$entry/sha256" &&
              -f "$entry/command.sh" && ! -L "$entry/command.sh" ]]; then
            cached_digest="$(< "$entry/sha256")"
            cp -- "$entry/command.sh" "$download"
        fi
        actual_digest="$(sha256sum -- "$download")"
        actual_digest="${actual_digest%% *}"
        if [[ "$cached_digest" =~ ^[a-f0-9]{64}$ && "$actual_digest" == "$cached_digest" && -s "$download" ]]; then
            printf 'Using verified cached command %s\n' "$key"
        else
            # Only complete, nonempty, syntax-valid responses become visible.
            # This checksum trusts first HTTPS acquisition, not an independent signer.
            acquire
            actual_digest="$(sha256sum -- "$download")"
            actual_digest="${actual_digest%% *}"
            staging="$(mktemp -d "$cache_root/.download.XXXXXXXX")"
            cp -- "$download" "$staging/command.sh"
            printf '%s\n' "$actual_digest" > "$staging/sha256"
            if [[ -d "$entry" ]]; then
                rm -f -- "$entry/command.sh" "$entry/sha256"
                rmdir -- "$entry"
            fi
            mv -T -- "$staging" "$entry"
            staging=''
        fi
        flock -u 9
        exec 9>&-
    fi
    umask "$original_umask"
    bash "$download" "${STEAM_COMPAT_INSTALL_PATH:-}"
)
helper_status=$?
if (( helper_status != 0 )); then
    printf 'Recipe helper failed (exit %s); continuing game launch.\n' "$helper_status" >&2
fi
exec "$@"
