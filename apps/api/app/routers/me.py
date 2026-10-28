from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.auth import UserOut

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.of(user)
