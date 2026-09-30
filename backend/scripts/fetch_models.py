#!/usr/bin/env python3
"""
Download trained model artifacts from S3 at container start (production).

Model binaries are not stored in git or baked into images. The registry index
(models/registry/index.json, in git) lists each model's `model_path`; for every
PRODUCTION / STAGING model this script syncs its artifact directory from

    ${MODEL_ARTIFACTS_S3_URI}/<artifact dir>/        e.g. s3://bucket/models/trained/20260929_014902/

into the same relative path inside the container. Missing S3 objects are reported, never faked:
the prediction API then reports the model as not loaded.
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
STAGES = {s.strip() for s in os.environ.get("MODEL_STAGES_TO_FETCH", "production,staging").split(",") if s.strip()}


def main() -> int:
    uri = os.environ.get("MODEL_ARTIFACTS_S3_URI")
    if not uri:
        print("fetch_models: MODEL_ARTIFACTS_S3_URI not set — skipping")
        return 0
    import boto3

    u = urlparse(uri)
    bucket, prefix = u.netloc, u.path.strip("/")
    index = json.loads((ROOT / "models" / "registry" / "index.json").read_text())
    dirs = sorted({str(Path(m["model_path"]).parent) for m in index.values() if m.get("stage") in STAGES})
    s3 = boto3.client("s3")
    fetched = missing = 0
    for d in dirs:
        # model_path is relative to the backend root, e.g. models/trained/<run>/ensemble.pkl
        key_prefix = f"{prefix}/{d.removeprefix('models/').removeprefix('/')}/" if prefix else f"{d}/"
        pages = s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=key_prefix)
        objs = [o for p in pages for o in p.get("Contents", [])]
        if not objs:
            print(f"fetch_models: no objects at s3://{bucket}/{key_prefix}", file=sys.stderr)
            missing += 1
            continue
        for o in objs:
            dest = ROOT / d / Path(o["Key"]).name
            if dest.exists() and dest.stat().st_size == o["Size"]:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, o["Key"], str(dest))
            fetched += 1
    print(f"fetch_models: {len(dirs)} artifact dirs, {fetched} files downloaded, {missing} missing")
    return 0 if missing == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
