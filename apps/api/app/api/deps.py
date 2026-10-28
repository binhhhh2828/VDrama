"""Dependency xác thực và phân quyền.

- CurrentUser: bắt buộc đăng nhập, không thì 401 `not_authenticated`.
- OptionalUser: trang công khai; khách (hoặc access token hỏng/hết hạn) nhận None.
- AdminUser: bắt buộc role admin, user thường nhận 403 `forbidden`.

Mỗi request kiểm tra phiên trong DB (một truy vấn theo khóa chính), không chỉ tin JWT: đăng
xuất, khóa hoặc xóa tài khoản có hiệu lực ngay, không phải chờ access token hết hạn. Role
cũng đọc từ DB, không đọc từ token.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import func, select

from app.api.cookies import read_access_cookie
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.core.security import InvalidTokenError, decode_access_token
from app.models import User, UserSession
from app.models.enums import UserRole


def not_authenticated() -> ApiError:
    return ApiError(401, ErrorCode.NOT_AUTHENTICATED, "Bạn cần đăng nhập.")


def forbidden() -> ApiError:
    return ApiError(403, ErrorCode.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.")


async def _load_user(request: Request, db: DbSession) -> User | None:
    token = read_access_cookie(request)
    if not token:
        return None
    try:
        claims = decode_access_token(token)
    except InvalidTokenError:
        return None
    # Bộ lọc xóa mềm tự loại user đã xóa.
    stmt = (
        select(User)
        .join(UserSession, UserSession.user_id == User.id)
        .where(
            UserSession.id == claims.session_id,
            User.id == claims.user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > func.now(),
            User.is_active.is_(True),
        )
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_optional_user(request: Request, db: DbSession) -> User | None:
    return await _load_user(request, db)


async def get_current_user(request: Request, db: DbSession) -> User:
    user = await _load_user(request, db)
    if user is None:
        raise not_authenticated()
    return user


async def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != UserRole.ADMIN:
        raise forbidden()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(require_admin)]
