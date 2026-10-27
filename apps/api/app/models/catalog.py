"""Nhóm catalog: series, series_stats, genres, series_genres, episodes."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import SeriesStatus, StreamStatus, sql_in
from app.models.mixins import SoftDeleteMixin, TimestampMixin

series_genres = Table(
    "series_genres",
    Base.metadata,
    Column("series_id", BigInteger, ForeignKey("series.id", ondelete="CASCADE"), primary_key=True),
    Column("genre_id", BigInteger, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
    # PK (series_id, genre_id) phục vụ chiều series → genres; chiều ngược cần index riêng.
    Index("ix_series_genres_genre_id", "genre_id"),
)


class Genre(SoftDeleteMixin, Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Series(SoftDeleteMixin, TimestampMixin, Base):
    __tablename__ = "series"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    poster_url: Mapped[str | None] = mapped_column(Text)
    banner_url: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(SmallInteger)
    country: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=SeriesStatus.ONGOING.value
    )
    total_episodes: Mapped[int | None] = mapped_column(Integer)  # số tập dự kiến
    is_published: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Cột sinh sẵn cho tìm kiếm không dấu (migration 0004). Không ghi trực tiếp.
    search_text: Mapped[str | None] = mapped_column(
        Text, Computed("lower(immutable_unaccent((title)::text))", persisted=True)
    )

    genres: Mapped[list[Genre]] = relationship(secondary=series_genres)

    __table_args__ = (
        CheckConstraint(sql_in("status", SeriesStatus), name="status"),
        CheckConstraint("total_episodes IS NULL OR total_episodes >= 0", name="total_episodes"),
        # Phân trang keyset theo published_at cần giá trị khi đã xuất bản.
        CheckConstraint("NOT is_published OR published_at IS NOT NULL", name="published_at_set"),
        # Danh sách phim mới: WHERE is_published ORDER BY published_at DESC, id DESC.
        Index(
            "ix_series_published",
            published_at.desc(),
            id.desc(),
            postgresql_where=text("is_published"),
        ),
        Index(
            "ix_series_search_text_trgm",
            search_text,
            postgresql_using="gin",
            postgresql_ops={"search_text": "gin_trgm_ops"},
        ),
    )


class SeriesStats(Base):
    """Số liệu ghi nhiều, tách khỏi `series` để dòng catalog ít bị update."""

    __tablename__ = "series_stats"

    series_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("series.id", ondelete="CASCADE"), primary_key=True
    )
    view_count: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    favorite_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("view_count >= 0 AND favorite_count >= 0", name="non_negative"),
    )


class Episode(SoftDeleteMixin, TimestampMixin, Base):
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # RESTRICT: không xóa được series còn tập; ẩn series bằng is_published.
    series_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("series.id", ondelete="RESTRICT"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(300))
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    stream_video_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    stream_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=StreamStatus.NONE.value
    )
    is_free: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    is_published: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        # Cũng là index cho khóa ngoại series_id và cho danh sách tập theo thứ tự.
        UniqueConstraint("series_id", "number", name="uq_episodes_series_id_number"),
        CheckConstraint("number > 0", name="number_positive"),
        CheckConstraint("duration_sec IS NULL OR duration_sec >= 0", name="duration_sec"),
        CheckConstraint(sql_in("stream_status", StreamStatus), name="stream_status"),
        # Không bao giờ xuất bản tập chưa có video phát được.
        CheckConstraint(
            "NOT is_published OR (published_at IS NOT NULL AND stream_status = 'ready')",
            name="publish_requires_ready",
        ),
    )
