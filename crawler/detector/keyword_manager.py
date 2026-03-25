SEED_KEYWORDS = {
    "디저트": [
        "버터떡", "두쫀쿠", "두바이초콜릿", "크루키", "약과", "탕후루",
        "마카롱", "크로플", "소금빵", "바스크치즈케이크", "쿵야떡볶이",
        "호두과자", "인절미", "카눌레", "뚱카롱", "마라탕후루",
    ],
    "음료": [
        "하이볼", "제로슈거", "말차라떼", "흑당버블티", "아인슈페너",
        "레몬에이드", "딸기라떼", "크림라떼",
    ],
    "식사": [
        "마라탕", "마라샹궈", "로제떡볶이", "옥수수치즈", "엽떡",
        "서브웨이", "장인약과", "우삼겹덮밥",
    ],
    "간식": [
        "붕어빵", "호떡", "계란빵", "핫도그", "츄러스",
        "꽈배기", "타코야키", "창억떡",
    ],
}


def get_all_seed_keywords() -> list[dict]:
    """시드 키워드 목록을 DB 형식으로 반환"""
    keywords = []
    for category, kw_list in SEED_KEYWORDS.items():
        for kw in kw_list:
            keywords.append({
                "keyword": kw,
                "category": category,
                "is_active": True,
                "baseline_volume": 0,
            })
    return keywords


def get_flat_keywords() -> list[str]:
    """모든 키워드를 flat list로 반환"""
    result = []
    for kw_list in SEED_KEYWORDS.values():
        result.extend(kw_list)
    return result
