import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from detector.trend_detector import detect_trends
from config import settings

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def run_trend_detection():
    """트렌드 탐지 작업 실행"""
    logger.info("스케줄: 트렌드 탐지 시작")
    asyncio.get_event_loop().run_until_complete(detect_trends())


def start_scheduler():
    """스케줄러 시작"""
    scheduler.add_job(
        run_trend_detection,
        "interval",
        minutes=settings.CRAWL_INTERVAL_MINUTES,
        id="trend_detection",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"스케줄러 시작: {settings.CRAWL_INTERVAL_MINUTES}분 간격 트렌드 탐지")


def stop_scheduler():
    """스케줄러 중지"""
    scheduler.shutdown()
    logger.info("스케줄러 중지")
