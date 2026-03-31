import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)
DISCORD_MESSAGE_LIMIT = 2000


def _split_content(content: str, limit: int = DISCORD_MESSAGE_LIMIT) -> list[str]:
    if not content:
        return [""]

    chunks: list[str] = []
    current: list[str] = []
    current_length = 0

    for raw_line in content.splitlines():
        line = raw_line or " "
        line_length = len(line)

        if line_length > limit:
            if current:
                chunks.append("\n".join(current))
                current = []
                current_length = 0

            for start in range(0, line_length, limit):
                chunks.append(line[start : start + limit])
            continue

        additional = line_length + (1 if current else 0)
        if current and current_length + additional > limit:
            chunks.append("\n".join(current))
            current = [line]
            current_length = line_length
            continue

        current.append(line)
        current_length += additional

    if current:
        chunks.append("\n".join(current))

    return chunks


def _build_server_prefix() -> str:
    env_name = settings.APP_ENV.strip().lower()
    if env_name in {"prod", "production", "live"}:
        return "[운영 서버]"
    if env_name in {"dev", "development", "local"}:
        return "[개발 서버]"
    if env_name in {"stage", "staging"}:
        return "[스테이징 서버]"
    if not env_name:
        return "[개발 서버]"
    return f"[{settings.APP_ENV} 서버]"


def _build_payload_chunks(content: str) -> list[str]:
    prefix = _build_server_prefix()
    separator = "\n" if content else ""
    chunk_limit = max(1, DISCORD_MESSAGE_LIMIT - len(prefix) - len(separator))
    content_chunks = _split_content(content, limit=chunk_limit)
    return [f"{prefix}{separator}{chunk}" for chunk in content_chunks]


async def send_discord_message(content: str) -> bool:
    webhook_url = settings.DISCORD_WEBHOOK_URL.strip()
    if not webhook_url:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for chunk in _build_payload_chunks(content):
                response = await client.post(
                    webhook_url,
                    json={"content": chunk},
                )
                response.raise_for_status()
        return True
    except Exception as exc:
        logger.error(f"디스코드 알림 전송 실패: {exc}")
        return False
