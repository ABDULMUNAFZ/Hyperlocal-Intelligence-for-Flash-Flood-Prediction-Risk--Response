#!/usr/bin/env python3
"""
Pre-warm the geo cache from S3 at container start (production).

The backend caches fetched public geo data (DEM terrain, OSM, SoilGrids, WorldPop, climate, SACHET
messages, simulation results) under .cache/geo. Containers start with an empty disk, so the cache
built in local development / earlier runs is published to S3 and copied in here. Everything remains
re-fetchable from the original sources; this only avoids cold-start fetches.

    GEO_CACHE_S3_URI=s3://<bucket>/geo-cache   python scripts/sync_geo_cache.py
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

DEST = Path(__file__).resolve().parent.parent / ".cache" / "geo"


def main() -> int:
    uri = os.environ.get("GEO_CACHE_S3_URI")
    if not uri:
        return 0
    import boto3

    u = urlparse(uri)
    bucket, prefix = u.netloc, u.path.strip("/") + "/"
    s3 = boto3.client("s3")
    n = skipped = 0
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for o in page.get("Contents", []):
            rel = o["Key"][len(prefix):]
            if not rel or rel.endswith("/"):
                continue
            dest = DEST / rel
            if dest.exists() and dest.stat().st_size == o["Size"]:
                skipped += 1
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, o["Key"], str(dest))
            n += 1
    print(f"sync_geo_cache: {n} files downloaded, {skipped} already present → {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
