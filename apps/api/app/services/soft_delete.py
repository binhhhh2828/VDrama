"""Xóa mềm / khôi phục. Đây là chỗ duy nhất được gán deleted_at, deleted_by_id.

Bước 3 của plan (nhật ký thao tác) sẽ ghi audit log ngay trong các hàm này, cùng transaction.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserSession
from app.models.mixins import SoftDeleteMixin
from app.models.soft_delete import INCLUDE_DELETED


async def get_including_deleted[T: SoftDeleteMixin](
    db: AsyncSession, model: type[T], id_: int
) -> T | None:
    """Lấy một dòng kể cả khi đã xóa mềm (dùng cho admin, thùng rác, khôi phục)."""
    stmt = select(model).where(model.id == id_).execution_options(**{INCLUDE_DELETED: True})
    return (await db.execute(stmt)).scalar_one_or_none()


async def soft_delete(db: AsyncSession, obj: SoftDeleteMixin, *, deleted_by_id: int | None) -> bool:
    """Ẩn đối tượng. Trả False nếu nó đã bị xóa từ trước (không làm gì thêm)."""
    if obj.deleted_at is not None:
        return False
    obj.deleted_at = func.now()
    obj.deleted_by_id = deleted_by_id
    if isinstance(obj, User):
        # User bị xóa: đăng xuất khỏi mọi thiết bị ngay (giữ dòng sessions để truy vết).
        await db.execute(
            update(UserSession)
            .where(UserSession.user_id == obj.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=func.now())
        )
    await db.flush()
    # deleted_at do DB tính (now()); nạp lại ngay để không phải nạp ngầm ở lần đọc sau
    # (nạp ngầm trong async sẽ lỗi MissingGreenlet).
    await db.refresh(obj, attribute_names=["deleted_at"])
    return True


async def restore(db: AsyncSession, obj: SoftDeleteMixin) -> bool:
    """Khôi phục. Trả False nếu đối tượng chưa bị xóa.

    Phiên đăng nhập đã thu hồi khi xóa user không được mở lại: user đăng nhập lại như thường.
    """
    if obj.deleted_at is None:
        return False
    obj.deleted_at = None
    obj.deleted_by_id = None
    await db.flush()
    return True
