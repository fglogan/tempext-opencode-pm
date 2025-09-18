#!/usr/bin/env python3
import json, sys, glob
from jsonschema import validate, Draft202012Validator

schemas = {
  "context.pack.schema.json": None,
  "orchestration.snapshot.schema.json": None,
  "task.runlog.schema.json": None
}

# load schemas
for path in glob.glob("contracts/schemas/*.json"):
    name = path.split("/")[-1]
    with open(path) as f:
        schemas[name] = json.load(f)

# validate examples
ok = True
for ex in glob.glob("contracts/examples/*.json"):
    with open(ex) as f:
        data = json.load(f)
    schema_key = [k for k in schemas if k.split(".")[0] in ex][0]
    schema = schemas[schema_key]
    v = Draft202012Validator(schema)
    errors = sorted(v.iter_errors(data), key=lambda e: e.path)
    if errors:
        print(f"[FAIL] {ex}")
        for e in errors: print("  -", e.message)
        ok = False
    else:
        print(f"[OK]   {ex}")

sys.exit(0 if ok else 1)