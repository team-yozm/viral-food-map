from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

CRAWLER_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = CRAWLER_DIR.parent
sys.path.insert(0, str(CRAWLER_DIR))

load_dotenv(ROOT_DIR / ".env")
load_dotenv(CRAWLER_DIR / ".env", override=True)

from config import settings  # noqa: E402

DISCORD_API_BASE_URL = "https://discord.com/api/v10"

APPLICATION_COMMAND_TYPE_CHAT_INPUT = 1
OPTION_TYPE_SUB_COMMAND = 1
OPTION_TYPE_BOOLEAN = 5

COMMANDS: list[dict[str, Any]] = [
    {
        "name": "요즘뭐먹",
        "description": "요즘뭐먹 크롤러 운영 명령",
        "type": APPLICATION_COMMAND_TYPE_CHAT_INPUT,
        "options": [
            {
                "name": "상태",
                "description": "크롤러와 작업 상태를 확인합니다.",
                "type": OPTION_TYPE_SUB_COMMAND,
            },
            {
                "name": "크롤링",
                "description": "트렌드 감지와 판매처 수집을 실행합니다.",
                "type": OPTION_TYPE_SUB_COMMAND,
            },
            {
                "name": "사진갱신",
                "description": "사진이 비어 있는 활성 트렌드 이미지를 갱신합니다.",
                "type": OPTION_TYPE_SUB_COMMAND,
            },
            {
                "name": "인스타게시",
                "description": "오늘의 인스타 피드 게시 작업을 실행합니다.",
                "type": OPTION_TYPE_SUB_COMMAND,
                "options": [
                    {
                        "name": "미리보기",
                        "description": "실제 게시 없이 후보만 확인합니다.",
                        "type": OPTION_TYPE_BOOLEAN,
                        "required": False,
                    },
                    {
                        "name": "강제재시도",
                        "description": "이전 실패 상태를 무시하고 다시 시도합니다.",
                        "type": OPTION_TYPE_BOOLEAN,
                        "required": False,
                    },
                ],
            },
        ],
    }
]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Register 요즘뭐먹 Discord slash commands.",
    )
    parser.add_argument(
        "--guild-id",
        default="",
        help="Optional Discord guild ID for instant guild-scoped command updates.",
    )
    return parser.parse_args()


def _command_endpoint(application_id: str, guild_id: str = "") -> str:
    if guild_id:
        return f"/applications/{application_id}/guilds/{guild_id}/commands"

    return f"/applications/{application_id}/commands"


async def _fetch_application_id(client: httpx.AsyncClient) -> str:
    response = await client.get("/oauth2/applications/@me")
    if response.status_code >= 400:
        raise RuntimeError(
            f"Discord application lookup failed: "
            f"status={response.status_code} body={response.text}"
        )

    application_id = str(response.json().get("id") or "").strip()
    if not application_id:
        raise RuntimeError("Discord application ID was missing from the API response.")
    return application_id


async def _upsert_command(
    client: httpx.AsyncClient,
    path: str,
    command: dict[str, Any],
) -> str:
    list_response = await client.get(path)
    if list_response.status_code >= 400:
        raise RuntimeError(
            f"Discord command lookup failed: "
            f"status={list_response.status_code} body={list_response.text}"
        )

    existing_commands = list_response.json()
    existing = next(
        (
            item
            for item in existing_commands
            if isinstance(item, dict) and item.get("name") == command["name"]
        ),
        None,
    )

    if existing:
        command_id = existing["id"]
        response = await client.patch(f"{path}/{command_id}", json=command)
        action = "Updated"
    else:
        response = await client.post(path, json=command)
        action = "Created"

    if response.status_code >= 400:
        raise RuntimeError(
            f"Discord command upsert failed: "
            f"status={response.status_code} body={response.text}"
        )

    return f"{action} /{command['name']}"


async def main() -> None:
    args = _parse_args()
    token = settings.DISCORD_BOT_TOKEN.strip()
    if not token:
        raise RuntimeError("DISCORD_BOT_TOKEN is required.")

    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(
        base_url=DISCORD_API_BASE_URL,
        timeout=20,
        headers=headers,
    ) as client:
        application_id = await _fetch_application_id(client)
        endpoint = _command_endpoint(application_id, args.guild_id.strip())
        results = [await _upsert_command(client, endpoint, command) for command in COMMANDS]

    scope = f"guild {args.guild_id.strip()}" if args.guild_id.strip() else "global"
    print(f"Registered Discord commands to {scope} scope.")
    for result in results:
        print(f"- {result}")


if __name__ == "__main__":
    asyncio.run(main())
