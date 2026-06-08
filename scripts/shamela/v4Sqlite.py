#!/usr/bin/env python3
"""Read Shamela v4 SQLite databases; prints JSON to stdout."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path


def book_db_folder(book_id: int) -> str:
    return str(book_id % 1000).zfill(3)


def book_db_zip_path(book_id: int) -> str:
    folder = book_db_folder(book_id)
    return f"shamela_4/database/book/{folder}/{book_id}.db"


def cmd_catalog(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    authors = {
        int(r["author_id"]): r["author_name"]
        for r in cur.execute("SELECT author_id, author_name FROM author")
    }
    categories = {
        int(r["category_id"]): r["category_name"]
        for r in cur.execute("SELECT category_id, category_name, category_order FROM category")
    }

    books = []
    for row in cur.execute(
        """
        SELECT book_id, book_name, book_category, book_date, authors, main_author, meta_data, hidden
        FROM book
        ORDER BY book_id
        """
    ):
        if row["hidden"]:
            continue
        meta = {}
        if row["meta_data"]:
            try:
                meta = json.loads(row["meta_data"])
            except json.JSONDecodeError:
                meta = {}
        books.append(
            {
                "book_id": int(row["book_id"]),
                "title": (row["book_name"] or "").strip(),
                "category_id": int(row["book_category"]) if row["book_category"] else None,
                "category_name": categories.get(int(row["book_category"] or 0)),
                "author_ids": [int(x) for x in str(row["authors"] or "").split(",") if x.strip().isdigit()],
                "main_author_id": int(row["main_author"]) if row["main_author"] else None,
                "author_name": authors.get(int(row["main_author"] or 0)),
                "year": parse_year(row["book_date"], meta),
                "zip_path": book_db_zip_path(int(row["book_id"])),
            }
        )

    print(
        json.dumps(
            {"authors": authors, "categories": categories, "books": books},
            ensure_ascii=False,
        )
    )
    conn.close()


def parse_year(book_date, meta: dict):
    for key in ("date", "year", "hijri"):
        if key in meta:
            try:
                n = int(str(meta[key])[:4], 10)
                if 100 < n < 9999:
                    return n
            except ValueError:
                pass
    try:
        n = int(book_date or 0)
        if 100 < n < 99999:
            return n
    except (TypeError, ValueError):
        pass
    return None


def cmd_pages(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    pages = []
    for row_id, part, page, number, services in cur.execute(
        "SELECT id, part, page, number, services FROM page ORDER BY id"
    ):
        content = ""
        if services:
            content = str(services).strip()
        pages.append(
            {
                "page_index": int(row_id),
                "page_label": str(page) if page is not None else None,
                "part": str(part) if part else None,
                "content": content,
            }
        )
    print(json.dumps({"pages": pages}, ensure_ascii=False))
    conn.close()


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: v4Sqlite.py catalog|pages DB_PATH", file=sys.stderr)
        return 1
    cmd, db_path = sys.argv[1], sys.argv[2]
    if not Path(db_path).is_file():
        print(f"DB not found: {db_path}", file=sys.stderr)
        return 1
    if cmd == "catalog":
        cmd_catalog(db_path)
    elif cmd == "pages":
        cmd_pages(db_path)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
