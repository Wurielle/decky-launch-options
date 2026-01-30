#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run import parse_launch_option

# Test env-only cases
cases = [
    "SteamDeck=1",
    "SteamDeck=1 %command%"
]

for case in cases:
    print(f"\nInput: '{case}'")
    result = parse_launch_option(case)
    print(f"  env_vars: {result['env_vars']}")
    print(f"  prefix:   {result['prefix']}")
    print(f"  suffix:   {result['suffix']}")
