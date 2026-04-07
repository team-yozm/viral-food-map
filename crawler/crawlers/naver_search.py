from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

from config import settings

logger = logging.getLogger(__name__)

NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/blog"


@dataclass(slots=True)
class BlogSearchInsights:
    total_count: int
    sampled_count: int
    recent_count: int
    recent_ratio: float


def _build_headers() -> dict[str, str]:
    return {
        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
    }


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _parse_postdate(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y%m%d")
    except ValueError:
        return None


async def _request_blog_search(keyword: str, *, display: int) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            NAVER_SEARCH_URL,
            params={"query": keyword, "display": display, "sort": "date"},
            headers=_build_headers(),
            timeout=10,
        )
        response.raise_for_status()
    return response.json()


async def search_blog_mentions(keyword: str, display: int = 5) -> list[str]:
    try:
        payload = await _request_blog_search(keyword, display=display)
    except Exception as exc:
        logger.error("Naver blog search failed for '%s': %s", keyword, exc)
        return []

    snippets: list[str] = []
    for item in payload.get("items", []):
        title = _strip_html(item.get("title", ""))
        description = _strip_html(item.get("description", ""))
        snippet = " / ".join(part for part in (title, description) if part)
        if snippet:
            snippets.append(snippet[:220])
    return snippets


async def get_blog_mention_count(keyword: str) -> int:
    try:
        payload = await _request_blog_search(keyword, display=1)
    except Exception as exc:
        logger.error("Naver blog count failed for '%s': %s", keyword, exc)
        return 0

    return int(payload.get("total", 0) or 0)


async def get_blog_search_insights(
    keyword: str,
    *,
    display: int = 20,
    recent_days: int = 7,
) -> BlogSearchInsights:
    try:
        payload = await _request_blog_search(keyword, display=display)
    except Exception as exc:
        logger.error("Naver blog insights failed for '%s': %s", keyword, exc)
        return BlogSearchInsights(
            total_count=0,
            sampled_count=0,
            recent_count=0,
            recent_ratio=0.0,
        )

    items = payload.get("items", [])
    recent_cutoff = datetime.now() - timedelta(days=recent_days)
    recent_count = 0
    for item in items:
        postdate = _parse_postdate(item.get("postdate"))
        if postdate and postdate >= recent_cutoff:
            recent_count += 1

    sampled_count = len(items)
    recent_ratio = recent_count / sampled_count if sampled_count else 0.0
    return BlogSearchInsights(
        total_count=int(payload.get("total", 0) or 0),
        sampled_count=sampled_count,
        recent_count=recent_count,
        recent_ratio=round(recent_ratio, 2),
    )
