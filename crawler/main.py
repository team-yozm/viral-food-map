import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.trends import router as trends_router
from routers.stores import router as stores_router
from scheduler.jobs import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("서버 시작")
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("서버 종료")


app = FastAPI(
    title="뜨는맛집 API",
    description="바이럴 음식 트렌드 탐지 크롤러",
    version="0.1.0",
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "viral-food-map-crawler"}
