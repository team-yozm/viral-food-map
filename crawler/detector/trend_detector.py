import logging
import uuid
from datetime import datetime, timedelta, timezone

from ai_reviewer import (
    AIReviewError,
    TrendReviewPayload,
    TrendReviewResult,
    review_trend_candidate,
)
from config import settings
from crawlers.image_finder import find_food_image
from crawlers.instagram import get_hashtag_post_count
from crawlers.naver_datalab import calculate_acceleration, get_search_trend_insights
from crawlers.naver_search import get_blog_mention_count, search_blog_mentions
from crawlers.store_finder import find_stores_nationwide
from database import (
    get_all_keywords,
    get_active_trends,
    get_trends_by_names,
    insert_stores,
    update_trend_status,
    upsert_trend,
)
from detector.keyword_manager import (
    get_all_seed_keywords,
    is_food_specific_keyword,
)
from detector.store_updater import build_store_records

logger = logging.getLogger(__name__)

DEFAULT_CATEGORY = "기타"


def score_acceleration(acceleration: float) -> float:
    if acceleration >= settings.TREND_RISING_ACCELERATION_THRESHOLD:
        return 20
    if acceleration >= 50:
        return 15
    if acceleration >= settings.TREND_THRESHOLD:
        return 10
    return 0


def score_popularity(popularity: float) -> float:
    if popularity >= 140:
        return 25
    if popularity >= 100:
        return 20
    if popularity >= 70:
        return 15
    if popularity >= 40:
        return 10
    if popularity >= 20:
        return 5
    return 0


def score_rank(rank: int | None) -> float:
    if rank is None:
        return 0
    if rank <= 3:
        return 35
    if rank <= 5:
        return 30
    if rank <= 10:
        return 20
    if rank <= 20:
        return 10
    return 0


def classify_status(score: float, acceleration: float) -> str:
    if (
        acceleration >= settings.TREND_THRESHOLD
        and score >= settings.TREND_RISING_SCORE_THRESHOLD
    ):
        return "rising"
    if acceleration >= settings.TREND_RISING_ACCELERATION_THRESHOLD:
        return "rising"
    return "active"


def _build_search_volume_map(data_points: list[dict]) -> dict[str, float]:
    return {
        point.get("period", ""): point.get("ratio", 0)
        for point in data_points
        if point.get("period")
    }


def _choose_category(
    keyword: str,
    keyword_metadata_by_name: dict[str, dict],
    existing_trend: dict | None,
) -> str:
    if keyword in keyword_metadata_by_name:
        return keyword_metadata_by_name[keyword].get("category") or DEFAULT_CATEGORY
    if existing_trend:
        return existing_trend.get("category") or DEFAULT_CATEGORY
    return DEFAULT_CATEGORY


def _build_keyword_metadata_by_name(db_keywords: list[dict]) -> dict[str, dict]:
    keyword_metadata_by_name = {
        item["keyword"]: item
        for item in get_all_seed_keywords()
        if item.get("keyword")
    }

    for item in db_keywords:
        keyword = item.get("keyword")
        if not keyword:
            continue
        merged = dict(keyword_metadata_by_name.get(keyword, {}))
        merged.update(item)
        keyword_metadata_by_name[keyword] = merged

    return keyword_metadata_by_name


def _parse_detected_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _deactivate_stale_trends(confirmed_keywords: list[str]) -> list[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(
        hours=settings.ACTIVE_TREND_TTL_HOURS
    )
    confirmed_keyword_set = set(confirmed_keywords)
    deactivated_trends: list[str] = []

    for trend in get_active_trends() or []:
        trend_id = trend.get("id")
        keyword = trend.get("name")
        if not trend_id or not keyword or keyword in confirmed_keyword_set:
            continue

        detected_at = _parse_detected_at(trend.get("detected_at"))
        if detected_at and detected_at > cutoff:
            continue

        update_trend_status(trend_id, "inactive")
        deactivated_trends.append(keyword)
        logger.info("비활성 처리: %s", keyword)

    return deactivated_trends


def _build_ai_detail_line(
    keyword: str,
    *,
    confidence: float | None,
    category: str,
    reason: str,
) -> str:
    confidence_text = f"{confidence:.2f}" if confidence is not None else "n/a"
    normalized_reason = " ".join(str(reason or "").split()) or "사유 없음"
    return (
        f"{keyword} (confidence={confidence_text}, category={category}): "
        f"{normalized_reason[:160]}"
    )


def _is_ai_accept(review: TrendReviewResult) -> bool:
    return (
        review.verdict == "accept"
        and review.confidence >= settings.AI_REVIEW_MIN_CONFIDENCE
    )


async def _review_candidate_with_ai(
    candidate: dict,
    *,
    category_hint: str,
) -> tuple[TrendReviewResult, str, str]:
    keyword = candidate["keyword"]
    review = await review_trend_candidate(
        TrendReviewPayload(
            keyword=keyword,
            acceleration=candidate["acceleration"],
            search_volume_data=_build_search_volume_map(candidate["data_points"]),
            blog_count=candidate["blog_count"],
            ig_count=candidate["ig_count"],
            category_hint=category_hint,
            evidence_snippets=await search_blog_mentions(
                keyword,
                display=settings.AI_REVIEW_MAX_EVIDENCE_SNIPPETS,
            ),
        )
    )

    resolved_keyword = review.canonical_keyword or keyword
    resolved_category = (
        review.category
        if review.category != DEFAULT_CATEGORY or category_hint == DEFAULT_CATEGORY
        else category_hint
    )
    return review, resolved_keyword, resolved_category


async def detect_trends() -> dict:
    logger.info("=== 트렌드 감지 시작 ===")

    db_keywords = get_all_keywords() or []
    keyword_metadata_by_name = _build_keyword_metadata_by_name(db_keywords)
    db_keyword_count = len(
        [item for item in db_keywords if item.get("keyword")]
    )
    keywords = list(keyword_metadata_by_name)

    summary = {
        "keywords": len(keywords),
        "db_keywords": db_keyword_count,
        "seed_keywords": len(get_all_seed_keywords()),
        "candidates": 0,
        "rank_candidates": 0,
        "confirmed": 0,
        "stored_trends": 0,
        "stored_stores": 0,
        "confirmed_keywords": [],
        "deactivated_trends": [],
        "ai_reviewed": 0,
        "ai_accepted": 0,
        "ai_rejected_details": [],
        "ai_review_details": [],
        "ai_fallback_details": [],
    }

    logger.info("모니터링 키워드 %s개", len(keywords))

    trend_insights = await get_search_trend_insights(keywords)
    search_data = trend_insights["series"]
    popularity_scores = trend_insights["popularity_scores"]
    popularity_ranks = trend_insights["popularity_ranks"]

    candidates = []
    for keyword, data_points in search_data.items():
        acceleration = calculate_acceleration(data_points)
        popularity = float(popularity_scores.get(keyword, 0.0))
        rank = popularity_ranks.get(keyword)
        is_rank_candidate = (
            rank is not None and rank <= settings.TREND_TOP_RANK_CANDIDATE_MAX
        )
        if acceleration >= settings.TREND_THRESHOLD or is_rank_candidate:
            candidates.append({
                "keyword": keyword,
                "acceleration": acceleration,
                "data_points": data_points,
                "popularity": popularity,
                "rank": rank,
            })
            if is_rank_candidate:
                summary["rank_candidates"] += 1
            logger.info(
                "후보 감지: %s (가속도 %.1f%%, 인기도 %.2f, 순위 %s)",
                keyword,
                acceleration,
                popularity,
                rank or "-",
            )

    summary["candidates"] = len(candidates)

    if not candidates:
        summary["deactivated_trends"] = _deactivate_stale_trends([])
        logger.info("급등 키워드 없음")
        return summary

    candidate_existing_trends = {
        trend["name"]: trend
        for trend in get_trends_by_names([candidate["keyword"] for candidate in candidates])
        if trend.get("name")
    }

    confirmed_by_name: dict[str, dict] = {}
    for candidate in candidates:
        keyword = candidate["keyword"]
        existing_trend = candidate_existing_trends.get(keyword)
        category_hint = _choose_category(
            keyword,
            keyword_metadata_by_name,
            existing_trend,
        )

        if not is_food_specific_keyword(keyword):
            logger.info("범용 키워드 스킵: %s", keyword)
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

        score += score_rank(candidate.get("rank"))
        score += score_popularity(candidate.get("popularity", 0.0))
        score += score_acceleration(candidate["acceleration"])

        candidate["score"] = score
        candidate["blog_count"] = blog_count
        candidate["ig_count"] = ig_count

        if score < settings.TREND_SCORE_THRESHOLD:
            logger.info("점수 미달 후보: %s (점수 %.1f)", keyword, score)
            continue

        resolved_keyword = keyword
        resolved_category = category_hint
        ai_reason = ""

        if settings.AI_REVIEW_ENABLED:
            try:
                review, resolved_keyword, resolved_category = (
                    await _review_candidate_with_ai(candidate, category_hint=category_hint)
                )
                summary["ai_reviewed"] += 1
                ai_reason = review.reason

                if not _is_ai_accept(review):
                    target_key = (
                        "ai_rejected_details"
                        if review.verdict == "reject"
                        else "ai_review_details"
                    )
                    summary[target_key].append(
                        _build_ai_detail_line(
                            keyword,
                            confidence=review.confidence,
                            category=resolved_category,
                            reason=ai_reason,
                        )
                    )
                    logger.info("AI 트렌드 차단 '%s': %s", keyword, ai_reason)
                    continue

                summary["ai_accepted"] += 1
                logger.info(
                    "AI 트렌드 승인 '%s' → '%s' (%s)",
                    keyword,
                    resolved_keyword,
                    ai_reason or "사유 없음",
                )
            except AIReviewError as exc:
                summary["ai_fallback_details"].append(
                    _build_ai_detail_line(
                        keyword,
                        confidence=None,
                        category=category_hint,
                        reason=str(exc),
                    )
                )
                logger.warning(
                    "AI 심사 실패 '%s', 규칙 기반 적용: %s",
                    keyword,
                    exc,
                )

        candidate["keyword"] = resolved_keyword
        candidate["category"] = resolved_category
        candidate["ai_reason"] = ai_reason

        existing_confirmed = confirmed_by_name.get(resolved_keyword)
        if not existing_confirmed or candidate["score"] > existing_confirmed["score"]:
            confirmed_by_name[resolved_keyword] = candidate

    confirmed = list(confirmed_by_name.values())
    summary["confirmed"] = len(confirmed)
    summary["confirmed_keywords"] = [trend["keyword"] for trend in confirmed]
    summary["deactivated_trends"] = _deactivate_stale_trends(
        summary["confirmed_keywords"]
    )

    existing_trends = {
        trend["name"]: trend
        for trend in get_trends_by_names(summary["confirmed_keywords"])
        if trend.get("name")
    }

    for trend in confirmed:
        keyword = trend["keyword"]
        existing_trend = existing_trends.get(keyword)
        category = trend.get("category") or _choose_category(
            keyword,
            keyword_metadata_by_name,
            existing_trend,
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
            "search_volume_data": _build_search_volume_map(trend["data_points"]),
            "description": existing_trend.get("description") if existing_trend else None,
            "image_url": existing_trend.get("image_url") if existing_trend else None,
        }

        if not trend_data["image_url"]:
            image_url = await find_food_image(keyword, category=category)
            if image_url:
                trend_data["image_url"] = image_url
                logger.info("'%s' 대체 이미지 수집", keyword)

        upsert_trend(trend_data)
        summary["stored_trends"] += 1

        stores = await find_stores_nationwide(keyword)
        if stores:
            store_records = build_store_records(trend_id, stores)
            insert_stores(store_records)
            summary["stored_stores"] += len(store_records)
            logger.info("'%s' 판매처 %s건 저장", keyword, len(store_records))

    logger.info("=== 트렌드 감지 완료: %s건 확정 ===", len(confirmed))
    return summary
