from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime

from crawlers.store_finder import find_stores_nationwide
from database import (
    get_active_trends,
    get_keyword_aliases_by_canonical_keywords,
    get_stores_by_trend_ids,
    insert_stores,
)
from detector.alias_manager import build_alias_terms_by_canonical, dedupe_terms

logger = logging.getLogger(__name__)

# detect_trends에서 방금 판매처를 검색한 트렌드를 기록 — store_update_job 중복 방지
_RECENTLY_SEARCHED_TTL = 3600.0  # 1시간
_recently_searched: dict[str, float] = {}


def mark_stores_recently_searched(trend_ids: list[str]) -> None:
    now = time.monotonic()
    for tid in trend_ids:
        _recently_searched[tid] = now


def _is_recently_searched(trend_id: str) -> bool:
    ts = _recently_searched.get(trend_id)
    return ts is not None and (time.monotonic() - ts) < _RECENTLY_SEARCHED_TTL


def _evict_stale_searches() -> None:
    cutoff = time.monotonic() - _RECENTLY_SEARCHED_TTL
    stale = [tid for tid, ts in _recently_searched.items() if ts < cutoff]
    for tid in stale:
        del _recently_searched[tid]


def _store_key(name: str, address: str) -> tuple[str, str]:
    return (name.strip(), address.strip())


def build_store_records(
    trend_id: str,
    stores: list[dict],
    existing_keys: set[tuple[str, str]] | None = None,
) -> list[dict]:
    known_keys = existing_keys if existing_keys is not None else set()
    generated_keys = set()
    collected_at = datetime.now().isoformat()
    records = []

    for store in stores:
        key = _store_key(store["name"], store["address"])
        if key in known_keys or key in generated_keys:
            continue

        generated_keys.add(key)
        known_keys.add(key)
        records.append(
            {
                **store,
                "id": str(uuid.uuid4()),
                "trend_id": trend_id,
                "last_updated": collected_at,
            }
        )

    return records


async def refresh_stores_for_active_trends() -> dict:
    logger.info("=== store refresh started ===")
    _evict_stale_searches()

    all_trends = get_active_trends() or []
    trends = [t for t in all_trends if t.get("status") != "watchlist"]
    summary = {
        "target_trends": len(trends),
        "processed_trends": 0,
        "added_stores": 0,
        "changed_trends": [],
    }

    if not trends:
        return summary

    trend_ids = [trend["id"] for trend in trends if trend.get("id")]
    existing_stores = get_stores_by_trend_ids(trend_ids) or []
    existing_keys_by_trend: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for store in existing_stores:
        existing_keys_by_trend[store["trend_id"]].add(
            _store_key(store["name"], store["address"])
        )

    alias_rows = get_keyword_aliases_by_canonical_keywords(
        [trend["name"] for trend in trends if trend.get("name")]
    )
    alias_terms_by_canonical = build_alias_terms_by_canonical(alias_rows)

    for trend in trends:
        trend_id = trend.get("id")
        keyword = trend.get("name")
        if not trend_id or not keyword:
            continue

        if _is_recently_searched(trend_id):
            summary["processed_trends"] += 1
            continue

        summary["processed_trends"] += 1
        search_terms = dedupe_terms(
            [keyword, *alias_terms_by_canonical.get(keyword, [])]
        )
        stores = await find_stores_nationwide(search_terms)
        new_records = build_store_records(
            trend_id=trend_id,
            stores=stores,
            existing_keys=existing_keys_by_trend[trend_id],
        )

        if not new_records:
            continue

        insert_stores(new_records)
        summary["added_stores"] += len(new_records)
        summary["changed_trends"].append(keyword)

    logger.info(
        "=== store refresh finished: %s trends, %s stores ===",
        summary["processed_trends"],
        summary["added_stores"],
    )
    return summary
