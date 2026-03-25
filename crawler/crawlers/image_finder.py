import httpx
from config import settings
import logging

logger = logging.getLogger(__name__)

NAVER_IMAGE_URL = "https://openapi.naver.com/v1/search/image"


async def find_food_image(keyword: str) -> str | None:
    """네이버 이미지 검색 API로 음식 대표 이미지 URL 조회"""
    headers = {
        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                NAVER_IMAGE_URL,
                params={
                    "query": f"{keyword} 디저트 음식",
                    "display": 5,
                    "sort": "sim",
                    "filter": "large",
                },
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            items = data.get("items", [])
            if items:
                # 첫 번째 이미지 사용
                return items[0].get("link")

    except Exception as e:
        logger.error(f"네이버 이미지 검색 오류 ({keyword}): {e}")

    return None
