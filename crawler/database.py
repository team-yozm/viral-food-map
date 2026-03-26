from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from supabase import Client, create_client

from config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client


def get_active_trends():
    return (
        get_client()
        .table("trends")
        .select("*")
        .in_("status", ["rising", "active"])
        .execute()
        .data
    )


def get_all_keywords():
    return (
        get_client()
        .table("keywords")
        .select("*")
        .eq("is_active", True)
        .execute()
        .data
    )


def upsert_trend(trend_data: dict):
    return get_client().table("trends").upsert(trend_data).execute()


def insert_stores(stores: list[dict]):
    if not stores:
        return None
    return get_client().table("stores").upsert(
        stores, on_conflict="trend_id,name,address"
    ).execute()


def get_stores_by_trend_ids(trend_ids: list[str]):
    if not trend_ids:
        return []
    return (
        get_client()
        .table("stores")
        .select("trend_id,name,address")
        .in_("trend_id", trend_ids)
        .execute()
        .data
    )


def get_store_trend_lookup(batch_size: int = 1000) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    start = 0

    while True:
        result = (
            client.table("stores")
            .select("name,address,trends(name)")
            .range(start, start + batch_size - 1)
            .execute()
        )
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size

    return rows


def insert_keywords(keywords: list[dict]):
    if not keywords:
        return None
    return get_client().table("keywords").upsert(
        keywords, on_conflict="keyword"
    ).execute()


upsert_keywords = insert_keywords


def update_trend_status(trend_id: str, status: str):
    return (
        get_client()
        .table("trends")
        .update({"status": status})
        .eq("id", trend_id)
        .execute()
    )


def upsert_yomechu_places(places: list[dict[str, Any]]):
    if not places:
        return None
    return (
        get_client()
        .table("yomechu_places")
        .upsert(places, on_conflict="external_place_id")
        .execute()
    )


def get_yomechu_places_by_external_ids(external_place_ids: list[str]) -> list[dict[str, Any]]:
    if not external_place_ids:
        return []
    return (
        get_client()
        .table("yomechu_places")
        .select("*")
        .in_("external_place_id", external_place_ids)
        .execute()
        .data
        or []
    )


def insert_yomechu_spin(spin_row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_client().table("yomechu_spins").insert(spin_row).execute()
    data = result.data or []
    return data[0] if data else None


def insert_yomechu_feedback(feedback_row: dict[str, Any]) -> dict[str, Any] | None:
    result = get_client().table("yomechu_feedback").insert(feedback_row).execute()
    data = result.data or []
    return data[0] if data else None


def list_recent_yomechu_places(batch_size: int) -> list[dict[str, Any]]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    result = (
        get_client()
        .table("yomechu_places")
        .select("*")
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", desc=True)
        .limit(max(batch_size * 4, batch_size))
        .execute()
    )
    return result.data or []


def update_yomechu_place(
    place_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    result = (
        get_client()
        .table("yomechu_places")
        .update(payload)
        .eq("id", place_id)
        .execute()
    )
    data = result.data or []
    return data[0] if data else None
