from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TimestampMixin(CreatedAtMixin):
    # onupdate chạy ở tầng ORM; câu UPDATE viết tay phải tự đặt updated_at.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    """Xóa mềm: dòng vẫn nằm trong DB, chỉ bị ẩn. Khôi phục = đặt lại deleted_at = NULL.

    Mọi truy vấn ORM tự loại dòng đã xóa (app/models/soft_delete.py); muốn thấy cả dòng đã xóa
    (admin, thùng rác, khôi phục) thì thêm execution_options(include_deleted=True).
    Xóa/khôi phục phải đi qua app/services/soft_delete.py (không tự gán cột này).
    """

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @declared_attr
    def deleted_by_id(cls) -> Mapped[int | None]:
        # Admin đã xóa. Có index vì là khóa ngoại.
        return mapped_column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
