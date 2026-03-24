from pytrends.request import TrendReq
import logging

logger = logging.getLogger(__name__)


def get_google_trend_score(keyword: str) -> float:
    """구글 트렌드에서 키워드 관심도 점수 조회 (0-100)"""
    try:
        pytrends = TrendReq(hl="ko", tz=540)
        pytrends.build_payload([keyword], cat=0, timeframe="now 7-d", geo="KR")
        data = pytrends.interest_over_time()

        if data.empty or keyword not in data.columns:
            return 0.0

        return float(data[keyword].iloc[-1])
    except Exception as e:
        logger.error(f"구글 트렌드 오류 ({keyword}): {e}")
        return 0.0
