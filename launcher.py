import os
import sys

# 1. Logic before the game
print("Python logic is running...")

# 2. Extract the game command
# sys.argv[0] is the script name
# sys.argv[1:] is the %command% from Steam
if len(sys.argv) > 1:
    executable = sys.argv[1]
    args = sys.argv[1:]

    # 3. Final Launch
    # This replaces the Python process with the Game/Proton process
    # It preserves all Steam Environment Variables (os.environ)
    os.execvpe(executable, args, os.environ)
else:
    print("Error: No game command received from Steam.")