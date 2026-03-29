"""프랜차이즈 브랜드 판별 모듈.

공정거래위원회 가맹사업 정보공개서 기반 브랜드 리스트를 사용하여
매장명이 프랜차이즈인지 판별합니다.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_BRANDS: set[str] | None = None

DATA_PATH = Path(__file__).parent / "data" / "franchise_brands.json"


def _load_brands() -> set[str]:
    global _BRANDS
    if _BRANDS is not None:
        return _BRANDS

    try:
        with open(DATA_PATH, encoding="utf-8") as f:
            brand_list: list[str] = json.load(f)
        _BRANDS = set(brand_list)
        logger.info(f"프랜차이즈 브랜드 {len(_BRANDS)}개 로드 완료")
    except FileNotFoundError:
        logger.warning(f"프랜차이즈 브랜드 파일 없음: {DATA_PATH}")
        _BRANDS = set()

    return _BRANDS


def is_franchise(store_name: str) -> bool:
    """매장명이 프랜차이즈 브랜드에 해당하는지 판별.

    매장명에서 지점명(XX점, XX역점 등)을 제거한 뒤
    브랜드 리스트와 매칭합니다.
    """
    brands = _load_brands()
    if not brands:
        return False

    name = store_name.strip()

    # 1) 정확히 일치
    if name in brands:
        return True

    # 2) 매장명이 "브랜드명 + 지점명" 패턴인지 확인
    #    e.g. "스타벅스 강남역점", "BBQ 서초점", "이디야커피 홍대점"
    for brand in brands:
        if len(brand) < 2:
            continue
        if name.startswith(brand) and (
            len(name) == len(brand)
            or name[len(brand)] == " "
            or name[len(brand)] == "\u00a0"
        ):
            return True

    return False


def check_franchise_batch(store_names: list[str]) -> dict[str, bool]:
    """여러 매장명을 한 번에 판별."""
    return {name: is_franchise(name) for name in store_names}
