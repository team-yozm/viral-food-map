"""웹 푸시 알림 발송 모듈"""
from __future__ import annotations

import json
import logging

from config import settings
from database import get_client

logger = logging.getLogger(__name__)


def send_push_notifications(trend_name: str, trend_id: str) -> int:
    """새 트렌드 발견 시 구독자 전체에게 웹 푸시 발송.

    Returns:
        발송 성공 건수
    """
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

    payload = json.dumps(
        {
            "title": f"🔥 새 트렌드: {trend_name}",
            "body": "지금 뜨고 있어요! 주변 판매처를 확인해보세요.",
            "url": f"/trend/{trend_id}",
        }
    )

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
        except WebPushException as e:
            status = getattr(e.response, "status_code", None) if e.response else None
            if status in (404, 410):  # 만료된 구독
                expired.append(sub["endpoint"])
            else:
                logger.warning("푸시 발송 실패 (%s): %s", sub["endpoint"][:40], e)
        except Exception as e:
            logger.warning("푸시 발송 오류: %s", e)

    # 만료된 구독 정리
    if expired:
        get_client().table("push_subscriptions").delete().in_(
            "endpoint", expired
        ).execute()
        logger.info("만료 구독 %d건 정리", len(expired))

    logger.info("웹 푸시 발송: %d/%d 성공", success, len(subs))
    return success
