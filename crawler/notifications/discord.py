import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)
DISCORD_MESSAGE_LIMIT = 2000


def _truncate(content: str) -> str:
    if len(content) <= DISCORD_MESSAGE_LIMIT:
        return content
    return content[: DISCORD_MESSAGE_LIMIT - 3] + "..."


async def send_discord_message(content: str) -> bool:
    webhook_url = settings.DISCORD_WEBHOOK_URL.strip()
    if not webhook_url:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                webhook_url,
                json={"content": _truncate(content)},
            )
            response.raise_for_status()
        return True
    except Exception as exc:
        logger.error(f"디스코드 알림 전송 실패: {exc}")
        return False
