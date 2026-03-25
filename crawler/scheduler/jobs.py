import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from detector.trend_detector import detect_trends
from detector.keyword_discoverer import discover_keywords
from config import settings
from notifications import send_discord_message

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

TREND_LABELS = {
    "keywords": "모니터링 키워드",
    "candidates": "급등 후보",
    "confirmed": "확정 트렌드",
    "stored_trends": "저장 트렌드",
    "stored_stores": "등록 판매처",
    "confirmed_keywords": "확정 키워드",
}

DISCOVERY_LABELS = {
    "queries": "메타 쿼리",
    "collected_posts": "수집 블로그",
    "new_keywords": "신규 키워드",
    "keywords": "발견 키워드",
}


def _format_summary_lines(summary: dict, labels: dict[str, str]) -> list[str]:
    lines = []
    for key, label in labels.items():
        value = summary.get(key)
        if value in (None, "", [], {}):
            continue
        if isinstance(value, list):
            formatted = ", ".join(str(item) for item in value)
        else:
            formatted = str(value)
        lines.append(f"{label}: {formatted}")
    return lines


def _build_job_message(
    job_name: str,
    trigger: str,
    status: str,
    summary: dict | None = None,
    error: Exception | None = None,
) -> str:
    lines = [f"[{job_name} {status}]", f"트리거: {trigger}"]

    if summary:
        labels = TREND_LABELS if job_name == "트렌드 탐지" else DISCOVERY_LABELS
        lines.extend(_format_summary_lines(summary, labels))

    if error is not None:
        lines.append(f"오류: {error.__class__.__name__}: {error}")

    return "\n".join(lines)


async def run_trend_detection_job(trigger: str = "scheduler") -> dict:
    job_name = "트렌드 탐지"
    logger.info(f"{trigger} 트리거: {job_name} 시작")
    await send_discord_message(_build_job_message(job_name, trigger, "시작"))

    try:
        summary = await detect_trends()
        await send_discord_message(
            _build_job_message(job_name, trigger, "완료", summary=summary)
        )
        return summary
    except Exception as exc:
        logger.exception(f"{trigger} 트리거: {job_name} 실패")
        await send_discord_message(
            _build_job_message(job_name, trigger, "실패", error=exc)
        )
        raise


async def run_keyword_discovery_job(trigger: str = "scheduler") -> dict:
    job_name = "키워드 발굴"
    logger.info(f"{trigger} 트리거: {job_name} 시작")
    await send_discord_message(_build_job_message(job_name, trigger, "시작"))

    try:
        summary = await discover_keywords()
        await send_discord_message(
            _build_job_message(job_name, trigger, "완료", summary=summary)
        )
        return summary
    except Exception as exc:
        logger.exception(f"{trigger} 트리거: {job_name} 실패")
        await send_discord_message(
            _build_job_message(job_name, trigger, "실패", error=exc)
        )
        raise


def run_trend_detection():
    """트렌드 탐지 작업 실행"""
    logger.info("스케줄: 트렌드 탐지 시작")
    asyncio.run(run_trend_detection_job())


def run_keyword_discovery():
    """키워드 자동 발굴 작업 실행"""
    logger.info("스케줄: 키워드 발굴 시작")
    asyncio.run(run_keyword_discovery_job())


def start_scheduler():
    """스케줄러 시작"""
    scheduler.add_job(
        run_trend_detection,
        "interval",
        minutes=settings.CRAWL_INTERVAL_MINUTES,
        id="trend_detection",
        replace_existing=True,
    )

    scheduler.add_job(
        run_keyword_discovery,
        "interval",
        hours=settings.DISCOVERY_INTERVAL_HOURS,
        id="keyword_discovery",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        f"스케줄러 시작: 트렌드 탐지 {settings.CRAWL_INTERVAL_MINUTES}분, "
        f"키워드 발굴 {settings.DISCOVERY_INTERVAL_HOURS}시간 간격"
    )


def stop_scheduler():
    """스케줄러 중지"""
    scheduler.shutdown()
    logger.info("스케줄러 중지")
