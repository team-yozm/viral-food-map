import httpx
from datetime import datetime, timedelta
from config import settings
import logging

logger = logging.getLogger(__name__)

NAVER_DATALAB_URL = "https://openapi.naver.com/v1/datalab/search"


async def get_search_trend(keywords: list[str], days: int = 7) -> dict[str, list[dict]]:
    """네이버 데이터랩에서 키워드별 검색량 추이 조회"""
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    headers = {
        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
        "Content-Type": "application/json",
    }

    results = {}
    # API는 한 번에 5개 키워드 그룹까지 지원
    for i in range(0, len(keywords), 5):
        batch = keywords[i : i + 5]
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
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    NAVER_DATALAB_URL, headers=headers, json=body, timeout=10
                )
                resp.raise_for_status()
                data = resp.json()

                for result in data.get("results", []):
                    name = result["title"]
                    results[name] = result.get("data", [])
        except Exception as e:
            logger.error(f"네이버 데이터랩 API 오류: {e}")

    return results


def calculate_acceleration(data_points: list[dict]) -> float:
    """최근 3일 대비 이전 3일 검색량 증가율 계산"""
    if len(data_points) < 6:
        return 0.0

    recent = sum(p.get("ratio", 0) for p in data_points[-3:])
    previous = sum(p.get("ratio", 0) for p in data_points[-6:-3])

    if previous == 0:
        return 0.0

    return ((recent - previous) / previous) * 100
