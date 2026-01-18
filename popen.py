import sys
import os
import subprocess
import signal
import time

def kill_process_by_name(script_name):
    """Kills processes using native system commands (No psutil required)."""
    current_pid = str(os.getpid())

    try:
        # 1. Use pgrep to find all PIDs matching the script name
        # -f: match full command line
        output = subprocess.check_output(["pgrep", "-f", script_name])
        pids = output.decode().split()

        for pid in pids:
            # 2. Safety: Don't kill the current script
            if pid == current_pid:
                continue

            try:
                print(f"Attempting to kill PID: {pid}")
                # 3. Send SIGTERM (graceful)
                os.kill(int(pid), signal.SIGTERM)

                # 4. Optional: check if it actually died, if not, SIGKILL
                time.sleep(0.5)
                try:
                    os.kill(int(pid), 0) # Check if still exists
                    os.kill(int(pid), signal.SIGKILL) # Force kill
                    print(f"Force killed PID: {pid}")
                except OSError:
                    print(f"PID {pid} terminated successfully.")

            except ProcessLookupError:
                continue
    except subprocess.CalledProcessError:
        # pgrep returns non-zero if no processes are found
        print("No existing processes found.")

def launch_singleton_process(script_name):
    """Kills existing instances and starts a fresh, detached one."""
    print(f"Cleaning up old instances of {script_name}...")
    kill_process_by_name(script_name)

    print(f"Launching {script_name}...")
    # Using the detachment method from the previous step
    process = subprocess.Popen(
        [sys.executable, script_name],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True
    )

    print(f"Launched {script_name} with PID: {process.pid}")

if __name__ == "__main__":
    target_script = "launch_options_watcher.py"

    # Use Case 1: Just kill the process
    # kill_process_by_name(target_script)

    # Use Case 2: Restart the process (Kill then Launch)
    # pgrep -f process-name to check if pid is running
    launch_singleton_process(target_script)