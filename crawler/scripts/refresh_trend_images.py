from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from crawlers.image_finder import find_food_image, should_refresh_existing_image
from database import get_client


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh stored trend images with the latest image matcher."
    )
    parser.add_argument(
        "--name",
        help="Refresh only one exact trend name.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of trends to inspect.",
    )
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="Include inactive trends as refresh targets.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes without updating Supabase.",
    )
    parser.add_argument(
        "--force-all",
        action="store_true",
        help="Refresh even images that do not look suspicious.",
    )
    return parser.parse_args()


def load_trends(*, name: str | None, limit: int, include_inactive: bool) -> list[dict]:
    query = (
        get_client()
        .table("trends")
        .select("id,name,category,image_url,status")
        .order("detected_at", desc=True)
    )

    if name:
        query = query.eq("name", name)
    elif not include_inactive:
        query = query.in_("status", ["rising", "active"])

    if limit > 0:
        query = query.limit(limit)

    return query.execute().data or []


async def refresh_trend_images(
    *,
    trends: list[dict],
    dry_run: bool,
    force_all: bool,
) -> None:
    client = get_client()
    changed = 0

    for trend in trends:
        current_image_url = trend.get("image_url")
        if not force_all and not should_refresh_existing_image(current_image_url):
            print(f"SKIP {trend.get('name')} -> stable source")
            continue

        refreshed_image_url = await find_food_image(
            trend.get("name", ""),
            category=trend.get("category"),
            existing_image_url=current_image_url,
        )

        if not refreshed_image_url or refreshed_image_url == current_image_url:
            print(f"KEEP {trend.get('name')} -> {current_image_url or 'no image'}")
            continue

        changed += 1
        print(f"REPLACE {trend.get('name')}")
        print(f"  old: {current_image_url or 'no image'}")
        print(f"  new: {refreshed_image_url}")

        if dry_run:
            continue

        (
            client.table("trends")
            .update({"image_url": refreshed_image_url})
            .eq("id", trend["id"])
            .execute()
        )

    print(
        f"Checked {len(trends)} trends, "
        f"{changed} image(s) {'would be updated' if dry_run else 'updated'}."
    )


async def main() -> None:
    args = parse_args()
    trends = load_trends(
        name=args.name,
        limit=args.limit,
        include_inactive=args.include_inactive,
    )
    await refresh_trend_images(
        trends=trends,
        dry_run=args.dry_run,
        force_all=args.force_all,
    )


if __name__ == "__main__":
    asyncio.run(main())
