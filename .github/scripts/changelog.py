"""Resolve the store-only commit range for a release changelog."""

import json
import re
import subprocess
import sys


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def store_range(tag, previous_tag):
    head = git("rev-parse", "origin/with-store")
    history = git("log", "--first-parent", "--format=%H %s", head)
    baseline = previous_tag
    for line in history.splitlines():
        sha, subject = line.split(" ", 1)
        match = re.fullmatch(r"chore: merge (v\d+\.\d+\.\d+) into with-store", subject)
        if not match:
            continue
        merged_tag = match[1]
        if merged_tag == tag:
            # Reruns must describe the original store build, not newer branch work.
            head = sha
            continue
        ancestor = subprocess.run(
            ["git", "merge-base", "--is-ancestor", f"refs/tags/{merged_tag}", f"refs/tags/{tag}"],
            check=False,
        )
        if ancestor.returncode not in (0, 1):
            ancestor.check_returncode()
        if ancestor.returncode == 0:
            baseline = sha
            break
    return {"from": baseline, "to": head}


if __name__ == "__main__":
    print(json.dumps(store_range(*sys.argv[1:])))
