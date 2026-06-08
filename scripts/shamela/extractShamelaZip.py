#!/usr/bin/env python3
"""
Extract Shamela Internet Archive zips (macOS unzip often fails on these files).

Usage:
  python3 scripts/shamela/extractShamelaZip.py ZIP DEST [--prefix shamela_4/database/]
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract Shamela archive zip via Python zipfile")
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("dest_dir", type=Path)
    parser.add_argument(
        "--prefix",
        action="append",
        default=[],
        help="Only extract entries starting with this prefix (repeatable)",
    )
    args = parser.parse_args()

    zip_path = args.zip_path.expanduser().resolve()
    dest_dir = args.dest_dir.resolve()
    prefixes = args.prefix or []

    if not zip_path.is_file():
        print(f"Zip not found: {zip_path}", file=sys.stderr)
        return 1

    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted = 0
    skipped = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            name = info.filename
            if name.endswith("/"):
                continue
            if prefixes and not any(name.startswith(p) for p in prefixes):
                skipped += 1
                continue
            target = dest_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and target.stat().st_size == info.file_size:
                continue
            with zf.open(info) as src, open(target, "wb") as out:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            extracted += 1
            if extracted % 500 == 0:
                print(f"  … {extracted} files", flush=True)

    print(f"Done. extracted={extracted} skipped={skipped} → {dest_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
