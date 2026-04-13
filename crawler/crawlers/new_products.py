from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode, urljoin

import httpx
from bs4 import BeautifulSoup

from config import settings
from database import (
    create_new_product_crawl_run,
    get_new_products_by_source_id,
    update_new_product_crawl_run,
    update_new_product_source,
    upsert_new_product_source,
    upsert_new_products,
)

logger = logging.getLogger(__name__)

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
    )
}
GS25_PAGE_SIZE = 8
GS25_MAX_PAGES = 5
EMART24_MAX_PAGES = 3
LOTTEEATZ_MAX_ITEMS = 40
LOTTEEATZ_NEW_KEYWORDS = ("출시", "신메뉴", "신제품", "런칭")
NON_FOOD_KEYWORDS = (
    "굿즈",
    "머그",
    "텀블러",
    "키링",
    "스티커",
    "쿠폰",
    "할인",
    "단체주문",
    "안내",
    "이벤트",
)


@dataclass(slots=True)
class NewProductSourceDefinition:
    source_key: str
    title: str
    brand: str
    source_type: str
    channel: str
    site_url: str
    crawl_url: str


@dataclass(slots=True)
class ParsedNewProduct:
    external_id: str
    name: str
    brand: str
    source_type: str
    channel: str
    category: str | None
    summary: str | None
    image_url: str | None
    product_url: str | None
    published_at: str | None
    available_from: str | None
    available_to: str | None
    is_limited: bool
    is_food: bool
    raw_payload: dict[str, Any]


SOURCE_DEFINITIONS: tuple[NewProductSourceDefinition, ...] = (
    NewProductSourceDefinition(
        source_key="emart24_fresh_food",
        title="이마트24 Fresh Food",
        brand="이마트24",
        source_type="convenience",
        channel="Fresh Food",
        site_url="https://www.emart24.co.kr/goods/ff",
        crawl_url="https://www.emart24.co.kr/goods/ff",
    ),
    NewProductSourceDefinition(
        source_key="gs25_event_goods",
        title="GS25 행사상품",
        brand="GS25",
        source_type="convenience",
        channel="행사상품",
        site_url="https://gs25.gsretail.com/gscvs/ko/products/event-goods",
        crawl_url="https://gs25.gsretail.com/gscvs/ko/products/event-goods-search",
    ),
    NewProductSourceDefinition(
        source_key="lotteeatz_launch_events",
        title="LOTTE EATZ 신제품 이벤트",
        brand="롯데리아",
        source_type="franchise",
        channel="이벤트",
        site_url="https://www.lotteeatz.com/event/main",
        crawl_url="https://www.lotteeatz.com/event/main",
    ),
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_datetime(value: str | None, formats: tuple[str, ...]) -> str | None:
    if not value:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    for date_format in formats:
        try:
            parsed = datetime.strptime(normalized, date_format)
        except ValueError:
            continue
        return parsed.replace(tzinfo=timezone.utc).isoformat()

    return None


def _parse_dot_date(value: str | None) -> str | None:
    return _parse_datetime(value, ("%Y.%m.%d",))


def _parse_gs25_datetime(value: str | None) -> str | None:
    return _parse_datetime(value, ("%b %d, %Y %I:%M:%S %p",))


def _looks_like_food(name: str) -> bool:
    normalized = re.sub(r"\s+", "", name).lower()
    return not any(keyword in normalized for keyword in NON_FOOD_KEYWORDS)


def _normalize_brand_label(label: str) -> str:
    normalized = re.sub(r"\s+", " ", label).strip()
    return normalized.split(" 픽업")[0].strip()


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str:
    response = await client.get(url, headers=REQUEST_HEADERS)
    response.raise_for_status()
    return response.text


async def _crawl_emart24_fresh_food(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    products: list[ParsedNewProduct] = []

    for page in range(1, EMART24_MAX_PAGES + 1):
        params = {"page": page}
        html = await _fetch_text(client, f"{source.crawl_url}?{urlencode(params)}")
        soup = BeautifulSoup(html, "html.parser")
        items = soup.select(".itemWrap")
        if not items:
            break

        added_in_page = 0
        for item in items:
            badge = item.select_one(".itemTit span")
            badge_text = badge.get_text(" ", strip=True) if badge else ""
            if "NEW" not in badge_text.upper():
                continue

            name_element = item.select_one(".itemtitle a")
            price_element = item.select_one(".price")
            image_element = item.select_one(".itemSpImg img")

            name = name_element.get_text(" ", strip=True) if name_element else ""
            if not name:
                continue

            image_url = image_element.get("src") if image_element else None
            external_id = (
                (image_url or "").rstrip("/").rsplit("/", 1)[-1]
                or f"emart24::{page}::{name}"
            )
            price_text = price_element.get_text(" ", strip=True) if price_element else None

            products.append(
                ParsedNewProduct(
                    external_id=external_id,
                    name=name,
                    brand=source.brand,
                    source_type=source.source_type,
                    channel=source.channel,
                    category="Fresh Food",
                    summary=f"{source.title} 신상품{f' · {price_text}' if price_text else ''}",
                    image_url=image_url,
                    product_url=source.site_url,
                    published_at=None,
                    available_from=None,
                    available_to=None,
                    is_limited=False,
                    is_food=True,
                    raw_payload={
                        "page": page,
                        "badge": badge_text,
                        "price": price_text,
                    },
                )
            )
            added_in_page += 1

        if added_in_page == 0:
            break

    return products


def _decode_gs25_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        return json.loads(payload)
    return payload


async def _crawl_gs25_event_goods(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    products: list[ParsedNewProduct] = []

    for page in range(1, GS25_MAX_PAGES + 1):
        response = await client.get(
            source.crawl_url,
            params={"pageNum": page, "pageSize": GS25_PAGE_SIZE},
            headers={**REQUEST_HEADERS, "X-Requested-With": "XMLHttpRequest"},
        )
        response.raise_for_status()

        payload = _decode_gs25_payload(response.json())
        results = payload.get("results") or []
        if not results:
            break

        for item in results:
            name = str(item.get("goodsNm") or "").strip()
            if not name or not _looks_like_food(name):
                continue

            published_at = (
                _parse_gs25_datetime(item.get("imageFileAppDt"))
                or _parse_gs25_datetime(item.get("goodsStatAppDt"))
                or _parse_gs25_datetime(item.get("priceApplyDate"))
            )
            if published_at:
                published_dt = datetime.fromisoformat(published_at)
                if (
                    datetime.now(timezone.utc) - published_dt
                ).days > settings.NEW_PRODUCTS_LOOKBACK_DAYS:
                    continue

            price = item.get("price")
            event_type = str(item.get("eventTypeNm") or "").strip()
            gift_name = str(item.get("giftGoodsNm") or "").strip()
            summary_parts = [part for part in [event_type, f"{int(price):,}원" if price else None] if part]
            if gift_name:
                summary_parts.append(f"증정 {gift_name}")

            products.append(
                ParsedNewProduct(
                    external_id=str(item.get("attFileId") or name),
                    name=name,
                    brand=source.brand,
                    source_type=source.source_type,
                    channel=source.channel,
                    category=event_type or "행사상품",
                    summary=" · ".join(summary_parts) or source.title,
                    image_url=item.get("attFileNm"),
                    product_url=source.site_url,
                    published_at=published_at,
                    available_from=published_at,
                    available_to=None,
                    is_limited=True,
                    is_food=True,
                    raw_payload=item,
                )
            )

    return products


def _parse_lotteeatz_period(period_text: str) -> tuple[str | None, str | None]:
    parts = [part.strip() for part in period_text.split("~", 1)]
    if len(parts) != 2:
        return None, None

    start_at = _parse_dot_date(parts[0])
    end_at = _parse_dot_date(parts[1])
    if parts[1].startswith(("2999", "9999")):
        end_at = None

    return start_at, end_at


async def _crawl_lotteeatz_launch_events(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    html = await _fetch_text(client, source.crawl_url)
    soup = BeautifulSoup(html, "html.parser")
    products: list[ParsedNewProduct] = []

    for item in soup.select("li.grid-item")[:LOTTEEATZ_MAX_ITEMS]:
        title_element = item.select_one(".grid-title")
        period_element = item.select_one(".grid-period")
        link_element = item.select_one('a[href*="/event/main/selectEvent/"]')
        image_element = item.select_one("img")
        badge_element = item.select_one('[class*="badge"]')

        title = title_element.get_text(" ", strip=True) if title_element else ""
        if not title or not any(keyword in title for keyword in LOTTEEATZ_NEW_KEYWORDS):
            continue
        if not _looks_like_food(title):
            continue

        brand = _normalize_brand_label(
            badge_element.get_text(" ", strip=True) if badge_element else source.brand
        )
        href = link_element.get("href") if link_element else ""
        external_id = href.rstrip("/").rsplit("/", 1)[-1] if href else title
        available_from, available_to = _parse_lotteeatz_period(
            period_element.get_text(" ", strip=True) if period_element else ""
        )

        products.append(
            ParsedNewProduct(
                external_id=external_id,
                name=title,
                brand=brand,
                source_type=source.source_type,
                channel=source.channel,
                category="신제품 이벤트",
                summary=f"{brand} 공식 이벤트",
                image_url=image_element.get("src") if image_element else None,
                product_url=urljoin(source.site_url, href) if href else source.site_url,
                published_at=available_from,
                available_from=available_from,
                available_to=available_to,
                is_limited=True,
                is_food=True,
                raw_payload={
                    "period": period_element.get_text(" ", strip=True)
                    if period_element
                    else None,
                    "brand_label": badge_element.get_text(" ", strip=True)
                    if badge_element
                    else None,
                },
            )
        )

    return products


async def _crawl_source(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    if source.source_key == "emart24_fresh_food":
        return await _crawl_emart24_fresh_food(client, source)
    if source.source_key == "gs25_event_goods":
        return await _crawl_gs25_event_goods(client, source)
    if source.source_key == "lotteeatz_launch_events":
        return await _crawl_lotteeatz_launch_events(client, source)
    return []


def _build_source_payload(source: NewProductSourceDefinition) -> dict[str, Any]:
    return {
        "source_key": source.source_key,
        "title": source.title,
        "brand": source.brand,
        "source_type": source.source_type,
        "channel": source.channel,
        "site_url": source.site_url,
        "crawl_url": source.crawl_url,
        "is_active": True,
    }


async def refresh_new_products(trigger: str = "scheduler") -> dict[str, Any]:
    started_at = _utc_now_iso()
    summary: dict[str, Any] = {
        "sources": 0,
        "fetched_products": 0,
        "inserted_products": 0,
        "updated_products": 0,
        "visible_products": 0,
        "source_summaries": [],
    }

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for source in SOURCE_DEFINITIONS:
            source_row = upsert_new_product_source(_build_source_payload(source))
            if not source_row:
                logger.warning(
                    "Skipping new products source without persisted row: %s",
                    source.source_key,
                )
                continue

            source_id = str(source_row["id"])
            run_row = create_new_product_crawl_run(
                {
                    "source_id": source_id,
                    "source_key": source.source_key,
                    "trigger": trigger,
                    "status": "running",
                    "started_at": started_at,
                }
            )
            run_id = str(run_row["id"]) if run_row else None

            try:
                existing_rows = get_new_products_by_source_id(source_id)
                existing_lookup = {
                    str(row.get("external_id") or ""): row
                    for row in existing_rows
                    if row.get("external_id")
                }
                existing_ids = set(existing_lookup)
                parsed_products = await _crawl_source(client, source)
                payloads = [
                    {
                        "source_id": source_id,
                        "external_id": product.external_id,
                        "name": product.name,
                        "brand": product.brand,
                        "source_type": product.source_type,
                        "channel": product.channel,
                        "category": product.category,
                        "summary": product.summary,
                        "image_url": product.image_url,
                        "product_url": product.product_url,
                        "published_at": product.published_at,
                        "available_from": product.available_from,
                        "available_to": product.available_to,
                        "last_seen_at": started_at,
                        "is_food": product.is_food,
                        "is_limited": product.is_limited,
                        "status": str(
                            existing_lookup.get(product.external_id, {}).get("status")
                            or "visible"
                        ),
                        "raw_payload": product.raw_payload,
                    }
                    for product in parsed_products
                    if product.is_food
                ]

                inserted_count = sum(
                    1 for payload in payloads if payload["external_id"] not in existing_ids
                )
                updated_count = max(len(payloads) - inserted_count, 0)
                upsert_new_products(payloads)

                finished_at = _utc_now_iso()
                update_new_product_source(
                    source_id,
                    {
                        "last_crawled_at": finished_at,
                        "last_success_at": finished_at,
                    },
                )
                if run_id:
                    update_new_product_crawl_run(
                        run_id,
                        {
                            "status": "success",
                            "fetched_count": len(parsed_products),
                            "inserted_count": inserted_count,
                            "updated_count": updated_count,
                            "visible_count": len(payloads),
                            "summary": {
                                "title": source.title,
                                "source_type": source.source_type,
                            },
                            "finished_at": finished_at,
                        },
                    )

                source_summary = {
                    "source_key": source.source_key,
                    "title": source.title,
                    "fetched": len(parsed_products),
                    "inserted": inserted_count,
                    "updated": updated_count,
                    "visible": len(payloads),
                }
                summary["sources"] += 1
                summary["fetched_products"] += len(parsed_products)
                summary["inserted_products"] += inserted_count
                summary["updated_products"] += updated_count
                summary["visible_products"] += len(payloads)
                summary["source_summaries"].append(source_summary)
            except Exception as exc:
                finished_at = _utc_now_iso()
                update_new_product_source(source_id, {"last_crawled_at": finished_at})
                if run_id:
                    update_new_product_crawl_run(
                        run_id,
                        {
                            "status": "failed",
                            "error_message": str(exc),
                            "finished_at": finished_at,
                        },
                    )
                raise

    return summary
