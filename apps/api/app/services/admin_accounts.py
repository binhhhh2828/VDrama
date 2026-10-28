"""Tạo hoặc nâng quyền admin. Chỉ gọi từ lệnh CLI chạy trên server, không có đường nào trên web.

Ghi nhật ký (bắt buộc lý do) trong cùng transaction. Không commit: người gọi commit.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole
from app.models.soft_delete import INCLUDE_DELETED
from app.services.audit import Actor, load_snapshot, record, require_reason


class AdminAccountError(Exception):
    """Không thực hiện được (lý do đọc được cho người vận hành)."""


@dataclass(frozen=True)
class AdminResult:
    user: User
    created: bool  # True: tạo tài khoản mới; False: nâng quyền tài khoản có sẵn
    changed: bool  # False: đã là admin từ trước, không đổi gì


async def find_by_email_including_deleted(db: AsyncSession, email: str) -> User | None:
    stmt = (
        select(User)
        .where(func.lower(User.email) == email.strip().lower())
        .execution_options(**{INCLUDE_DELETED: True})
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_or_promote_admin(
    db: AsyncSession,
    *,
    email: str,
    reason: str,
    password: str | None = None,
    display_name: str | None = None,
    actor: Actor | None = None,
) -> AdminResult:
    """Email chưa có: tạo admin mới (cần mật khẩu). Email đã có: nâng role lên admin."""
    actor = actor or Actor.system()
    existing = await find_by_email_including_deleted(db, email)

    if existing is None:
        action = "users.create_admin"
        reason = require_reason(action, reason)
        if not password:
            raise AdminAccountError("Tài khoản mới cần mật khẩu")
        user = User(
            email=email.strip(),
            password_hash=await hash_password(password),
            display_name=(display_name or email.split("@")[0]).strip()[:100],
            role=UserRole.ADMIN,
        )
        db.add(user)
        await db.flush()
        await record(
            db,
            action=action,
            actor=actor,
            obj=user,
            subject_user_id=user.id,
            extra={"email": user.email, "role": user.role},
            reason=reason,
        )
        return AdminResult(user=user, created=True, changed=True)

    if existing.deleted_at is not None:
        raise AdminAccountError("Tài khoản này đã bị xóa; hãy khôi phục trước khi nâng quyền")
    if existing.role == UserRole.ADMIN:
        return AdminResult(user=existing, created=False, changed=False)

    action = "users.role_change"
    reason = require_reason(action, reason)
    before = await load_snapshot(db, existing)
    existing.role = UserRole.ADMIN
    await db.flush()
    await record(
        db,
        action=action,
        actor=actor,
        obj=existing,
        subject_user_id=existing.id,
        before=before,
        after=await load_snapshot(db, existing),
        reason=reason,
    )
    return AdminResult(user=existing, created=False, changed=True)
