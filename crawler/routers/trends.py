from fastapi import APIRouter
from database import get_client
from scheduler.jobs import run_trend_detection_job, run_keyword_discovery_job

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("")
async def list_trends():
    """활성 트렌드 목록 (판매처 수 포함)"""
    data = (
        get_client()
        .table("trends")
        .select("*, stores(count)")
        .in_("status", ["rising", "active"])
        .order("peak_score", desc=True)
        .execute()
        .data
    )
    return data


@router.get("/{trend_id}")
async def get_trend(trend_id: str):
    """트렌드 상세 + 판매처"""
    trend = (
        get_client()
        .table("trends")
        .select("*")
        .eq("id", trend_id)
        .single()
        .execute()
        .data
    )
    stores = (
        get_client()
        .table("stores")
        .select("*")
        .eq("trend_id", trend_id)
        .execute()
        .data
    )
    return {"trend": trend, "stores": stores}


@router.post("/detect")
async def trigger_detection():
    """수동 트렌드 탐지 트리거"""
    summary = await run_trend_detection_job(trigger="manual")
    return {
        "message": "트렌드 탐지 완료",
        "summary": summary,
    }


@router.post("/discover-keywords")
async def trigger_discovery():
    """수동 키워드 발굴 트리거"""
    summary = await run_keyword_discovery_job(trigger="manual")
    return {
        "message": f"키워드 {summary['new_keywords']}개 발견",
        "summary": summary,
    }
