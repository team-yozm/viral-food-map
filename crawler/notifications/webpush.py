"""웹 푸시 알림 발송 모듈."""
from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from typing import TypedDict

from config import settings
from database import get_client

logger = logging.getLogger(__name__)


class PushTrendTarget(TypedDict):
    name: str
    id: str | None


def _normalize_targets(
    trends: Sequence[PushTrendTarget] | str,
    trend_id: str | None = None,
) -> list[PushTrendTarget]:
    if isinstance(trends, str):
        name = trends.strip()
        return [{"name": name, "id": trend_id}] if name else []

    normalized: list[PushTrendTarget] = []
    for trend in trends:
        name = str(trend.get("name", "")).strip()
        if not name:
            continue

        raw_id = trend.get("id")
        normalized.append(
            {
                "name": name,
                "id": str(raw_id).strip() if raw_id else None,
            }
        )

    return normalized


def _build_push_payload(trends: list[PushTrendTarget]) -> dict[str, str]:
    if len(trends) == 1:
        trend = trends[0]
        return {
            "title": f"🔥 새 트렌드 {trend['name']}",
            "body": "지금 뜨고 있어요. 주변 판매처를 확인해보세요.",
            "url": f"/trend/{trend['id']}" if trend.get("id") else "/",
        }

    preview_names = [trend["name"] for trend in trends[:3]]
    preview_text = ", ".join(preview_names)
    if len(trends) > 3:
        preview_text = f"{preview_text} 외 {len(trends) - 3}개"

    return {
        "title": f"🔥 새 트렌드 {len(trends)}개 업데이트",
        "body": f"{preview_text} 트렌드를 한 번에 확인해보세요.",
        "url": "/",
    }


def send_push_notifications(
    trends: Sequence[PushTrendTarget] | str,
    trend_id: str | None = None,
) -> int:
    """새 트렌드 발견 시 구독자 전체에게 웹 푸시를 발송한다.

    여러 트렌드가 한 번에 감지되면 하나의 묶음 알림으로 보낸다.

    Returns:
        발송 성공 건수
    """
    targets = _normalize_targets(trends, trend_id=trend_id)
    if not targets:
        return 0

    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.debug("VAPID 키 미설정 — 웹 푸시 스킵")
        return 0

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush 미설치 — 웹 푸시 스킵")
        return 0

    subs = (
        get_client()
        .table("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .execute()
        .data
    ) or []

    if not subs:
        return 0

    payload = json.dumps(_build_push_payload(targets), ensure_ascii=False)

    success = 0
    expired: list[str] = []

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CONTACT},
            )
            success += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None) if exc.response else None
            if status in (404, 410):
                expired.append(sub["endpoint"])
            else:
                logger.warning("푸시 발송 실패 (%s): %s", sub["endpoint"][:40], exc)
        except Exception as exc:
            logger.warning("푸시 발송 오류: %s", exc)

    if expired:
        get_client().table("push_subscriptions").delete().in_(
            "endpoint", expired
        ).execute()
        logger.info("만료 구독 %d건 정리", len(expired))

    logger.info(
        "웹 푸시 발송: %d/%d 성공 (트렌드 %d개 묶음)",
        success,
        len(subs),
        len(targets),
    )
    return success
