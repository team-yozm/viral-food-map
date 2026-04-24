import httpx
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from config import settings
import logging

_KST = ZoneInfo("Asia/Seoul")

logger = logging.getLogger(__name__)

NAVER_DATALAB_URL = "https://openapi.naver.com/v1/datalab/search"
API_MAX_KEYWORD_GROUPS = 5


async def get_search_trend(keywords: list[str], days: int = 14) -> dict[str, list[dict]]:
    """네이버 데이터랩에서 키워드별 검색량 추이 조회"""
    return (await get_search_trend_insights(keywords, days=days))["series"]


def _recent_average(data_points: list[dict], days: int = 3) -> float:
    if not data_points:
        return 0.0
    recent_points = data_points[-days:]
    if not recent_points:
        return 0.0
    return sum(point.get("ratio", 0) for point in recent_points) / len(recent_points)


def _build_batches(
    keywords: list[str],
    reference_keyword: str,
) -> list[list[str]]:
    normalized_keywords: list[str] = []
    seen_keywords: set[str] = set()
    for keyword in keywords:
        cleaned = str(keyword or "").strip()
        if not cleaned or cleaned in seen_keywords:
            continue
        normalized_keywords.append(cleaned)
        seen_keywords.add(cleaned)

    batch_size = API_MAX_KEYWORD_GROUPS - 1
    batches: list[list[str]] = []
    for index in range(0, len(normalized_keywords), batch_size):
        batch = normalized_keywords[index : index + batch_size]
        if reference_keyword not in batch:
            batch = batch + [reference_keyword]
        batches.append(batch)

    if not batches:
        batches.append([reference_keyword])

    return batches


def _calculate_relative_popularity(
    keyword_points: list[dict],
    reference_points: list[dict],
) -> float:
    if not keyword_points:
        return 0.0

    keyword_by_period = {
        point.get("period"): float(point.get("ratio", 0))
        for point in keyword_points
        if point.get("period")
    }
    reference_by_period = {
        point.get("period"): float(point.get("ratio", 0))
        for point in reference_points
        if point.get("period")
    }

    shared_periods = [
        period
        for period in keyword_by_period
        if period in reference_by_period and reference_by_period[period] > 0
    ]
    if not shared_periods:
        return 0.0

    shared_periods = shared_periods[-3:]
    relative_values = [
        (keyword_by_period[period] / reference_by_period[period]) * 100
        for period in shared_periods
    ]
    return round(sum(relative_values) / len(relative_values), 2)


async def get_search_trend_insights(
    keywords: list[str],
    days: int = 7,
) -> dict[str, dict[str, list[dict]] | dict[str, float] | dict[str, int]]:
    """네이버 데이터랩 검색 추이와 배치 간 비교용 상대 인기도를 함께 반환"""
    now = datetime.now(_KST)
    end_date = now.strftime("%Y-%m-%d")
    start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    reference_keyword = settings.TREND_REFERENCE_KEYWORD.strip() or "마라탕"

    headers = {
        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
        "Content-Type": "application/json",
    }

    results: dict[str, list[dict]] = {}
    popularity_scores: dict[str, float] = {}

    async with httpx.AsyncClient(timeout=10) as client:
        for batch in _build_batches(keywords, reference_keyword):
            keyword_groups = [
                {"groupName": kw, "keywords": [kw]} for kw in batch
            ]

            body = {
                "startDate": start_date,
                "endDate": end_date,
                "timeUnit": "date",
                "keywordGroups": keyword_groups,
            }

            try:
                resp = await client.post(
                    NAVER_DATALAB_URL, headers=headers, json=body
                )
                resp.raise_for_status()
                data = resp.json()
                batch_results = {
                    result["title"]: result.get("data", [])
                    for result in data.get("results", [])
                    if result.get("title")
                }
                reference_points = batch_results.get(reference_keyword, [])

                for name, points in batch_results.items():
                    if name == reference_keyword and name not in keywords:
                        continue
                    results[name] = points
                    if name == reference_keyword and name in keywords:
                        popularity_scores[name] = 100.0
                        continue
                    popularity_scores[name] = _calculate_relative_popularity(
                        points,
                        reference_points,
                    )
            except Exception as e:
                logger.error(f"네이버 데이터랩 API 오류: {e}")

    ranked_keywords = sorted(
        (
            keyword
            for keyword in results
            if keyword in popularity_scores
        ),
        key=lambda keyword: popularity_scores.get(keyword, 0.0),
        reverse=True,
    )
    popularity_ranks = {
        keyword: index + 1
        for index, keyword in enumerate(ranked_keywords)
    }

    return {
        "series": results,
        "popularity_scores": popularity_scores,
        "popularity_ranks": popularity_ranks,
    }


def calculate_acceleration(data_points: list[dict]) -> float:
    """최근 3일 평균 대비 이전 7일 평균 검색량 증가율 계산 (노이즈 감소)"""
    if len(data_points) < 10:
        return 0.0

    recent_avg = sum(p.get("ratio", 0) for p in data_points[-3:]) / 3
    prev_avg = sum(p.get("ratio", 0) for p in data_points[-10:-3]) / 7

    if prev_avg == 0:
        return 0.0

    return round(((recent_avg - prev_avg) / prev_avg) * 100, 2)
