from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from config import settings
from scheduler.jobs import (
    get_scheduler_description,
    get_trend_detection_status,
    get_trend_image_refresh_status,
    queue_trend_detection_job,
    queue_trend_image_refresh_job,
    run_instagram_feed_job,
)

logger = logging.getLogger(__name__)

DISCORD_API_BASE_URL = "https://discord.com/api/v10"

INTERACTION_TYPE_APPLICATION_COMMAND = 2
INTERACTION_RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE = 5

APPLICATION_COMMAND_OPTION_TYPE_SUB_COMMAND = 1

ROOT_COMMAND_NAMES = {"요즘뭐먹", "yozmeat"}
COMMAND_ALIASES = {
    "상태": "status",
    "상태체크": "status",
    "status": "status",
    "크롤링": "crawl",
    "크롤링실행": "crawl",
    "crawl": "crawl",
    "사진": "images",
    "사진갱신": "images",
    "이미지": "images",
    "이미지갱신": "images",
    "images": "images",
    "인스타": "instagram",
    "인스타게시": "instagram",
    "instagram": "instagram",
}


def _get_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_string(value: Any) -> str | None:
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    return None


def _get_options(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _get_bool_option(
    options: list[dict[str, Any]],
    *names: str,
    default: bool = False,
) -> bool:
    names_set = set(names)
    for option in options:
        if _get_string(option.get("name")) in names_set:
            return bool(option.get("value"))
    return default


def build_deferred_channel_response() -> dict[str, Any]:
    return {"type": INTERACTION_RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE}


def _format_local_time(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return "-"

    raw = value.strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw

    try:
        tz = ZoneInfo(settings.SCHEDULER_TIMEZONE)
    except Exception:
        return parsed.strftime("%m/%d %H:%M")

    return parsed.astimezone(tz).strftime("%m/%d %H:%M")


def _format_job_line(label: str, job: dict[str, Any]) -> str:
    state = _get_string(job.get("state")) or "unknown"
    running = "실행 중" if job.get("running") else state
    started_at = _format_local_time(job.get("last_started_at"))
    finished_at = _format_local_time(job.get("last_finished_at"))
    error = _get_string(job.get("last_error"))

    line = f"- {label}: {running} (시작 {started_at}, 종료 {finished_at})"
    if error:
        line = f"{line}\n  오류: {error}"
    return line


def _format_status_message() -> str:
    schedule = get_scheduler_description()
    instagram_status = (
        f"활성화, 매일 {schedule['instagram_feed_schedule']}"
        if settings.INSTAGRAM_POSTING_ENABLED
        else "스케줄 비활성화"
    )

    return "\n".join(
        [
            "**요즘뭐먹 크롤러 상태**",
            "- 서비스: ok",
            f"- 시간대: {schedule['timezone']}",
            f"- 등락 기준 초기화: {schedule['rank_baseline_reset']}",
            f"- 트렌드 감지 스케줄: {schedule['trend_detection']}",
            f"- 인스타 피드: {instagram_status}",
            _format_job_line("크롤링", get_trend_detection_status()),
            _format_job_line("사진 갱신", get_trend_image_refresh_status()),
        ]
    )


def _format_queue_message(title: str, result: dict[str, Any]) -> str:
    accepted = bool(result.get("accepted"))
    message = _get_string(result.get("message")) or ""
    status_text = "시작했습니다" if accepted else "이미 실행 중입니다"
    lines = [f"**{title}**", f"{status_text}."]
    if message:
        lines.append(f"- 상세: {message}")

    job = _get_record(result.get("job"))
    if job:
        lines.append(_format_job_line("현재 상태", job))
    return "\n".join(lines)


def _get_instagram_trend_name(summary: dict[str, Any]) -> str | None:
    for key in ("published_trend", "pending_trend"):
        trend = _get_record(summary.get(key))
        name = _get_string(trend.get("name"))
        if name:
            return name

    run = _get_record(summary.get("run"))
    return _get_string(run.get("trend_name_snapshot"))


def _format_instagram_message(summary: dict[str, Any]) -> str:
    status = _get_string(summary.get("status")) or "unknown"
    trend_name = _get_instagram_trend_name(summary)
    reason = _get_string(summary.get("reason")) or _get_string(summary.get("skip_reason"))
    final_image_url = _get_string(summary.get("final_image_url"))

    lines = ["**인스타 게시 결과**", f"- 상태: {status}"]
    if trend_name:
        lines.append(f"- 트렌드: {trend_name}")
    if reason:
        lines.append(f"- 사유: {reason}")
    if final_image_url:
        lines.append(f"- 이미지: {final_image_url}")

    errors = summary.get("errors")
    if isinstance(errors, list) and errors:
        lines.append("- 오류:")
        lines.extend(f"  - {error}" for error in errors[:3])

    if status == "published":
        lines.append("게시를 완료했습니다.")
    elif status == "pending_review":
        lines.append("디스코드 이미지 검토 대기로 보냈습니다.")
    elif status == "dry_run":
        lines.append("미리보기만 실행했습니다.")
    elif status == "noop" and reason == "already_running":
        lines.append("이미 인스타 게시 작업이 실행 중입니다.")

    return "\n".join(lines)


def _resolve_command(interaction: dict[str, Any]) -> tuple[str | None, list[dict[str, Any]]]:
    data = _get_record(interaction.get("data"))
    command_name = (_get_string(data.get("name")) or "").lower()
    options = _get_options(data.get("options"))

    if command_name in ROOT_COMMAND_NAMES:
        subcommand = next(
            (
                option
                for option in options
                if int(option.get("type", 0)) == APPLICATION_COMMAND_OPTION_TYPE_SUB_COMMAND
            ),
            None,
        )
        if not subcommand:
            return None, []

        subcommand_name = (_get_string(subcommand.get("name")) or "").lower()
        return COMMAND_ALIASES.get(subcommand_name), _get_options(subcommand.get("options"))

    return COMMAND_ALIASES.get(command_name), options


async def process_application_command(interaction: dict[str, Any]) -> str:
    command, options = _resolve_command(interaction)

    if command == "status":
        return _format_status_message()

    if command == "crawl":
        result = queue_trend_detection_job(trigger="discord")
        return _format_queue_message("크롤링 실행", result)

    if command == "images":
        result = queue_trend_image_refresh_job(trigger="discord")
        return _format_queue_message("사진 갱신", result)

    if command == "instagram":
        dry_run = _get_bool_option(options, "미리보기", "dry_run", "dry-run")
        force_retry = _get_bool_option(options, "강제재시도", "force_retry", "force-retry")
        summary = await run_instagram_feed_job(
            trigger="discord",
            dry_run=dry_run,
            force_retry=force_retry,
        )
        return _format_instagram_message(summary)

    return (
        "지원하지 않는 명령입니다. "
        "`/요즘뭐먹 상태`, `/요즘뭐먹 크롤링`, `/요즘뭐먹 사진갱신`, "
        "`/요즘뭐먹 인스타게시` 중 하나를 사용해 주세요."
    )


async def _edit_original_interaction_response(
    interaction: dict[str, Any],
    content: str,
) -> None:
    application_id = _get_string(interaction.get("application_id"))
    token = _get_string(interaction.get("token"))
    if not application_id or not token:
        logger.warning("Cannot edit Discord command response without application_id/token")
        return

    url = (
        f"{DISCORD_API_BASE_URL}/webhooks/"
        f"{application_id}/{token}/messages/@original"
    )
    payload = {
        "content": content[:1900],
        "allowed_mentions": {"parse": []},
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(url, json=payload)

    if response.status_code >= 400:
        logger.warning(
            "Discord command response update failed: status=%s body=%s",
            response.status_code,
            response.text[:500],
        )


async def _process_and_update_application_command(interaction: dict[str, Any]) -> None:
    try:
        content = await process_application_command(interaction)
    except Exception as exc:
        logger.exception("Discord application command failed")
        content = f"명령 처리 중 오류가 발생했습니다: {exc}"

    await _edit_original_interaction_response(interaction, content)


def schedule_application_command_processing(interaction: dict[str, Any]) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.debug("No running loop; skipped Discord application command")
        return

    task = loop.create_task(_process_and_update_application_command(interaction))

    def _done_callback(done_task: asyncio.Task) -> None:
        try:
            done_task.result()
        except Exception:
            logger.exception("Background Discord application command task failed")

    task.add_done_callback(_done_callback)
