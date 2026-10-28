"""Đăng ký, đăng nhập, tạo và thu hồi phiên.

`create_session` là chỗ duy nhất tạo phiên đăng nhập (Giai đoạn 5 thêm giới hạn thiết bị ở đây).
Service không commit: router commit sau khi mọi thứ thành công.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.request_context import current_request
from app.core.security import (
    create_access_token,
    dummy_verify_password,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    password_needs_rehash,
    verify_password,
)
from app.models import User, UserSession
from app.models.enums import UserRole
from app.models.soft_delete import INCLUDE_DELETED
from app.schemas.auth import RegisterIn


class EmailTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class AccountDisabledError(Exception):
    pass


class SessionInvalidError(Exception):
    """Refresh token không dùng được nữa (không tồn tại, hết hạn, đã thu hồi, bị dùng lại)."""


# Token liền trước còn được chấp nhận trong khoảng này sau khi xoay (hai tab refresh cùng lúc).
REFRESH_REUSE_GRACE = timedelta(seconds=60)


@dataclass(frozen=True)
class IssuedSession:
    session_id: uuid.UUID
    access_token: str
    # Bản rõ chỉ tồn tại trong cookie; DB giữ SHA-256. None: giữ nguyên cookie refresh hiện có.
    refresh_token: str | None
    expires_at: datetime


def _email_matches(email: str):
    return func.lower(User.email) == email.strip().lower()


async def email_taken(db: AsyncSession, email: str) -> bool:
    """Tính cả user đã xóa mềm: email của họ vẫn giữ chỗ để khôi phục được."""
    stmt = select(User.id).where(_email_matches(email)).execution_options(**{INCLUDE_DELETED: True})
    return (await db.execute(stmt)).first() is not None


async def create_session(db: AsyncSession, user: User) -> IssuedSession:
    req = current_request()
    refresh = new_refresh_token()
    expires_at = datetime.now(UTC) + timedelta(days=get_settings().refresh_token_ttl_days)
    session = UserSession(
        id=uuid.uuid4(),  # sinh ở app để ký access token ngay, không cần đọc lại từ DB
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh),
        device_info=req.user_agent,
        ip=req.ip,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    return IssuedSession(
        session_id=session.id,
        access_token=create_access_token(user.id, session.id),
        refresh_token=refresh,
        expires_at=expires_at,
    )


async def register(db: AsyncSession, data: RegisterIn) -> tuple[User, IssuedSession]:
    if await email_taken(db, data.email):
        raise EmailTakenError
    user = User(
        email=data.email,
        password_hash=await hash_password(data.password),
        display_name=data.display_name,
        role=UserRole.USER,
        terms_accepted_at=func.now(),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        # Hai request đăng ký cùng email chạy song song: unique index của DB chặn người đến sau.
        if "uq_users_email_lower" in str(exc.orig):
            await db.rollback()
            raise EmailTakenError from exc
        raise
    await db.refresh(user)  # nạp created_at, terms_accepted_at do DB tính
    return user, await create_session(db, user)


async def login(db: AsyncSession, email: str, password: str) -> tuple[User, IssuedSession]:
    # Bộ lọc xóa mềm tự ẩn user đã xóa: họ nhận cùng lỗi như email không tồn tại.
    user = (await db.execute(select(User).where(_email_matches(email)))).scalar_one_or_none()
    if user is None:
        await dummy_verify_password()  # thời gian phản hồi như khi sai mật khẩu
        raise InvalidCredentialsError
    if not await verify_password(user.password_hash, password):
        raise InvalidCredentialsError
    # Chỉ báo "bị khóa" khi đã đúng mật khẩu, để không lộ trạng thái tài khoản cho người lạ.
    if not user.is_active:
        raise AccountDisabledError

    if password_needs_rehash(user.password_hash):
        user.password_hash = await hash_password(password)
    user.last_login_at = func.now()
    await db.flush()
    await db.refresh(user)
    return user, await create_session(db, user)


async def revoke_session(
    db: AsyncSession, *, refresh_token: str | None = None, session_id: uuid.UUID | None = None
) -> bool:
    """Thu hồi một phiên, tìm theo refresh token hoặc id phiên. Trả True nếu có phiên bị thu hồi."""
    conditions = []
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        conditions += [
            UserSession.refresh_token_hash == token_hash,
            UserSession.previous_refresh_token_hash == token_hash,
        ]
    if session_id:
        conditions.append(UserSession.id == session_id)
    if not conditions:
        return False
    result = await db.execute(
        update(UserSession)
        .where(or_(*conditions), UserSession.revoked_at.is_(None))
        .values(revoked_at=func.now())
    )
    return result.rowcount > 0


async def refresh(db: AsyncSession, refresh_token: str | None) -> IssuedSession:
    """Đổi refresh token lấy access token mới, xoay vòng refresh token.

    - Token hiện tại: cấp token mới, token cũ thành "liền trước", gia hạn phiên thêm 30 ngày.
    - Token liền trước, trong 60 giây sau khi xoay (tab khác vừa refresh xong): cấp access mới
      nhưng KHÔNG xoay tiếp. Xoay tiếp thì phản hồi đến sau có thể ghi đè cookie bằng token đã
      cũ, lần refresh sau bị coi là đánh cắp và người dùng bị đăng xuất oan.
    - Token liền trước, quá 60 giây: coi là bị đánh cắp, thu hồi cả phiên.

    Ném SessionInvalidError khi không dùng được. Người gọi vẫn phải commit trong trường hợp đó
    để lưu việc thu hồi phiên.
    """
    if not refresh_token:
        raise SessionInvalidError
    token_hash = hash_refresh_token(refresh_token)
    # Khóa dòng: hai request cùng token chạy nối tiếp, request sau thấy kết quả của request trước.
    session = (
        await db.execute(
            select(UserSession)
            .where(
                or_(
                    UserSession.refresh_token_hash == token_hash,
                    UserSession.previous_refresh_token_hash == token_hash,
                )
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        raise SessionInvalidError

    # Bộ lọc xóa mềm ẩn user đã xóa; user bị khóa cũng không được gia hạn phiên.
    user = (await db.execute(select(User).where(User.id == session.user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        session.revoked_at = now
        await db.flush()
        raise SessionInvalidError

    req = current_request()
    session.last_seen_at = now
    session.ip = req.ip or session.ip
    if session.refresh_token_hash == token_hash:
        new_token = new_refresh_token()
        session.previous_refresh_token_hash = token_hash
        session.refresh_token_hash = hash_refresh_token(new_token)
        session.rotated_at = now
        session.expires_at = now + timedelta(days=get_settings().refresh_token_ttl_days)
    elif session.rotated_at is not None and now - session.rotated_at <= REFRESH_REUSE_GRACE:
        new_token = None
    else:
        session.revoked_at = now
        await db.flush()
        raise SessionInvalidError
    await db.flush()
    return IssuedSession(
        session_id=session.id,
        access_token=create_access_token(user.id, session.id),
        refresh_token=new_token,
        expires_at=session.expires_at,
    )
