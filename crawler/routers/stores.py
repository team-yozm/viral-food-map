from fastapi import APIRouter
from pydantic import BaseModel
from database import get_client

router = APIRouter(prefix="/api/stores", tags=["stores"])


class ReportRequest(BaseModel):
    trend_id: str
    store_name: str
    address: str
    note: str | None = None


@router.get("")
async def list_stores(trend_id: str | None = None):
    """판매처 목록 (트렌드 필터 가능)"""
    query = get_client().table("stores").select("*")
    if trend_id:
        query = query.eq("trend_id", trend_id)
    return query.execute().data


@router.post("/report")
async def submit_report(report: ReportRequest):
    """사용자 판매처 제보"""
    data = {
        "trend_id": report.trend_id,
        "store_name": report.store_name,
        "address": report.address,
        "note": report.note,
        "status": "pending",
    }
    result = get_client().table("reports").insert(data).execute()
    return {"message": "제보가 접수되었습니다", "data": result.data}
