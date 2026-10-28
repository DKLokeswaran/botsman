#!/usr/bin/env python3
"""Write latest.json from the installer and the APK that were just built.

The file is what the apps fetch. Put it in the same directory as the two
artifacts on the download server. URLs are the base URL plus each file name.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def artifact(path: Path, base: str, version_code: int | None = None) -> dict:
    record = {
        "url": f"{base.rstrip('/')}/{path.name}",
        "sha256": digest(path),
        "size": path.stat().st_size,
    }
    if version_code is not None:
        record["versionCode"] = version_code
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description="Build latest.json for the download server")
    parser.add_argument("--version", default="0.1.0")
    parser.add_argument("--build", required=True, type=int)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--windows", required=True, type=Path)
    parser.add_argument("--android", required=True, type=Path)
    parser.add_argument("--base-url", default="http://100.113.35.96:8711")
    parser.add_argument("--output", type=Path, default=Path("latest.json"))
    parser.add_argument("--android-version-code", type=int)
    args = parser.parse_args()
    for path in (args.windows, args.android):
        if not path.is_file():
            raise SystemExit(f"missing artifact: {path}")
    version_code = args.android_version_code if args.android_version_code is not None else args.build
    document = {
        "version": args.version,
        "build": args.build,
        "sha": args.sha,
        "windows": artifact(args.windows, args.base_url),
        "android": artifact(args.android, args.base_url, version_code),
    }
    text = json.dumps(document, indent=2) + "\n"
    args.output.write_text(text, encoding="utf-8")
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
