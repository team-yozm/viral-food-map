from __future__ import annotations

import asyncio
import logging
from typing import Any

from crawlers.image_finder import find_food_image
from database import get_client

logger = logging.getLogger(__name__)

ACTIVE_TREND_IMAGE_STATUSES = ("rising", "active")
IMAGE_REFRESH_CONCURRENCY = 3


def _load_target_trends(statuses: tuple[str, ...]) -> list[dict[str, Any]]:
    return (
        get_client()
        .table("trends")
        .select("id,name,category,image_url,status")
        .in_("status", list(statuses))
        .order("detected_at", desc=True)
        .execute()
        .data
        or []
    )


async def _refresh_one_trend_image(
    trend: dict[str, Any],
    *,
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    trend_id = str(trend.get("id") or "")
    trend_name = str(trend.get("name") or "").strip()
    current_image_url = trend.get("image_url")

    if not trend_id or not trend_name:
        return {
            "id": trend_id,
            "name": trend_name,
            "status": "skipped",
            "reason": "missing_required_fields",
        }

    async with semaphore:
        try:
            refreshed_image_url = await find_food_image(
                trend_name,
                category=trend.get("category"),
                existing_image_url=current_image_url,
            )
        except Exception as exc:
            logger.exception("Trend image refresh failed for %s", trend_name)
            return {
                "id": trend_id,
                "name": trend_name,
                "status": "failed",
                "error": str(exc),
            }

    if not refreshed_image_url:
        return {
            "id": trend_id,
            "name": trend_name,
            "status": "missing",
            "old_image_url": current_image_url,
            "new_image_url": None,
        }

    if refreshed_image_url == current_image_url:
        return {
            "id": trend_id,
            "name": trend_name,
            "status": "kept",
            "old_image_url": current_image_url,
            "new_image_url": refreshed_image_url,
        }

    try:
        (
            get_client()
            .table("trends")
            .update({"image_url": refreshed_image_url})
            .eq("id", trend_id)
            .execute()
        )
    except Exception as exc:
        logger.exception("Trend image update failed for %s", trend_name)
        return {
            "id": trend_id,
            "name": trend_name,
            "status": "failed",
            "old_image_url": current_image_url,
            "new_image_url": refreshed_image_url,
            "error": str(exc),
        }

    return {
        "id": trend_id,
        "name": trend_name,
        "status": "updated",
        "old_image_url": current_image_url,
        "new_image_url": refreshed_image_url,
    }


async def refresh_images_for_active_trends() -> dict[str, Any]:
    trends = _load_target_trends(ACTIVE_TREND_IMAGE_STATUSES)
    semaphore = asyncio.Semaphore(IMAGE_REFRESH_CONCURRENCY)
    results = await asyncio.gather(
        *[
            _refresh_one_trend_image(trend, semaphore=semaphore)
            for trend in trends
        ]
    )

    updated_trends = [result for result in results if result["status"] == "updated"]
    failed_trends = [result for result in results if result["status"] == "failed"]

    return {
        "target_statuses": list(ACTIVE_TREND_IMAGE_STATUSES),
        "target_trends": len(trends),
        "processed_trends": len(results),
        "updated_images": len(updated_trends),
        "kept_images": sum(1 for result in results if result["status"] == "kept"),
        "missing_images": sum(
            1 for result in results if result["status"] == "missing"
        ),
        "skipped_images": sum(
            1 for result in results if result["status"] == "skipped"
        ),
        "failed_images": len(failed_trends),
        "updated_trends": updated_trends,
        "failed_trends": failed_trends,
    }
