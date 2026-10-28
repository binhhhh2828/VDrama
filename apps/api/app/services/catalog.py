"""Truy vấn catalog công khai (chỉ đọc).

- Danh sách và tìm kiếm chỉ trả series đã xuất bản (kể cả với admin; admin quản lý ở trang
  admin). Series/thể loại đã xóa mềm tự bị ẩn bởi bộ lọc ORM.
- Phân trang keyset (con trỏ), không dùng OFFSET: trang sau không trùng/sót khi có phim mới
  xuất bản giữa chừng, và không chậm dần khi đi sâu. Thứ tự luôn có `id` để phân định khi trùng
  giá trị sắp xếp.
"""

import base64
import binascii
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import ColumnElement, Select, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Episode, Genre, Series, SeriesStats, series_genres
from app.services.search import series_search_condition, series_search_rank

SeriesSort = Literal["new", "hot"]


class InvalidCursorError(ValueError):
    pass


@dataclass(frozen=True)
class SeriesCursor:
    sort: str
    value: str  # giá trị sắp xếp của phần tử cuối trang trước (dạng chuỗi)
    id: int

    def encode(self) -> str:
        raw = json.dumps({"s": self.sort, "v": self.value, "i": self.id}, separators=(",", ":"))
        return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")

    @classmethod
    def decode(cls, token: str, *, sort: str) -> "SeriesCursor":
        try:
            padded = token + "=" * (-len(token) % 4)
            data = json.loads(base64.urlsafe_b64decode(padded.encode()))
            cursor = cls(sort=str(data["s"]), value=str(data["v"]), id=int(data["i"]))
        except (binascii.Error, ValueError, KeyError, TypeError) as exc:
            raise InvalidCursorError("Con trỏ không hợp lệ") from exc
        if cursor.sort != sort:
            raise InvalidCursorError("Con trỏ không dùng cho kiểu sắp xếp này")
        return cursor


async def list_genres(db: AsyncSession) -> list[Genre]:
    return list((await db.execute(select(Genre).order_by(Genre.name, Genre.id))).scalars())


def _sort_key(sort: SeriesSort) -> ColumnElement:
    """Giá trị sắp xếp chính (giảm dần); `id` luôn đi kèm để phân định khi trùng."""
    if sort == "hot":
        # Series chưa có dòng series_stats (chưa ai xem) tính là 0 lượt xem.
        return func.coalesce(SeriesStats.view_count, 0)
    return Series.published_at


def _parse_cursor_value(sort: SeriesSort, value: str) -> datetime | int:
    try:
        return int(value) if sort == "hot" else datetime.fromisoformat(value)
    except ValueError as exc:
        raise InvalidCursorError("Con trỏ không hợp lệ") from exc


def series_list_stmt(
    *,
    sort: SeriesSort = "new",
    genre_slug: str | None = None,
    with_banner: bool = False,
    limit: int = 20,
    cursor: SeriesCursor | None = None,
) -> Select:
    """Câu truy vấn danh sách series, trả (Series, giá trị sắp xếp).

    Tách riêng để test kiểm tra được kế hoạch truy vấn.
    - new: (published_at DESC, id DESC), khớp index ix_series_published.
    - hot: (lượt xem DESC, id DESC), join trái series_stats. Không có index ghép: với vài trăm
      series vẫn nhanh (ghi ở mục Rủi ro của plan).
    """
    key = _sort_key(sort)
    # Viết `WHERE is_published` (không phải `IS true`): index một phần ix_series_published khai
    # báo điều kiện `WHERE is_published`, Postgres không suy ra được từ `IS true` nên bỏ qua index.
    stmt = select(Series, key.label("sort_key")).where(Series.is_published)
    if sort == "hot":
        stmt = stmt.outerjoin(SeriesStats, SeriesStats.series_id == Series.id)
    if genre_slug is not None:
        # Thể loại đã xóa mềm bị bộ lọc ORM loại khỏi phép join, nên lọc theo nó trả rỗng.
        stmt = (
            stmt.join(series_genres, series_genres.c.series_id == Series.id)
            .join(Genre, Genre.id == series_genres.c.genre_id)
            .where(Genre.slug == genre_slug)
        )
    if with_banner:
        stmt = stmt.where(Series.banner_url.is_not(None), Series.banner_url != "")
    if cursor is not None:
        after = _parse_cursor_value(sort, cursor.value)
        stmt = stmt.where(tuple_(key, Series.id) < (after, cursor.id))
    return stmt.order_by(key.desc(), Series.id.desc()).limit(limit + 1)


def _cursor_value(value: datetime | int) -> str:
    return value.isoformat() if isinstance(value, datetime) else str(value)


async def list_series(
    db: AsyncSession,
    *,
    sort: SeriesSort = "new",
    genre_slug: str | None = None,
    with_banner: bool = False,
    limit: int = 20,
    cursor: str | None = None,
) -> tuple[list[Series], str | None]:
    """Một trang series và con trỏ của trang sau (None nếu đã hết)."""
    after = SeriesCursor.decode(cursor, sort=sort) if cursor else None
    stmt = series_list_stmt(
        sort=sort, genre_slug=genre_slug, with_banner=with_banner, limit=limit, cursor=after
    ).options(selectinload(Series.genres))
    rows = list((await db.execute(stmt)).unique().all())

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        last, last_key = rows[-1]
        next_cursor = SeriesCursor(sort=sort, value=_cursor_value(last_key), id=last.id).encode()
    return [series for series, _ in rows], next_cursor


# --- Tìm kiếm ---

SEARCH_MIN_LENGTH = 2
SEARCH_MAX_LENGTH = 100


async def search_series(db: AsyncSession, query: str, *, limit: int = 20) -> list[Series]:
    """Series đã xuất bản có tên chứa từ khóa (không dấu, không phân biệt hoa thường).

    Lọc qua series_search_condition() để dùng index trigram. Sắp theo độ giống tên (tên sát từ
    khóa hơn đứng trước), cùng điểm thì phim mới hơn trước. Chỉ trả trang đầu, không con trỏ.
    """
    stmt = (
        select(Series)
        .where(Series.is_published, series_search_condition(query))
        .order_by(series_search_rank(query).desc(), Series.published_at.desc(), Series.id.desc())
        .limit(limit)
        .options(selectinload(Series.genres))
    )
    return list((await db.execute(stmt)).scalars())


# --- Chi tiết phim và danh sách tập ---


@dataclass(frozen=True)
class SeriesDetailData:
    series: Series
    episode_count: int  # chỉ tập đã xuất bản
    latest_episode_number: int | None
    view_count: int


async def _find_series(db: AsyncSession, slug: str, *, include_unpublished: bool) -> Series | None:
    """Series theo slug. Đã xóa mềm thì luôn ẩn (kể cả admin: xem ở thùng rác trang admin)."""
    stmt = select(Series).where(Series.slug == slug).options(selectinload(Series.genres))
    if not include_unpublished:
        stmt = stmt.where(Series.is_published)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_series_detail(
    db: AsyncSession, slug: str, *, include_unpublished: bool = False
) -> SeriesDetailData | None:
    """None khi không có, đã xóa, hoặc chưa xuất bản (trừ khi admin xem trước)."""
    series = await _find_series(db, slug, include_unpublished=include_unpublished)
    if series is None:
        return None
    count, latest = (
        await db.execute(
            select(func.count(), func.max(Episode.number)).where(
                Episode.series_id == series.id, Episode.is_published
            )
        )
    ).one()
    views = await db.scalar(
        select(SeriesStats.view_count).where(SeriesStats.series_id == series.id)
    )
    return SeriesDetailData(
        series=series, episode_count=count, latest_episode_number=latest, view_count=views or 0
    )


async def list_episodes(
    db: AsyncSession, slug: str, *, include_unpublished: bool = False
) -> list[Episode] | None:
    """Các tập theo số tăng dần; None khi series không xem được (để trả 404).

    Ẩn "theo cha": tập của series chưa xuất bản/đã xóa không lộ ra dù bản thân tập đã xuất bản.
    """
    series = await _find_series(db, slug, include_unpublished=include_unpublished)
    if series is None:
        return None
    stmt = select(Episode).where(Episode.series_id == series.id).order_by(Episode.number)
    if not include_unpublished:
        stmt = stmt.where(Episode.is_published)
    return list((await db.execute(stmt)).scalars())
