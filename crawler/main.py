from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from error_reporting import install_recent_logs_handler, report_exception_to_discord
from notifications import send_discord_message
from routers.stores import router as stores_router
from routers.trends import router as trends_router
from routers.yomechu import router as yomechu_router
from scheduler.jobs import (
    run_startup_bootstrap_job,
    run_yomechu_enrichment_job,
    start_scheduler,
    stop_scheduler,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
install_recent_logs_handler()
logger = logging.getLogger(__name__)


def _build_startup_message() -> str:
    yomechu_line = (
        f"요메추 보강 주기: {settings.YOMECHU_ENRICH_INTERVAL_HOURS}시간"
        if settings.YOMECHU_ENRICH_ENABLED
        else "요메추 보강 배치: 비활성화"
    )
    return "\n".join(
        [
            "[크롤러 시작]",
            f"트렌드 감지 주기: {settings.CRAWL_INTERVAL_MINUTES}분",
            f"판매처 갱신 주기: {settings.STORE_UPDATE_INTERVAL_MINUTES}분",
            f"키워드 발굴 주기: {settings.DISCOVERY_INTERVAL_HOURS}시간",
            yomechu_line,
        ]
    )


def _handle_background_task_result(task: asyncio.Task):
    try:
        task.result()
    except asyncio.CancelledError:
        logger.info("시작 직후 백그라운드 작업이 취소됨")
    except Exception:
        logger.exception("시작 직후 백그라운드 작업 실패")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("서버 시작")
    startup_bootstrap: asyncio.Task | None = None
    startup_yomechu_enrich: asyncio.Task | None = None

    try:
        start_scheduler()
        await send_discord_message(_build_startup_message())

        startup_bootstrap = asyncio.create_task(run_startup_bootstrap_job())
        startup_bootstrap.add_done_callback(_handle_background_task_result)

        if settings.YOMECHU_ENRICH_ENABLED:
            startup_yomechu_enrich = asyncio.create_task(
                run_yomechu_enrichment_job(trigger="startup")
            )
            startup_yomechu_enrich.add_done_callback(_handle_background_task_result)
        else:
            logger.info("요메추 보강 배치 비활성화: startup 실행 건너뜀")
        yield
    except Exception as exc:
        logger.exception("서버 라이프사이클 처리 실패")
        await report_exception_to_discord("서버 라이프사이클 처리 실패", exc)
        raise
    finally:
        try:
            if startup_bootstrap and not startup_bootstrap.done():
                startup_bootstrap.cancel()
            if startup_yomechu_enrich and not startup_yomechu_enrich.done():
                startup_yomechu_enrich.cancel()
            stop_scheduler()
        except Exception as exc:
            logger.exception("서버 종료 처리 실패")
            await report_exception_to_discord("서버 종료 처리 실패", exc)
            raise
        logger.info("서버 종료")


app = FastAPI(
    title="요즘뭐먹 API",
    description="바이럴 음식 트렌드와 요메추 추천을 제공하는 백엔드",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trends_router)
app.include_router(stores_router)
app.include_router(yomechu_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("요청 처리 중 예외 발생: %s %s", request.method, request.url.path)
    await report_exception_to_discord(
        "API 요청 처리 실패",
        exc,
        details={
            "메서드": request.method,
            "경로": request.url.path,
            "쿼리": request.url.query,
        },
    )
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "viral-food-map-crawler",
        "yomechu_enrich_enabled": settings.YOMECHU_ENRICH_ENABLED,
    }
