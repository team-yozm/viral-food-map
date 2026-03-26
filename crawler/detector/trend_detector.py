import logging
import uuid
from datetime import datetime

from config import settings
from crawlers.image_finder import find_food_image
from crawlers.instagram import get_hashtag_post_count
from crawlers.naver_datalab import calculate_acceleration, get_search_trend
from crawlers.naver_search import get_blog_mention_count
from crawlers.store_finder import find_stores_nationwide
from database import (
    get_all_keywords,
    get_trends_by_names,
    insert_stores,
    upsert_trend,
)
from detector.keyword_manager import get_flat_keywords, is_food_specific_keyword
from detector.store_updater import build_store_records

logger = logging.getLogger(__name__)


def score_acceleration(acceleration: float) -> float:
    if acceleration >= settings.TREND_RISING_ACCELERATION_THRESHOLD:
        return 20
    if acceleration >= 50:
        return 15
    if acceleration >= settings.TREND_THRESHOLD:
        return 10
    return 0


def classify_status(score: float, acceleration: float) -> str:
    if (
        score >= settings.TREND_RISING_SCORE_THRESHOLD
        or acceleration >= settings.TREND_RISING_ACCELERATION_THRESHOLD
    ):
        return "rising"
    return "active"


async def detect_trends() -> dict:
    """메인 트렌드 탐지 로직"""
    logger.info("=== 트렌드 탐지 시작 ===")

    db_keywords = get_all_keywords()
    if db_keywords:
        keywords = [kw["keyword"] for kw in db_keywords]
    else:
        keywords = get_flat_keywords()

    summary = {
        "keywords": len(keywords),
        "candidates": 0,
        "confirmed": 0,
        "stored_trends": 0,
        "stored_stores": 0,
        "confirmed_keywords": [],
    }

    logger.info(f"모니터링 키워드 {len(keywords)}개")

    search_data = await get_search_trend(keywords)

    candidates = []
    for keyword, data_points in search_data.items():
        acceleration = calculate_acceleration(data_points)
        if acceleration >= settings.TREND_THRESHOLD:
            candidates.append({
                "keyword": keyword,
                "acceleration": acceleration,
                "data_points": data_points,
            })
            logger.info(f"후보 발견: {keyword} (증가율 {acceleration:.1f}%)")

    summary["candidates"] = len(candidates)

    if not candidates:
        logger.info("급등 키워드 없음")
        return summary

    confirmed = []
    for candidate in candidates:
        keyword = candidate["keyword"]
        if not is_food_specific_keyword(keyword):
            logger.info(f"일반어 제외: {keyword}")
            continue

        score = 0.0

        blog_count = await get_blog_mention_count(keyword)
        if blog_count > 1000:
            score += 30
        elif blog_count > 100:
            score += 15

        ig_count = await get_hashtag_post_count(keyword)
        if ig_count is not None:
            if ig_count > 10000:
                score += 30
            elif ig_count > 1000:
                score += 15

        acceleration = candidate["acceleration"]
        score += score_acceleration(acceleration)

        candidate["score"] = score
        candidate["blog_count"] = blog_count
        candidate["ig_count"] = ig_count

        if score >= settings.TREND_SCORE_THRESHOLD:
            confirmed.append(candidate)
            logger.info(f"트렌드 확정: {keyword} (점수 {score})")
        else:
            logger.info(f"트렌드 미달: {keyword} (점수 {score})")

    summary["confirmed"] = len(confirmed)
    summary["confirmed_keywords"] = [trend["keyword"] for trend in confirmed]

    existing_trends = {
        trend["name"]: trend
        for trend in get_trends_by_names(summary["confirmed_keywords"])
        if trend.get("name")
    }

    for trend in confirmed:
        keyword = trend["keyword"]
        existing_trend = existing_trends.get(keyword)

        db_keyword = next(
            (item for item in (db_keywords or []) if item["keyword"] == keyword),
            None,
        )
        category = (
            db_keyword["category"]
            if db_keyword
            else existing_trend.get("category") if existing_trend else "기타"
        )
        trend_id = existing_trend["id"] if existing_trend else str(uuid.uuid4())
        status = classify_status(trend["score"], trend["acceleration"])

        trend_data = {
            "id": trend_id,
            "name": keyword,
            "category": category,
            "status": status,
            "detected_at": datetime.now().isoformat(),
            "peak_score": trend["score"],
            "search_volume_data": {
                point.get("period", ""): point.get("ratio", 0)
                for point in trend.get("data_points", [])
            },
            "description": existing_trend.get("description") if existing_trend else None,
            "image_url": existing_trend.get("image_url") if existing_trend else None,
        }

        if not trend_data["image_url"]:
            image_url = await find_food_image(keyword, category=category)
            if image_url:
                trend_data["image_url"] = image_url
                logger.info(f"'{keyword}' 대표 이미지 수집 완료")

        upsert_trend(trend_data)
        summary["stored_trends"] += 1

        stores = await find_stores_nationwide(keyword)
        if stores:
            store_records = build_store_records(trend_id, stores)
            insert_stores(store_records)
            summary["stored_stores"] += len(store_records)
            logger.info(f"'{keyword}' 판매처 {len(store_records)}개 등록")

    logger.info(f"=== 트렌드 탐지 완료: {len(confirmed)}개 확정 ===")
    return summary
