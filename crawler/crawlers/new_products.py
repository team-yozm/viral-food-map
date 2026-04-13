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
    expire_new_products,
    expire_new_products_by_source_id,
    get_new_products_by_source_id,
    list_new_product_sources,
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
EMART24_MAX_PAGES = 3
LOTTEEATZ_MAX_ITEMS = 40
PAIKDABANG_MAX_ITEMS = 40
KFC_MAX_ITEMS = 20
MCDONALDS_MAX_ITEMS = 20
MEGA_MAX_ITEMS = 12
STARBUCKS_DRINK_CATEGORY_CODES = (
    "W0000171",
    "W0000060",
    "W0000003",
    "W0000004",
    "W0000005",
    "W0000422",
    "W0000061",
    "W0000075",
    "W0000053",
    "W0000062",
)
STARBUCKS_FOOD_CATEGORY_CODES = (
    "W0000013",
    "W0000032",
    "W0000033",
    "W0000054",
    "W0000055",
    "W0000056",
    "W0000064",
    "W0000554",
    "W0000126",
    "W0000074",
    "W0000347",
)
STARBUCKS_CATEGORY_CODES = STARBUCKS_DRINK_CATEGORY_CODES + STARBUCKS_FOOD_CATEGORY_CODES
NEW_PRODUCT_KEYWORDS = ("출시", "신메뉴", "신제품", "런칭", "론칭")
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
    "결과 발표",
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
        source_key="lotteeatz_launch_events",
        title="LOTTE EATZ 신제품 이벤트",
        brand="LOTTE EATZ",
        source_type="franchise",
        channel="이벤트",
        site_url="https://www.lotteeatz.com/event/main",
        crawl_url="https://www.lotteeatz.com/event/main",
    ),
    NewProductSourceDefinition(
        source_key="paikdabang_news",
        title="빽다방 신메뉴 소식",
        brand="빽다방",
        source_type="franchise",
        channel="소식",
        site_url="https://paikdabang.com/news/",
        crawl_url="https://paikdabang.com/news/",
    ),
    NewProductSourceDefinition(
        source_key="kfc_new_menu",
        title="KFC 신메뉴",
        brand="KFC",
        source_type="franchise",
        channel="신메뉴",
        site_url="https://www.kfckorea.com/promotion/newMenu",
        crawl_url="https://www.kfckorea.com/promotion/newMenu",
    ),
    NewProductSourceDefinition(
        source_key="mcdonalds_promotion",
        title="맥도날드 프로모션",
        brand="맥도날드",
        source_type="franchise",
        channel="프로모션",
        site_url="https://www.mcdonalds.co.kr/kor/promotion/list",
        crawl_url="https://www.mcdonalds.co.kr/kor/promotion/list",
    ),
    NewProductSourceDefinition(
        source_key="starbucks_menu",
        title="스타벅스 신규 메뉴",
        brand="스타벅스",
        source_type="franchise",
        channel="메뉴",
        site_url="https://www.starbucks.co.kr/menu/drink_list.do",
        crawl_url="https://www.starbucks.co.kr/menu/drink_list.do",
    ),
    NewProductSourceDefinition(
        source_key="mega_seasonal_menu",
        title="메가MGC 시즌 신메뉴",
        brand="메가MGC커피",
        source_type="franchise",
        channel="메인",
        site_url="https://www.mega-mgccoffee.com/",
        crawl_url="https://www.mega-mgccoffee.com/",
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


def _parse_dot_date_end(value: str | None) -> str | None:
    parsed = _parse_dot_date(value)
    if not parsed:
        return None

    date_value = datetime.fromisoformat(parsed)
    return date_value.replace(hour=23, minute=59, second=59).isoformat()


def _parse_dash_date(value: str | None) -> str | None:
    return _parse_datetime(value, ("%Y-%m-%d",))


def _parse_dash_date_end(value: str | None) -> str | None:
    parsed = _parse_dash_date(value)
    if not parsed:
        return None

    date_value = datetime.fromisoformat(parsed)
    return date_value.replace(hour=23, minute=59, second=59).isoformat()


def _parse_compact_date(value: str | None) -> str | None:
    return _parse_datetime(value, ("%Y%m%d",))


def _parse_compact_date_end(value: str | None) -> str | None:
    parsed = _parse_compact_date(value)
    if not parsed:
        return None

    date_value = datetime.fromisoformat(parsed)
    return date_value.replace(hour=23, minute=59, second=59).isoformat()


def _parse_month_day_range(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None

    match = re.search(
        r"(?P<start_month>\d{1,2})\s*/\s*(?P<start_day>\d{1,2})\s*~\s*"
        r"(?P<end_month>\d{1,2})\s*/\s*(?P<end_day>\d{1,2})",
        value,
    )
    if not match:
        return None, None

    now = datetime.now(timezone.utc)
    start_month = int(match.group("start_month"))
    start_day = int(match.group("start_day"))
    end_month = int(match.group("end_month"))
    end_day = int(match.group("end_day"))

    start_year = now.year
    if start_month - now.month > 6:
        start_year -= 1

    end_year = start_year
    if (end_month, end_day) < (start_month, start_day):
        end_year += 1

    start_at = datetime(
        start_year,
        start_month,
        start_day,
        tzinfo=timezone.utc,
    ).isoformat()
    end_at = datetime(
        end_year,
        end_month,
        end_day,
        23,
        59,
        59,
        tzinfo=timezone.utc,
    ).isoformat()
    return start_at, end_at


def _looks_like_food(name: str) -> bool:
    normalized = re.sub(r"\s+", "", name).lower()
    return not any(keyword in normalized for keyword in NON_FOOD_KEYWORDS)


def _has_new_product_keyword(text: str) -> bool:
    return any(keyword in text for keyword in NEW_PRODUCT_KEYWORDS)


def _normalize_brand_label(label: str) -> str:
    normalized = re.sub(r"\s+", " ", label).strip()
    normalized = re.sub(r"\s+(배달.*|픽업.*|매장.*)$", "", normalized).strip()
    return normalized


def _normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _is_recent_or_active(
    published_at: str | None,
    available_to: str | None = None,
) -> bool:
    if available_to and datetime.fromisoformat(available_to) >= datetime.now(timezone.utc):
        return True

    if not published_at:
        return True

    published_dt = datetime.fromisoformat(published_at)
    return (
        datetime.now(timezone.utc) - published_dt
    ).days <= settings.NEW_PRODUCTS_LOOKBACK_DAYS


def _build_absolute_url(base_url: str, maybe_relative_url: str | None) -> str | None:
    if not maybe_relative_url:
        return None
    return urljoin(base_url, maybe_relative_url)


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str:
    response = await client.get(url, headers=REQUEST_HEADERS)
    response.raise_for_status()
    return response.text


async def _fetch_soup(client: httpx.AsyncClient, url: str) -> BeautifulSoup:
    html = await _fetch_text(client, url)
    return BeautifulSoup(html, "html.parser")


def _extract_first_matching_image(
    soup: BeautifulSoup,
    *,
    base_url: str,
    markers: tuple[str, ...],
) -> str | None:
    for image in soup.find_all("img", src=True):
        src = image.get("src", "").strip()
        if not src:
            continue
        if markers and not any(marker in src for marker in markers):
            continue
        return _build_absolute_url(base_url, src)

    return None


def _extract_meta_image(soup: BeautifulSoup, *, base_url: str) -> str | None:
    meta_image = soup.select_one('meta[property="og:image"]')
    if not meta_image:
        return None

    image_url = meta_image.get("content", "").strip()
    return _build_absolute_url(base_url, image_url)


def _extract_kfc_summary(soup: BeautifulSoup) -> str | None:
    text = soup.get_text("\n", strip=True)
    launch_menu_match = re.search(r"\*출시 메뉴:\s*([^\n*]+)", text)
    if launch_menu_match:
        return f"출시 메뉴: {launch_menu_match.group(1).strip()}"

    launch_channel_match = re.search(r"\*출시 채널:\s*([^\n*]+)", text)
    if launch_channel_match:
        return f"출시 채널: {launch_channel_match.group(1).strip()}"

    return None


def _extract_text_lines_from_html(content_html: str | None) -> list[str]:
    if not content_html:
        return []

    soup = BeautifulSoup(content_html, "html.parser")
    text = soup.get_text("\n", strip=True)
    return [
        normalized
        for line in text.splitlines()
        if (normalized := _normalize_text(line))
    ]


def _extract_mcdonalds_summary(content_html: str | None) -> str | None:
    new_product_lines: list[str] = []
    for line in _extract_text_lines_from_html(content_html):
        if "신제품" not in line:
            continue

        summary_line = _normalize_text(line.replace("신제품", ""))
        if not summary_line:
            continue
        if summary_line in new_product_lines:
            continue
        new_product_lines.append(summary_line)

    if new_product_lines:
        return f"출시 메뉴: {' · '.join(new_product_lines[:3])}"

    return None


def _resolve_nuxt_reference(
    value: Any,
    root: list[Any],
    cache: dict[int, Any],
    stack: set[int] | None = None,
) -> Any:
    if isinstance(value, bool) or value is None:
        return value

    if stack is None:
        stack = set()

    if isinstance(value, int) and 0 <= value < len(root):
        if value in cache:
            return cache[value]
        if value in stack:
            return root[value]

        stack.add(value)
        resolved = _resolve_nuxt_reference(root[value], root, cache, stack)
        stack.remove(value)
        cache[value] = resolved
        return resolved

    if isinstance(value, list):
        return [_resolve_nuxt_reference(item, root, cache, stack) for item in value]

    if isinstance(value, dict):
        return {
            key: _resolve_nuxt_reference(item, root, cache, stack)
            for key, item in value.items()
        }

    return value


def _extract_mcdonalds_promotions(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    payload_element = soup.select_one("#__NUXT_DATA__")
    if not payload_element:
        return []

    payload = json.loads(payload_element.get_text())
    if not isinstance(payload, list) or len(payload) < 4:
        return []

    promotion_ref = payload[3].get("promotionData") if isinstance(payload[3], dict) else None
    if promotion_ref is None:
        return []

    resolved = _resolve_nuxt_reference(promotion_ref, payload, cache={})
    result_object = resolved.get("resultObject") if isinstance(resolved, dict) else None
    items = result_object.get("list") if isinstance(result_object, dict) else None
    return items if isinstance(items, list) else []


def _parse_mega_uploaded_at(image_url: str | None) -> str | None:
    if not image_url:
        return None

    match = re.search(r"/(\d{8})\d{6}_", image_url)
    if not match:
        return None

    return _parse_compact_date(match.group(1))


def _open_ended_datetime() -> str:
    return datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc).isoformat()


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

            image_url = _build_absolute_url(
                source.site_url,
                image_element.get("src") if image_element else None,
            )
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


def _parse_lotteeatz_period(period_text: str) -> tuple[str | None, str | None]:
    parts = [part.strip() for part in period_text.split("~", 1)]
    if len(parts) != 2:
        return None, None

    start_at = _parse_dot_date(parts[0])
    end_at = _parse_dot_date_end(parts[1])
    if parts[1].startswith(("2999", "9999")):
        end_at = None

    return start_at, end_at


async def _crawl_lotteeatz_launch_events(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    soup = await _fetch_soup(client, source.crawl_url)
    products: list[ParsedNewProduct] = []

    for item in soup.select("li.grid-item")[:LOTTEEATZ_MAX_ITEMS]:
        title_element = item.select_one(".grid-title")
        period_element = item.select_one(".grid-period")
        link_element = item.select_one('a[href*="/event/main/selectEvent/"]')
        image_element = item.select_one("img")
        badge_element = item.select_one('[class*="badge"]')

        title = title_element.get_text(" ", strip=True) if title_element else ""
        if not title or not _has_new_product_keyword(title):
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
        if not _is_recent_or_active(available_from, available_to):
            continue

        products.append(
            ParsedNewProduct(
                external_id=external_id,
                name=title,
                brand=brand or source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category="신제품 이벤트",
                summary=f"{brand or source.brand} 공식 신제품 공지",
                image_url=_build_absolute_url(
                    source.site_url,
                    image_element.get("src") if image_element else None,
                ),
                product_url=_build_absolute_url(source.site_url, href) or source.site_url,
                published_at=available_from,
                available_from=available_from,
                available_to=available_to,
                is_limited=available_to is not None,
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


async def _crawl_paikdabang_news(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    soup = await _fetch_soup(client, source.crawl_url)
    products: list[ParsedNewProduct] = []

    for row in soup.select(".board_wrap table tbody tr")[:PAIKDABANG_MAX_ITEMS]:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        category_text = cells[1].get_text(" ", strip=True)
        title_link = cells[2].find("a", href=True)
        title = title_link.get_text(" ", strip=True) if title_link else ""
        published_at = _parse_dash_date(cells[3].get_text(" ", strip=True))
        if category_text != "소식":
            continue
        if not title or not _has_new_product_keyword(title):
            continue
        if not _looks_like_food(title):
            continue
        if not _is_recent_or_active(published_at):
            continue

        detail_url = _build_absolute_url(source.site_url, title_link.get("href")) if title_link else None
        detail_soup = await _fetch_soup(client, detail_url) if detail_url else None
        image_url = (
            _extract_first_matching_image(
                detail_soup,
                base_url=detail_url or source.site_url,
                markers=("/wp-content/uploads/",),
            )
            if detail_soup
            else None
        )
        external_id = (
            (detail_url or "").rstrip("/").rsplit("/", 1)[-1]
            or f"paikdabang::{title}"
        )

        products.append(
            ParsedNewProduct(
                external_id=external_id,
                name=title,
                brand=source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category="신메뉴 소식",
                summary=f"{source.brand} 공식 소식",
                image_url=image_url,
                product_url=detail_url or source.site_url,
                published_at=published_at,
                available_from=published_at,
                available_to=None,
                is_limited=False,
                is_food=True,
                raw_payload={
                    "row_category": category_text,
                    "listed_at": cells[3].get_text(" ", strip=True),
                },
            )
        )

    return products


async def _crawl_kfc_new_menu(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    soup = await _fetch_soup(client, source.crawl_url)
    products: list[ParsedNewProduct] = []

    for item in soup.select('.list li a[href*="/promotion/newMenu/detail/"]')[:KFC_MAX_ITEMS]:
        title_element = item.select_one(".title")
        date_element = item.select_one(".date")

        title = title_element.get_text(" ", strip=True) if title_element else ""
        period_text = date_element.get_text(" ", strip=True) if date_element else ""
        if not title or not _has_new_product_keyword(title):
            continue
        if not _looks_like_food(title):
            continue

        available_from, available_to = _parse_month_day_range(period_text)
        if not _is_recent_or_active(available_from, available_to):
            continue

        detail_url = _build_absolute_url(source.site_url, item.get("href")) or source.site_url
        detail_soup = await _fetch_soup(client, detail_url)
        image_url = _extract_meta_image(detail_soup, base_url=detail_url) or _extract_first_matching_image(
            detail_soup,
            base_url=detail_url,
            markers=("/nas/event/",),
        )
        summary = _extract_kfc_summary(detail_soup) or f"{source.brand} 공식 신메뉴"
        external_id = detail_url.rstrip("/").rsplit("/", 1)[-1] or title

        products.append(
            ParsedNewProduct(
                external_id=external_id,
                name=title,
                brand=source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category="신메뉴",
                summary=summary,
                image_url=image_url,
                product_url=detail_url,
                published_at=available_from,
                available_from=available_from,
                available_to=available_to,
                is_limited=available_to is not None,
                is_food=True,
                raw_payload={
                    "listed_period": period_text,
                },
            )
        )

    return products


async def _crawl_mcdonalds_promotion(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    html = await _fetch_text(client, source.crawl_url)
    products: list[ParsedNewProduct] = []

    for item in _extract_mcdonalds_promotions(html)[:MCDONALDS_MAX_ITEMS]:
        title = BeautifulSoup(str(item.get("title") or ""), "html.parser").get_text(
            " ",
            strip=True,
        )
        content_html = str(item.get("pcKorContent") or "")
        content_text = _normalize_text(
            BeautifulSoup(content_html, "html.parser").get_text(" ", strip=True)
        )
        code = _normalize_text(str(item.get("code") or ""))
        detail_url = (
            f"https://www.mcdonalds.co.kr/kor/promotion/detail/{code}"
            if code
            else source.site_url
        )
        image_url = _build_absolute_url(source.site_url, str(item.get("pcKorImageUrl") or ""))
        extracted_summary = _extract_mcdonalds_summary(content_html)
        combined_text = f"{title} {extracted_summary or ''} {content_text}".strip()
        if not title or not _looks_like_food(f"{title} {extracted_summary or ''}"):
            continue
        if "NEW" not in combined_text.upper() and not _has_new_product_keyword(combined_text):
            continue

        published_at = _parse_dash_date(
            str(item.get("promotionStartDay") or item.get("regDate") or "")
        )
        end_day = str(item.get("promotionEndDay") or "").strip()
        is_open_ended = end_day.startswith("9999")
        available_to = _open_ended_datetime() if is_open_ended else _parse_dash_date_end(end_day)
        if not _is_recent_or_active(published_at, available_to):
            continue
        summary = extracted_summary or f"{source.brand} 공식 신제품 프로모션"

        products.append(
            ParsedNewProduct(
                external_id=code or str(item.get("seq") or title),
                name=title,
                brand=source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category="프로모션",
                summary=summary,
                image_url=image_url,
                product_url=detail_url,
                published_at=published_at,
                available_from=published_at,
                available_to=available_to,
                is_limited=available_to is not None and not is_open_ended,
                is_food=True,
                raw_payload={
                    "seq": item.get("seq"),
                    "reg_date": item.get("regDate"),
                    "promotion_end_day": end_day or None,
                },
            )
        )

    return products


async def _crawl_starbucks_menu(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    products_by_id: dict[str, ParsedNewProduct] = {}

    for category_code in STARBUCKS_CATEGORY_CODES:
        response = await client.post(
            f"https://www.starbucks.co.kr/upload/json/menu/{category_code}.js",
            data={
                "CATE_CD": category_code,
                "SOLD_OUT": "1",
            },
            headers={
                **REQUEST_HEADERS,
                "Referer": source.crawl_url,
            },
        )
        response.raise_for_status()
        items = response.json().get("list") or []

        for item in items:
            external_id = _normalize_text(str(item.get("product_CD") or ""))
            name = _normalize_text(str(item.get("product_NM") or ""))
            if not external_id or not name:
                continue
            if not _looks_like_food(name):
                continue

            published_at = _parse_compact_date(str(item.get("new_SDATE") or ""))
            available_to = _parse_compact_date_end(str(item.get("new_EDATE") or ""))
            if item.get("newicon") != "Y" and not published_at:
                continue
            if not _is_recent_or_active(published_at, available_to):
                continue

            category = _normalize_text(
                str(item.get("cate_NAME") or item.get("sell_CAT") or "신규 메뉴")
            ) or "신규 메뉴"
            summary = _normalize_text(str(item.get("content") or ""))
            listing_url = (
                "https://www.starbucks.co.kr/menu/food_list.do"
                if category_code in STARBUCKS_FOOD_CATEGORY_CODES
                else source.crawl_url
            )

            parsed_product = ParsedNewProduct(
                external_id=external_id,
                name=name,
                brand=source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category=category,
                summary=summary or f"{category} · {source.brand} 신규 메뉴",
                image_url=_build_absolute_url(
                    source.site_url,
                    str(item.get("file_PATH") or ""),
                ),
                product_url=listing_url,
                published_at=published_at,
                available_from=published_at,
                available_to=available_to,
                is_limited=available_to is not None,
                is_food=True,
                raw_payload={
                    "category_code": category_code,
                    "newicon": item.get("newicon"),
                    "new_sdate": item.get("new_SDATE"),
                    "new_edate": item.get("new_EDATE"),
                },
            )

            existing = products_by_id.get(external_id)
            if not existing:
                products_by_id[external_id] = parsed_product
                continue

            existing_published_at = existing.published_at or ""
            current_published_at = parsed_product.published_at or ""
            if current_published_at > existing_published_at:
                products_by_id[external_id] = parsed_product

    return list(products_by_id.values())


async def _crawl_mega_seasonal_menu(
    client: httpx.AsyncClient,
    source: NewProductSourceDefinition,
) -> list[ParsedNewProduct]:
    soup = await _fetch_soup(client, source.crawl_url)
    season_title_element = next(
        (
            element
            for element in soup.select(".cont_title_info")
            if "신메뉴" in element.get_text(" ", strip=True)
        ),
        None,
    )
    if not season_title_element:
        return []

    season_header_item = season_title_element.find_parent("li")
    products_item = season_header_item.find_next_sibling("li") if season_header_item else None
    if not season_header_item or not products_item:
        return []

    season_label = _normalize_text(season_title_element.get_text(" ", strip=True))
    campaign_title = _normalize_text(
        season_header_item.select_one(".cont_title_bg").get_text(" ", strip=True)
        if season_header_item.select_one(".cont_title_bg")
        else ""
    )
    campaign_intro = _normalize_text(
        season_header_item.select_one(".cont_text_title b").get_text(" ", strip=True)
        if season_header_item.select_one(".cont_text_title b")
        else ""
    )

    products: list[ParsedNewProduct] = []
    for slide in products_item.select(".swiper-slide")[:MEGA_MAX_ITEMS]:
        name_element = slide.select_one(".cont_text_title b")
        summary_element = slide.select_one(".text2")
        image_element = slide.select_one("img")

        name = _normalize_text(name_element.get_text(" ", strip=True) if name_element else "")
        if not name or not _looks_like_food(name):
            continue

        image_url = _build_absolute_url(
            source.site_url,
            image_element.get("src") if image_element else None,
        )
        inferred_uploaded_at = _parse_mega_uploaded_at(image_url)
        external_id = (
            (image_url or "").rstrip("/").rsplit("/", 1)[-1].split("?", 1)[0]
            or f"mega::{name}"
        )

        products.append(
            ParsedNewProduct(
                external_id=external_id,
                name=name,
                brand=source.brand,
                source_type=source.source_type,
                channel=source.channel,
                category="시즌 신메뉴",
                summary=_normalize_text(
                    summary_element.get_text(" ", strip=True) if summary_element else ""
                )
                or f"{season_label} · {campaign_title or source.brand}",
                image_url=image_url,
                product_url="https://www.mega-mgccoffee.com/menu/",
                published_at=None,
                available_from=None,
                available_to=None,
                is_limited=True,
                is_food=True,
                raw_payload={
                    "season_label": season_label,
                    "campaign_title": campaign_title or None,
                    "campaign_intro": campaign_intro or None,
                    "inferred_uploaded_at": inferred_uploaded_at,
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
    if source.source_key == "lotteeatz_launch_events":
        return await _crawl_lotteeatz_launch_events(client, source)
    if source.source_key == "paikdabang_news":
        return await _crawl_paikdabang_news(client, source)
    if source.source_key == "kfc_new_menu":
        return await _crawl_kfc_new_menu(client, source)
    if source.source_key == "mcdonalds_promotion":
        return await _crawl_mcdonalds_promotion(client, source)
    if source.source_key == "starbucks_menu":
        return await _crawl_starbucks_menu(client, source)
    if source.source_key == "mega_seasonal_menu":
        return await _crawl_mega_seasonal_menu(client, source)
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


def _deactivate_retired_sources(active_source_keys: set[str], timestamp: str) -> None:
    for source_row in list_new_product_sources():
        source_key = str(source_row.get("source_key") or "").strip()
        source_id = str(source_row.get("id") or "").strip()
        if not source_key or not source_id:
            continue
        if source_key in active_source_keys:
            continue

        expire_new_products_by_source_id(source_id)
        update_new_product_source(
            source_id,
            {
                "is_active": False,
                "last_crawled_at": timestamp,
            },
        )


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

    active_source_keys = {source.source_key for source in SOURCE_DEFINITIONS}
    _deactivate_retired_sources(active_source_keys, started_at)

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
                current_external_ids = {product.external_id for product in parsed_products}
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
                        "status": (
                            "hidden"
                            if existing_lookup.get(product.external_id, {}).get("status") == "hidden"
                            else "visible"
                        ),
                        "raw_payload": product.raw_payload,
                    }
                    for product in parsed_products
                    if product.is_food
                ]

                expired_product_ids = [
                    str(row.get("id"))
                    for row in existing_rows
                    if row.get("id")
                    and row.get("status") == "visible"
                    and str(row.get("external_id") or "") not in current_external_ids
                ]

                inserted_count = sum(
                    1 for payload in payloads if payload["external_id"] not in existing_ids
                )
                updated_count = max(len(payloads) - inserted_count, 0)
                upsert_new_products(payloads)
                expire_new_products(expired_product_ids)

                finished_at = _utc_now_iso()
                update_new_product_source(
                    source_id,
                    {
                        "is_active": True,
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
                                "expired": len(expired_product_ids),
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
                    "expired": len(expired_product_ids),
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
