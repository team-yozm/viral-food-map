from fastapi import APIRouter, Depends

from auth import AdminUser, require_admin_user
from scheduler.jobs import (
    get_new_products_refresh_status,
    run_new_products_refresh_job,
)

router = APIRouter(prefix="/api/new-products", tags=["new-products"])


@router.post("/refresh")
async def refresh_new_products(_: AdminUser = Depends(require_admin_user)):
    summary = await run_new_products_refresh_job(trigger="manual")
    return {
        "message": "New products refresh completed",
        "summary": summary,
    }


@router.get("/status")
async def get_refresh_status():
    return get_new_products_refresh_status()
