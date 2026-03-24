import httpx
from config import settings
import logging

logger = logging.getLogger(__name__)

KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


async def find_stores_kakao(keyword: str, page: int = 1, size: int = 15) -> list[dict]:
    """카카오 로컬 API로 키워드 기반 판매처 검색"""
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"}

    all_stores = []
    try:
        async with httpx.AsyncClient() as client:
            for p in range(1, 4):  # 최대 3페이지
                resp = await client.get(
                    KAKAO_SEARCH_URL,
                    params={
                        "query": keyword,
                        "category_group_code": "FD6,CE7",  # 음식점, 카페
                        "page": p,
                        "size": size,
                    },
                    headers=headers,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()

                for doc in data.get("documents", []):
                    all_stores.append({
                        "name": doc["place_name"],
                        "address": doc.get("road_address_name") or doc.get("address_name", ""),
                        "lat": float(doc["y"]),
                        "lng": float(doc["x"]),
                        "phone": doc.get("phone") or None,
                        "source": "kakao_api",
                        "verified": True,
                    })

                if data.get("meta", {}).get("is_end", True):
                    break

    except Exception as e:
        logger.error(f"카카오 로컬 API 오류 ({keyword}): {e}")

    return all_stores
