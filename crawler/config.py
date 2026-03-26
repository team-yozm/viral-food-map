import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    NAVER_CLIENT_ID: str = os.getenv("NAVER_CLIENT_ID", "")
    NAVER_CLIENT_SECRET: str = os.getenv("NAVER_CLIENT_SECRET", "")
    KAKAO_REST_API_KEY: str = os.getenv("KAKAO_REST_API_KEY", "")
    DISCORD_WEBHOOK_URL: str = os.getenv("DISCORD_WEBHOOK_URL", "")

    TREND_THRESHOLD: float = float(os.getenv("TREND_THRESHOLD", "30"))
    TREND_SCORE_THRESHOLD: float = float(os.getenv("TREND_SCORE_THRESHOLD", "50"))
    CRAWL_INTERVAL_MINUTES: int = int(os.getenv("CRAWL_INTERVAL_MINUTES", "30"))
    STORE_UPDATE_INTERVAL_MINUTES: int = int(
        os.getenv("STORE_UPDATE_INTERVAL_MINUTES", "60")
    )
    DISCOVERY_INTERVAL_HOURS: int = int(os.getenv("DISCOVERY_INTERVAL_HOURS", "1"))
    DISCOVERY_MIN_FREQUENCY: int = int(os.getenv("DISCOVERY_MIN_FREQUENCY", "3"))
    DISCOVERY_MAX_NEW_KEYWORDS: int = int(
        os.getenv("DISCOVERY_MAX_NEW_KEYWORDS", "10")
    )
    YOMECHU_ENRICH_INTERVAL_HOURS: int = int(
        os.getenv("YOMECHU_ENRICH_INTERVAL_HOURS", "4")
    )
    YOMECHU_ENRICH_BATCH_SIZE: int = int(
        os.getenv("YOMECHU_ENRICH_BATCH_SIZE", "100")
    )


settings = Settings()
