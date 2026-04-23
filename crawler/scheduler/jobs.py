from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from crawlers.new_products import refresh_new_products
from crawlers.yomechu_places import refresh_recent_yomechu_ratings
from database import snapshot_daily_rank_baseline
from detector.keyword_discoverer import discover_keywords
from detector.store_updater import refresh_stores_for_active_trends
from detector.trend_detector import detect_trends
from detector.trend_image_refresher import refresh_images_for_active_trends
from error_reporting import report_exception_to_discord
from instagram_publisher import publish_daily_instagram_feed
from notifications import send_discord_message, send_push_notifications

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=ZoneInfo(settings.SCHEDULER_TIMEZONE))
trend_detection_lock = threading.Lock()
trend_image_refresh_lock = threading.Lock()
keyword_discovery_lock = threading.Lock()
store_update_lock = threading.Lock()
yomechu_enrich_lock = threading.Lock()
new_products_lock = threading.Lock()
_trend_detection_queue_lock = threading.Lock()
_trend_image_refresh_queue_lock = threading.Lock()
_keyword_discovery_queue_lock = threading.Lock()
trend_detection_task: asyncio.Task | None = None
trend_image_refresh_task: asyncio.Task | None = None
keyword_discovery_thread: threading.Thread | None = None
trend_detection_status: dict[str, object | None] = {
    "state": "idle",
    "last_trigger": None,
    "last_started_at": None,
    "last_finished_at": None,
    "last_summary": None,
    "last_error": None,
}
trend_image_refresh_status: dict[str, object | None] = {
    "state": "idle",
    "last_trigger": None,
    "last_started_at": None,
    "last_finished_at": None,
    "last_summary": None,
    "last_error": None,
}
keyword_discovery_status: dict[str, object | None] = {
    "state": "idle",
    "last_trigger": None,
    "last_started_at": None,
    "last_finished_at": None,
    "last_summary": None,
    "last_error": None,
}
new_products_status: dict[str, object | None] = {
    "state": "idle",
    "last_trigger": None,
    "last_started_at": None,
    "last_finished_at": None,
    "last_summary": None,
    "last_error": None,
}
instagram_post_lock = threading.Lock()
NEW_PRODUCTS_JOB_NAME = "신상 수집"

MAX_DETAIL_LINES = 5
TREND_JOB_NAME = "트렌드 감지"
TREND_IMAGE_JOB_NAME = "트렌드 이미지 갱신"
DISCOVERY_JOB_NAME = "키워드 발굴"
STORE_UPDATE_JOB_NAME = "판매처 갱신"
YOMECHU_JOB_NAME = "요메추 보강"
INSTAGRAM_JOB_NAME = "인스타 피드"

TREND_LABELS = {
    "keywords": "모니터링 키워드",
    "db_keywords": "DB 키워드",
    "seed_keywords": "시드 키워드",
    "candidates": "후보 키워드",
    "confirmed": "확정 트렌드",
    "stored_trends": "저장 트렌드",
    "stored_stores": "저장 판매처",
    "confirmed_keywords": "확정 키워드",
    "deactivated_trends": "비활성 트렌드",
    "deactivated_keywords": "휴면 키워드",
    "watchlist_count": "관찰 목록",
    "promoted_from_watchlist": "관찰→활성 승격",
    "ai_reviewed": "AI 검토 후보",
    "ai_accepted": "AI 통과 후보",
    "ai_reviews_persisted": "AI 리뷰 저장",
    "ai_reviews_queued": "AI 보류 큐 저장",
    "ai_grounding_status": "AI 구글검색",
    "ai_grounding_detail": "AI 구글검색 상세",
    "ai_grounding_queries": "AI 검색 쿼리",
    "ai_grounding_sources": "AI 검색 출처",
    "ai_calls_used": "AI 호출 사용",
    "ai_calls_remaining": "AI 자동화 예산 잔여",
    "alias_matches": "별칭 매칭",
    "budget_exhausted": "예산 소진",
    "canonicalized_keywords": "대표명 매핑",
    "ai_rejected_details": "AI 거절 상세",
    "ai_review_details": "AI 보류 상세",
    "ai_fallback_details": "AI fallback 상세",
    "generated_descriptions": "AI 설명 생성",
}

TREND_IMAGE_LABELS = {
    "target_trends": "대상 트렌드",
    "processed_trends": "처리 트렌드",
    "updated_images": "갱신 이미지",
    "kept_images": "유지 이미지",
    "missing_images": "이미지 없음",
    "skipped_images": "스킵",
    "failed_images": "실패",
}

DISCOVERY_LABELS = {
    "queries": "메타 쿼리",
    "collected_posts": "수집 포스트",
    "youtube_videos": "YouTube videos",
    "lead_candidates": "Lead candidates",
    "new_keywords": "신규 키워드",
    "keywords": "발굴 키워드",
    "ai_reviewed": "AI 검토 후보",
    "ai_accepted": "AI 통과 후보",
    "ai_reviews_queued": "AI 보류 큐 저장",
    "ai_grounding_status": "AI 구글검색",
    "ai_grounding_detail": "AI 구글검색 상세",
    "ai_grounding_queries": "AI 검색 쿼리",
    "ai_grounding_sources": "AI 검색 출처",
    "ai_calls_used": "AI 호출 사용",
    "ai_calls_remaining": "AI 자동화 예산 잔여",
    "alias_matches": "별칭 매칭",
    "budget_exhausted": "예산 소진",
    "canonicalized_keywords": "대표명 매핑",
    "ai_rejected_details": "AI 거절 상세",
    "ai_review_details": "AI 보류 상세",
    "ai_fallback_details": "AI fallback 상세",
}

STORE_UPDATE_LABELS = {
    "target_trends": "대상 트렌드",
    "processed_trends": "처리 트렌드",
    "added_stores": "추가 판매처",
    "changed_trends": "변경 발생 트렌드",
}

YOMECHU_LABELS = {
    "scanned": "검사 매장",
    "updated": "보강 건수",
}

NEW_PRODUCTS_LABELS = {
    "sources": "소스",
    "fetched_products": "수집",
    "inserted_products": "신규",
    "updated_products": "갱신",
    "visible_products": "노출",
}

JOB_LABELS = {
    TREND_JOB_NAME: TREND_LABELS,
    TREND_IMAGE_JOB_NAME: TREND_IMAGE_LABELS,
    DISCOVERY_JOB_NAME: DISCOVERY_LABELS,
    STORE_UPDATE_JOB_NAME: STORE_UPDATE_LABELS,
    YOMECHU_JOB_NAME: YOMECHU_LABELS,
    NEW_PRODUCTS_JOB_NAME: NEW_PRODUCTS_LABELS,
}


def _format_summary_lines(summary: dict, labels: dict[str, str]) -> list[str]:
    lines: list[str] = []
    for key, label in labels.items():
        value = summary.get(key)
        if value in (None, "", [], {}, False):
            continue
        if key.startswith("ai_") and key != "ai_calls_remaining" and value == 0:
            continue

        if isinstance(value, list):
            if key.endswith("_details"):
                visible_items = [str(item) for item in value[:MAX_DETAIL_LINES]]
                remaining = len(value) - len(visible_items)
                detail_lines = [f"{label}:"]
                detail_lines.extend(f"- {item}" for item in visible_items)
                if remaining > 0:
                    detail_lines.append(f"- 외 {remaining}건")
                lines.append("\n".join(detail_lines))
                continue

            formatted = ", ".join(str(item) for item in value[:MAX_DETAIL_LINES])
            if len(value) > MAX_DETAIL_LINES:
                formatted = f"{formatted}, 외 {len(value) - MAX_DETAIL_LINES}건"
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
        lines.extend(_format_summary_lines(summary, JOB_LABELS.get(job_name, {})))

    if error is not None:
        lines.append(f"오류: {error.__class__.__name__}: {error}")

    return "\n".join(lines)


def _format_hour_minute(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


def _build_instagram_job_message(trigger: str, status: str, summary: dict | None = None) -> str:
    lines = [f"[{INSTAGRAM_JOB_NAME} {status}]", f"트리거: {trigger}"]
    if not summary:
        return "\n".join(lines)

    lines.append(f"결과: {summary.get('status', 'unknown')}")

    published_trend = summary.get("published_trend") or {}
    trend_name = (
        published_trend.get("name")
        or (summary.get("run") or {}).get("trend_name_snapshot")
    )
    if trend_name:
        lines.append(f"음식: {trend_name}")

    candidate_count = summary.get("candidate_count")
    if candidate_count is not None:
        lines.append(f"후보 수: {candidate_count}")

    if summary.get("selected_scope"):
        lines.append(f"후보 범위: {summary['selected_scope']}")

    if summary.get("skip_reason"):
        lines.append(f"스킵 사유: {summary['skip_reason']}")

    if summary.get("reason"):
        lines.append(f"사유: {summary['reason']}")

    if summary.get("used_fallback_image"):
        lines.append("이미지: fallback 카드 사용")

    if summary.get("final_image_url"):
        lines.append(f"이미지 URL: {summary['final_image_url']}")

    errors = summary.get("errors") or []
    if errors:
        lines.append("오류:")
        lines.extend(f"- {error}" for error in errors[:MAX_DETAIL_LINES])

    return "\n".join(lines)


def get_scheduler_description() -> dict[str, str]:
    trend_hours = sorted(settings.TREND_DETECTION_SCHEDULE_HOURS)
    trend_schedule = (
        f"{_format_hour_minute(trend_hours[0], settings.TREND_DETECTION_SCHEDULE_MINUTE)}"
        f"~{_format_hour_minute(trend_hours[-1], settings.TREND_DETECTION_SCHEDULE_MINUTE)} 매시"
    )
    discovery_schedule = ", ".join(
        _format_hour_minute(hour, settings.DISCOVERY_SCHEDULE_MINUTE)
        for hour in sorted(settings.DISCOVERY_SCHEDULE_HOURS)
    )
    return {
        "timezone": settings.SCHEDULER_TIMEZONE,
        "trend_detection": trend_schedule,
        "rank_baseline_reset": "매일 00:00",
        "keyword_discovery": discovery_schedule,
        "store_update_minutes": str(settings.STORE_UPDATE_INTERVAL_MINUTES),
        "new_products_interval_hours": str(settings.NEW_PRODUCTS_INTERVAL_HOURS),
        "daily_ai_limit": str(settings.AI_AUTOMATION_DAILY_LIMIT),
        "instagram_posting_enabled": str(settings.INSTAGRAM_POSTING_ENABLED).lower(),
        "instagram_feed_schedule": _format_hour_minute(
            settings.INSTAGRAM_POST_SCHEDULE_HOUR,
            settings.INSTAGRAM_POST_SCHEDULE_MINUTE,
        ),
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mark_trend_detection_queued(trigger: str) -> None:
    trend_detection_status["state"] = "queued"
    trend_detection_status["last_trigger"] = trigger
    trend_detection_status["last_error"] = None


def _mark_trend_detection_running(trigger: str) -> None:
    trend_detection_status["state"] = "running"
    trend_detection_status["last_trigger"] = trigger
    trend_detection_status["last_started_at"] = _utc_now_iso()
    trend_detection_status["last_error"] = None


def _mark_trend_detection_finished(summary: dict) -> None:
    trend_detection_status["state"] = "completed"
    trend_detection_status["last_finished_at"] = _utc_now_iso()
    trend_detection_status["last_summary"] = summary
    trend_detection_status["last_error"] = None


def _mark_trend_detection_failed(error: str) -> None:
    trend_detection_status["state"] = "failed"
    trend_detection_status["last_finished_at"] = _utc_now_iso()
    trend_detection_status["last_error"] = error


def get_trend_detection_status() -> dict[str, object | None]:
    status = dict(trend_detection_status)
    status["running"] = bool(
        trend_detection_lock.locked()
        or status.get("state") in {"queued", "running"}
        or (trend_detection_task and not trend_detection_task.done())
    )
    return status


def _handle_trend_detection_task_result(task: asyncio.Task) -> None:
    global trend_detection_task

    try:
        task.result()
    except asyncio.CancelledError:
        logger.info("%s detached task cancelled", TREND_JOB_NAME)
    except Exception:
        logger.exception("%s detached task failed", TREND_JOB_NAME)
    finally:
        if trend_detection_task is task:
            trend_detection_task = None


def _mark_trend_image_refresh_queued(trigger: str) -> None:
    trend_image_refresh_status["state"] = "queued"
    trend_image_refresh_status["last_trigger"] = trigger
    trend_image_refresh_status["last_error"] = None


def _mark_trend_image_refresh_running(trigger: str) -> None:
    trend_image_refresh_status["state"] = "running"
    trend_image_refresh_status["last_trigger"] = trigger
    trend_image_refresh_status["last_started_at"] = _utc_now_iso()
    trend_image_refresh_status["last_error"] = None


def _mark_trend_image_refresh_finished(summary: dict) -> None:
    trend_image_refresh_status["state"] = "completed"
    trend_image_refresh_status["last_finished_at"] = _utc_now_iso()
    trend_image_refresh_status["last_summary"] = summary
    trend_image_refresh_status["last_error"] = None


def _mark_trend_image_refresh_failed(error: str) -> None:
    trend_image_refresh_status["state"] = "failed"
    trend_image_refresh_status["last_finished_at"] = _utc_now_iso()
    trend_image_refresh_status["last_error"] = error


def get_trend_image_refresh_status() -> dict[str, object | None]:
    status = dict(trend_image_refresh_status)
    status["running"] = bool(
        trend_image_refresh_lock.locked()
        or status.get("state") in {"queued", "running"}
        or (trend_image_refresh_task and not trend_image_refresh_task.done())
    )
    return status


def _handle_trend_image_refresh_task_result(task: asyncio.Task) -> None:
    global trend_image_refresh_task

    try:
        task.result()
    except asyncio.CancelledError:
        logger.info("%s detached task cancelled", TREND_IMAGE_JOB_NAME)
    except Exception:
        logger.exception("%s detached task failed", TREND_IMAGE_JOB_NAME)
    finally:
        if trend_image_refresh_task is task:
            trend_image_refresh_task = None


def _mark_keyword_discovery_queued(trigger: str) -> None:
    keyword_discovery_status["state"] = "queued"
    keyword_discovery_status["last_trigger"] = trigger
    keyword_discovery_status["last_error"] = None


def _mark_keyword_discovery_running(trigger: str) -> None:
    keyword_discovery_status["state"] = "running"
    keyword_discovery_status["last_trigger"] = trigger
    keyword_discovery_status["last_started_at"] = _utc_now_iso()
    keyword_discovery_status["last_error"] = None


def _mark_keyword_discovery_finished(summary: dict) -> None:
    keyword_discovery_status["state"] = "completed"
    keyword_discovery_status["last_finished_at"] = _utc_now_iso()
    keyword_discovery_status["last_summary"] = summary
    keyword_discovery_status["last_error"] = None


def _mark_keyword_discovery_failed(error: str) -> None:
    keyword_discovery_status["state"] = "failed"
    keyword_discovery_status["last_finished_at"] = _utc_now_iso()
    keyword_discovery_status["last_error"] = error


def get_keyword_discovery_status() -> dict[str, object | None]:
    status = dict(keyword_discovery_status)
    status["running"] = bool(
        keyword_discovery_lock.locked()
        or status.get("state") in {"queued", "running"}
        or (keyword_discovery_thread and keyword_discovery_thread.is_alive())
    )
    return status


def _mark_new_products_running(trigger: str) -> None:
    new_products_status["state"] = "running"
    new_products_status["last_trigger"] = trigger
    new_products_status["last_started_at"] = _utc_now_iso()
    new_products_status["last_error"] = None


def _mark_new_products_finished(summary: dict) -> None:
    new_products_status["state"] = "completed"
    new_products_status["last_finished_at"] = _utc_now_iso()
    new_products_status["last_summary"] = summary
    new_products_status["last_error"] = None


def _mark_new_products_failed(error: str) -> None:
    new_products_status["state"] = "failed"
    new_products_status["last_finished_at"] = _utc_now_iso()
    new_products_status["last_error"] = error


def get_new_products_refresh_status() -> dict[str, object | None]:
    status = dict(new_products_status)
    status["running"] = bool(
        new_products_lock.locked() or status.get("state") == "running"
    )
    return status


def _run_keyword_discovery_thread(trigger: str) -> None:
    global keyword_discovery_thread

    try:
        asyncio.run(run_keyword_discovery_job(trigger=trigger))
    except Exception:
        logger.exception("%s detached thread failed", DISCOVERY_JOB_NAME)
    finally:
        current_thread = threading.current_thread()
        if keyword_discovery_thread is current_thread:
            keyword_discovery_thread = None


def queue_keyword_discovery_job(trigger: str = "manual") -> dict[str, object]:
    global keyword_discovery_thread

    with _keyword_discovery_queue_lock:
        if keyword_discovery_lock.locked() or (
            keyword_discovery_thread and keyword_discovery_thread.is_alive()
        ):
            return {
                "accepted": False,
                "status": "running",
                "message": "Keyword discovery is already running.",
                "job": get_keyword_discovery_status(),
            }

        _mark_keyword_discovery_queued(trigger)
        keyword_discovery_thread = threading.Thread(
            target=_run_keyword_discovery_thread,
            args=(trigger,),
            name="keyword-discovery",
            daemon=True,
        )
        keyword_discovery_thread.start()
        return {
            "accepted": True,
            "status": "queued",
            "message": "Keyword discovery queued.",
            "job": get_keyword_discovery_status(),
        }


def queue_trend_detection_job(trigger: str = "manual") -> dict[str, object]:
    global trend_detection_task

    with _trend_detection_queue_lock:
        if trend_detection_lock.locked() or (
            trend_detection_task and not trend_detection_task.done()
        ):
            return {
                "accepted": False,
                "status": "running",
                "message": "Trend detection is already running.",
                "job": get_trend_detection_status(),
            }

        _mark_trend_detection_queued(trigger)
        trend_detection_task = asyncio.create_task(run_trend_detection_job(trigger=trigger))
        trend_detection_task.add_done_callback(_handle_trend_detection_task_result)
        return {
            "accepted": True,
            "status": "queued",
            "message": "Trend detection queued.",
            "job": get_trend_detection_status(),
        }


def queue_trend_image_refresh_job(trigger: str = "manual") -> dict[str, object]:
    global trend_image_refresh_task

    with _trend_image_refresh_queue_lock:
        if trend_image_refresh_lock.locked() or (
            trend_image_refresh_task and not trend_image_refresh_task.done()
        ):
            return {
                "accepted": False,
                "status": "running",
                "message": "Trend image refresh is already running.",
                "job": get_trend_image_refresh_status(),
            }

        _mark_trend_image_refresh_queued(trigger)
        trend_image_refresh_task = asyncio.create_task(
            run_trend_image_refresh_job(trigger=trigger)
        )
        trend_image_refresh_task.add_done_callback(
            _handle_trend_image_refresh_task_result
        )
        return {
            "accepted": True,
            "status": "queued",
            "message": "Trend image refresh queued.",
            "job": get_trend_image_refresh_status(),
        }


async def run_trend_detection_job(trigger: str = "scheduler") -> dict:
    job_name = TREND_JOB_NAME
    if not trend_detection_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        summary = {
            "confirmed": 0,
            "stored_trends": 0,
            "stored_stores": 0,
            "confirmed_keywords": [],
            "skipped": True,
            "reason": "already_running",
        }
        _mark_trend_detection_finished(summary)
        return summary

    _mark_trend_detection_running(trigger)
    logger.info("%s started (%s)", job_name, trigger)
    await send_discord_message(_build_job_message(job_name, trigger, "시작"))

    try:
        summary = await detect_trends(trigger=trigger)
        await send_discord_message(
            _build_job_message(job_name, trigger, "완료", summary=summary)
        )

        # watchlist → active 승격 알림
        promoted = summary.get("promoted_from_watchlist", [])
        if promoted:
            promoted_text = ", ".join(promoted[:10])
            await send_discord_message(
                f"[✅ 관찰→활성 승격] {len(promoted)}건: {promoted_text}"
            )

        # 연속 reject로 강등된 트렌드 알림
        deactivated = summary.get("deactivated_trends", [])
        if deactivated:
            deactivated_text = ", ".join(deactivated[:10])
            remaining = len(deactivated) - min(len(deactivated), 10)
            suffix = f" 외 {remaining}건" if remaining > 0 else ""
            await send_discord_message(
                f"[⛔ 비활성 전환] {len(deactivated)}건: {deactivated_text}{suffix}"
            )

        # watchlist 진입 알림
        watchlist_count = summary.get("watchlist_count", 0)
        if watchlist_count > 0:
            await send_discord_message(
                f"[👀 관찰 목록] 신규 {watchlist_count}건 watchlist 진입"
            )

        notification_keywords: list[str] = summary.get("new_confirmed_keywords", [])
        if notification_keywords:
            from database import get_client

            rows = (
                get_client()
                .table("trends")
                .select("id, name")
                .in_("name", notification_keywords)
                .execute()
                .data
            ) or []
            rows_by_name = {
                row["name"]: row
                for row in rows
                if row.get("name")
            }
            notification_targets = [
                {
                    "name": keyword,
                    "id": rows_by_name.get(keyword, {}).get("id"),
                }
                for keyword in notification_keywords
            ]

            try:
                send_push_notifications(notification_targets)
            except Exception as push_exc:
                logger.warning(
                    "Push notification failed for %s trends: %s",
                    len(notification_targets),
                    push_exc,
                )

        _mark_trend_detection_finished(summary)
        return summary
    except Exception as exc:
        _mark_trend_detection_failed(str(exc))
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        trend_detection_lock.release()


async def run_trend_image_refresh_job(trigger: str = "scheduler") -> dict:
    job_name = TREND_IMAGE_JOB_NAME
    if not trend_image_refresh_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        summary = {
            "target_trends": 0,
            "processed_trends": 0,
            "updated_images": 0,
            "kept_images": 0,
            "failed_images": 0,
            "skipped": True,
            "reason": "already_running",
        }
        _mark_trend_image_refresh_finished(summary)
        return summary

    _mark_trend_image_refresh_running(trigger)
    logger.info("%s started (%s)", job_name, trigger)
    await send_discord_message(_build_job_message(job_name, trigger, "시작"))

    try:
        summary = await refresh_images_for_active_trends()
        await send_discord_message(
            _build_job_message(job_name, trigger, "완료", summary=summary)
        )
        _mark_trend_image_refresh_finished(summary)
        return summary
    except Exception as exc:
        _mark_trend_image_refresh_failed(str(exc))
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        trend_image_refresh_lock.release()


async def run_keyword_discovery_job(trigger: str = "scheduler") -> dict:
    job_name = DISCOVERY_JOB_NAME
    if not keyword_discovery_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        summary = {
            "new_keywords": 0,
            "keywords": [],
            "skipped": True,
            "reason": "already_running",
        }
        _mark_keyword_discovery_finished(summary)
        return summary

    _mark_keyword_discovery_running(trigger)
    logger.info("%s started (%s)", job_name, trigger)
    await send_discord_message(_build_job_message(job_name, trigger, "시작"))

    try:
        summary = await discover_keywords(trigger=trigger)
        await send_discord_message(
            _build_job_message(job_name, trigger, "완료", summary=summary)
        )
        _mark_keyword_discovery_finished(summary)
        return summary
    except Exception as exc:
        _mark_keyword_discovery_failed(str(exc))
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        keyword_discovery_lock.release()


async def run_store_update_job(trigger: str = "scheduler") -> dict:
    job_name = STORE_UPDATE_JOB_NAME
    if not store_update_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        return {
            "target_trends": 0,
            "processed_trends": 0,
            "added_stores": 0,
            "changed_trends": [],
            "skipped": True,
        }

    logger.info("%s started (%s)", job_name, trigger)

    try:
        summary = await refresh_stores_for_active_trends()
        if summary.get("added_stores", 0) > 0:
            await send_discord_message(
                _build_job_message(job_name, trigger, "완료", summary=summary)
            )
        return summary
    except Exception as exc:
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        store_update_lock.release()


async def run_yomechu_enrichment_job(trigger: str = "scheduler") -> dict:
    job_name = YOMECHU_JOB_NAME
    if not settings.YOMECHU_ENRICH_ENABLED:
        logger.info("%s skipped because it is disabled", job_name)
        return {"scanned": 0, "updated": 0, "skipped": True}

    if not yomechu_enrich_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        return {"scanned": 0, "updated": 0, "skipped": True}

    logger.info("%s started (%s)", job_name, trigger)
    try:
        summary = await refresh_recent_yomechu_ratings()
        if summary.get("updated", 0) > 0:
            await send_discord_message(
                _build_job_message(job_name, trigger, "완료", summary=summary)
            )
        return summary
    except Exception as exc:
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        yomechu_enrich_lock.release()


async def run_new_products_refresh_job(trigger: str = "scheduler") -> dict:
    job_name = NEW_PRODUCTS_JOB_NAME
    if not settings.NEW_PRODUCTS_ENABLED and trigger == "scheduler":
        logger.info("%s skipped because it is disabled", job_name)
        summary = {"sources": 0, "fetched_products": 0, "visible_products": 0, "skipped": True}
        _mark_new_products_finished(summary)
        return summary

    if not new_products_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        summary = {
            "sources": 0,
            "fetched_products": 0,
            "inserted_products": 0,
            "updated_products": 0,
            "visible_products": 0,
            "skipped": True,
            "reason": "already_running",
        }
        _mark_new_products_finished(summary)
        return summary

    _mark_new_products_running(trigger)
    logger.info("%s started (%s)", job_name, trigger)

    try:
        summary = await refresh_new_products(trigger=trigger)
        if summary.get("visible_products", 0) > 0:
            await send_discord_message(
                _build_job_message(job_name, trigger, "완료", summary=summary)
            )
        _mark_new_products_finished(summary)
        return summary
    except Exception as exc:
        _mark_new_products_failed(str(exc))
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={"trigger": trigger},
        )
        raise
    finally:
        new_products_lock.release()


async def run_instagram_feed_job(
    *,
    trigger: str = "scheduler",
    dry_run: bool = False,
    force_retry: bool = False,
) -> dict:
    job_name = INSTAGRAM_JOB_NAME

    if dry_run:
        return await publish_daily_instagram_feed(
            trigger=trigger,
            dry_run=True,
            force_retry=force_retry,
        )

    if not instagram_post_lock.acquire(blocking=False):
        logger.warning("%s skipped because previous run is still active", job_name)
        return {
            "status": "noop",
            "reason": "already_running",
            "trigger": trigger,
        }

    logger.info("%s started (%s)", job_name, trigger)
    await send_discord_message(_build_instagram_job_message(trigger, "시작"))

    try:
        summary = await publish_daily_instagram_feed(
            trigger=trigger,
            dry_run=False,
            force_retry=force_retry,
        )
        await send_discord_message(
            _build_instagram_job_message(trigger, "완료", summary=summary)
        )
        return summary
    except Exception as exc:
        logger.exception("%s failed (%s)", job_name, trigger)
        await report_exception_to_discord(
            f"{job_name} 실패",
            exc,
            details={
                "trigger": trigger,
                "dry_run": dry_run,
                "force_retry": force_retry,
            },
        )
        raise
    finally:
        instagram_post_lock.release()


def run_trend_detection():
    asyncio.run(run_trend_detection_job(trigger="scheduler"))


def run_daily_rank_baseline_snapshot():
    logger.info("Daily rank baseline snapshot started")
    snapshot_daily_rank_baseline()
    logger.info("Daily rank baseline snapshot completed")


def run_keyword_discovery():
    asyncio.run(run_keyword_discovery_job(trigger="scheduler"))


def run_store_update():
    asyncio.run(run_store_update_job(trigger="scheduler"))


def run_yomechu_enrichment():
    asyncio.run(run_yomechu_enrichment_job(trigger="scheduler"))


def run_new_products_refresh():
    asyncio.run(run_new_products_refresh_job(trigger="scheduler"))


def run_instagram_feed_post():
    asyncio.run(run_instagram_feed_job(trigger="scheduler"))


def start_scheduler():
    scheduler.add_job(
        run_daily_rank_baseline_snapshot,
        "cron",
        hour=0,
        minute=0,
        id="daily_rank_baseline_snapshot",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_trend_detection,
        "cron",
        hour=",".join(str(hour) for hour in sorted(settings.TREND_DETECTION_SCHEDULE_HOURS)),
        minute=settings.TREND_DETECTION_SCHEDULE_MINUTE,
        id="trend_detection",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_keyword_discovery,
        "cron",
        hour=",".join(str(hour) for hour in sorted(settings.DISCOVERY_SCHEDULE_HOURS)),
        minute=settings.DISCOVERY_SCHEDULE_MINUTE,
        id="keyword_discovery",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_store_update,
        "interval",
        minutes=settings.STORE_UPDATE_INTERVAL_MINUTES,
        id="store_update",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    if settings.NEW_PRODUCTS_ENABLED:
        scheduler.add_job(
            run_new_products_refresh,
            "interval",
            hours=settings.NEW_PRODUCTS_INTERVAL_HOURS,
            id="new_products_refresh",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    if settings.INSTAGRAM_POSTING_ENABLED:
        scheduler.add_job(
            run_instagram_feed_post,
            "cron",
            hour=settings.INSTAGRAM_POST_SCHEDULE_HOUR,
            minute=settings.INSTAGRAM_POST_SCHEDULE_MINUTE,
            id="instagram_feed_post",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    if settings.YOMECHU_ENRICH_ENABLED:
        scheduler.add_job(
            run_yomechu_enrichment,
            "interval",
            hours=settings.YOMECHU_ENRICH_INTERVAL_HOURS,
            id="yomechu_enrichment",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    scheduler.start()

    description = get_scheduler_description()
    logger.info(
        "Scheduler started: rank_baseline=%s, trend=%s, discovery=%s, store_update=%s min, instagram=%s (%s), ai_limit=%s/day, tz=%s",
        description["rank_baseline_reset"],
        description["trend_detection"],
        description["keyword_discovery"],
        description["store_update_minutes"],
        description["instagram_feed_schedule"],
        description["instagram_posting_enabled"],
        description["daily_ai_limit"],
        description["timezone"],
    )


def stop_scheduler():
    if not scheduler.running:
        return
    scheduler.shutdown()
    logger.info("Scheduler stopped")
