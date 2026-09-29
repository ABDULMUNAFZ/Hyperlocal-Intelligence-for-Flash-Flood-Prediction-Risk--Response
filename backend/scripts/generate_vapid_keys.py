#!/usr/bin/env python3
"""
Generate a Web Push (VAPID) key pair and print the .env lines.

  docker compose exec backend python scripts/generate_vapid_keys.py --subject mailto:ops@your-agency.example >> .env

The private key must stay server-side (.env / secret store). Rotating keys invalidates every existing
browser subscription: users must press ALLOW EMERGENCY ALERTS again.
"""

import argparse
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", required=True, help="mailto: or https: contact for push services")
    args = ap.parse_args()
    if not args.subject.startswith(("mailto:", "https://")):
        raise SystemExit("--subject must start with mailto: or https://")
    key = ec.generate_private_key(ec.SECP256R1())
    private = b64u(key.private_numbers().private_value.to_bytes(32, "big"))
    public = b64u(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    print(f"VAPID_PUBLIC_KEY={public}")
    print(f"VAPID_PRIVATE_KEY={private}")
    print(f"VAPID_SUBJECT={args.subject}")


if __name__ == "__main__":
    main()
