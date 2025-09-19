#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from jsonschema import Draft202012Validator
import json
import glob

app = FastAPI(title="Contracts Sidecar", version="0.1.0")

# Preload schemas from contracts/schemas
SCHEMAS = {}
for path in glob.glob("contracts/schemas/*.json"):
    with open(path) as f:
        SCHEMAS[path.split('/')[-1].split('.')[0]] = json.load(f)

class ValidateReq(BaseModel):
    schema: str
    data: dict

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/validate")
def validate(req: ValidateReq):
    key = req.schema
    if key not in SCHEMAS:
        raise HTTPException(status_code=400, detail=f"unknown schema '{key}'")
    schema = SCHEMAS[key]
    v = Draft202012Validator(schema)
    errors = sorted(v.iter_errors(req.data), key=lambda e: list(e.path))
    if errors:
        return {
            "ok": False,
            "errors": [
                {
                    "message": e.message,
                    "path": list(e.path),
                    "validator": e.validator,
                    "validator_value": e.validator_value,
                }
                for e in errors
            ],
        }
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8079)
