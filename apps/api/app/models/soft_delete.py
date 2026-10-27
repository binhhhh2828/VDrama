"""Tự động ẩn dòng đã xóa mềm khỏi mọi truy vấn ORM (chống quên `WHERE deleted_at IS NULL`).

Áp dụng cho mọi Session (kể cả AsyncSession, vì nó chạy trên Session thường bên dưới).
Không áp dụng cho SQL viết tay bằng text(): truy vấn phục vụ người dùng không được viết tay.

Lưu ý: dòng đã xóa của một bảng chỉ bị ẩn khi chính bảng đó được truy vấn. Ẩn "theo cha"
(ví dụ tập của một series đã xóa) do truy vấn nghiệp vụ tự join điều kiện của series.
"""

from sqlalchemy import event
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.models.mixins import SoftDeleteMixin

INCLUDE_DELETED = "include_deleted"


@event.listens_for(Session, "do_orm_execute")
def _hide_soft_deleted(state: ORMExecuteState) -> None:
    if (
        state.is_select
        and not state.is_column_load  # nạp lại thuộc tính của đối tượng đã có trong phiên
        and not state.is_relationship_load  # đã được bộ lọc ở truy vấn gốc áp xuống
        and not state.execution_options.get(INCLUDE_DELETED, False)
    ):
        state.statement = state.statement.options(
            with_loader_criteria(
                SoftDeleteMixin,
                lambda cls: cls.deleted_at.is_(None),
                include_aliases=True,
            )
        )
