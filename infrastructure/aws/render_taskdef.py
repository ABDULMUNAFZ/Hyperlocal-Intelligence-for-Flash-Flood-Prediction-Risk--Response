#!/usr/bin/env python3
"""Render an ECS task-definition template: ${VAR} placeholders from the .state file (+ IMAGE, REGION)."""
import json, re, sys
tmpl, state_file, image, region = sys.argv[1:5]
state = dict(l.strip().split("=", 1) for l in open(state_file) if "=" in l)
state.update(IMAGE=image, REGION=region)
text = open(tmpl).read()
missing = sorted({m for m in re.findall(r"\$\{([A-Z_]+)\}", text) if m not in state})
if missing:
    sys.exit(f"missing state values: {missing}")
# values are inserted inside JSON strings, so JSON-escape them (regexes contain backslashes)
out = re.sub(r"\$\{([A-Z_]+)\}", lambda m: json.dumps(state[m.group(1)])[1:-1], text)
json.loads(out)
print(out)
