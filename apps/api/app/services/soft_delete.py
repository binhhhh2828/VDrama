"""Xóa mềm / khôi phục. Đây là chỗ duy nhất được gán deleted_at, deleted_by_id.

Mỗi lần xóa/khôi phục ghi một dòng audit_logs trong cùng transaction, bắt buộc có lý do.
Hành động: "<bảng>.delete" / "<bảng>.restore", ví dụ series.delete, users.restore.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserSession
from app.models.mixins import SoftDeleteMixin
from app.models.soft_delete import INCLUDE_DELETED
from app.services.audit import Actor, load_snapshot, record, require_reason


async def get_including_deleted[T: SoftDeleteMixin](
    db: AsyncSession, model: type[T], id_: int
) -> T | None:
    """Lấy một dòng kể cả khi đã xóa mềm (dùng cho admin, thùng rác, khôi phục)."""
    stmt = select(model).where(model.id == id_).execution_options(**{INCLUDE_DELETED: True})
    return (await db.execute(stmt)).scalar_one_or_none()


def _subject_user_id(obj: SoftDeleteMixin) -> int | None:
    return obj.id if isinstance(obj, User) else None


async def soft_delete(db: AsyncSession, obj: SoftDeleteMixin, *, actor: Actor, reason: str) -> bool:
    """Ẩn đối tượng. Trả False nếu nó đã bị xóa từ trước (không làm gì, không ghi nhật ký)."""
    action = f"{obj.__table__.name}.delete"
    reason = require_reason(action, reason)  # thiếu lý do thì dừng trước khi đổi gì
    before = await load_snapshot(db, obj)  # nạp đủ cột trước khi đọc (tránh nạp ngầm trong async)
    if obj.deleted_at is not None:
        return False

    obj.deleted_at = func.now()
    obj.deleted_by_id = actor.user_id
    revoked = 0
    if isinstance(obj, User):
        # User bị xóa: đăng xuất khỏi mọi thiết bị ngay (giữ dòng sessions để truy vết).
        result = await db.execute(
            update(UserSession)
            .where(UserSession.user_id == obj.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=func.now())
        )
        revoked = result.rowcount
    await db.flush()

    await record(
        db,
        action=action,
        actor=actor,
        obj=obj,
        subject_user_id=_subject_user_id(obj),
        before=before,
        after=await load_snapshot(db, obj),
        extra={"sessions_revoked": revoked} if isinstance(obj, User) else None,
        reason=reason,
    )
    return True


async def restore(db: AsyncSession, obj: SoftDeleteMixin, *, actor: Actor, reason: str) -> bool:
    """Khôi phục. Trả False nếu đối tượng chưa bị xóa.

    Phiên đăng nhập đã thu hồi khi xóa user không được mở lại: user đăng nhập lại như thường.
    """
    action = f"{obj.__table__.name}.restore"
    reason = require_reason(action, reason)
    before = await load_snapshot(db, obj)
    if obj.deleted_at is None:
        return False

    obj.deleted_at = None
    obj.deleted_by_id = None
    await db.flush()
    await record(
        db,
        action=action,
        actor=actor,
        obj=obj,
        subject_user_id=_subject_user_id(obj),
        before=before,
        after=await load_snapshot(db, obj),
        reason=reason,
    )
    return True
