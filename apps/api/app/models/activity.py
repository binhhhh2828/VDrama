"""Nhóm hoạt động người dùng: watch_history, favorites.

watch_history là bảng ghi nhiều nhất (báo tiến độ mỗi ~15–30 giây khi đang xem):
- Một dòng cho mỗi (user, tập), ghi đè bằng upsert, không chèn dòng mới mỗi lần.
- Không đánh index trên progress_sec/updated_at, để Postgres cập nhật tại chỗ (HOT update,
  không phải sửa index). fillfactor 70 chừa chỗ trống trong trang cho việc đó.
- "Xem tiếp" lấy theo khóa chính (user_id, ...) rồi sắp xếp: mỗi user chỉ vài trăm dòng.
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import CreatedAtMixin


class WatchHistory(Base):
    __tablename__ = "watch_history"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    episode_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("episodes.id", ondelete="CASCADE"), primary_key=True
    )
    progress_sec: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("progress_sec >= 0", name="progress_non_negative"),
        Index("ix_watch_history_episode_id", "episode_id"),  # cho cascade khi xóa tập
        {"postgresql_with": {"fillfactor": 70}},
    )


class Favorite(CreatedAtMixin, Base):
    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    series_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("series.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (Index("ix_favorites_series_id", "series_id"),)
