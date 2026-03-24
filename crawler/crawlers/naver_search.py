import httpx
from config import settings
import logging

logger = logging.getLogger(__name__)

NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/blog"


async def get_blog_mention_count(keyword: str) -> int:
    """네이버 블로그에서 키워드 언급 총 건수 조회"""
    headers = {
        "X-Naver-Client-Id": settings.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": settings.NAVER_CLIENT_SECRET,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                NAVER_SEARCH_URL,
                params={"query": keyword, "display": 1, "sort": "date"},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("total", 0)
    except Exception as e:
        logger.error(f"네이버 검색 API 오류 ({keyword}): {e}")
        return 0
