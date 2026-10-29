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


class DeletedAtMixin:
    """Cột `deleted_at`: dòng vẫn nằm trong DB, chỉ bị ẩn. Khôi phục = đặt lại NULL.

    Mọi truy vấn ORM tự loại dòng đã xóa (app/models/soft_delete.py); muốn thấy cả dòng đã xóa
    thì thêm execution_options(include_deleted=True).

    Dùng trực tiếp cho dữ liệu người dùng tự xóa (lịch sử xem, yêu thích): người dùng thấy là đã
    xóa, hệ thống vẫn giữ. Không ghi nhật ký, không cần lý do; service của bảng tự đặt cột này.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class SoftDeleteMixin(DeletedAtMixin):
    """Xóa mềm cho dữ liệu admin quản lý (users, series, episodes, genres, vip_plans).

    Thêm người xóa (`deleted_by_id`). Xóa/khôi phục phải đi qua app/services/soft_delete.py
    (bắt lý do, ghi nhật ký), không tự gán `deleted_at`.
    """

    @declared_attr
    def deleted_by_id(cls) -> Mapped[int | None]:
        # Admin đã xóa. Có index vì là khóa ngoại.
        return mapped_column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True)
