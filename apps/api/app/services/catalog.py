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

from sqlalchemy import Select, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Genre, Series, series_genres

SeriesSort = Literal["new"]


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


def series_list_stmt(
    *,
    sort: SeriesSort = "new",
    genre_slug: str | None = None,
    with_banner: bool = False,
    limit: int = 20,
    cursor: SeriesCursor | None = None,
) -> Select:
    """Câu truy vấn danh sách series (tách riêng để test kiểm tra được kế hoạch truy vấn)."""
    # Viết `WHERE is_published` (không phải `IS true`): index một phần ix_series_published khai
    # báo điều kiện `WHERE is_published`, Postgres không suy ra được từ `IS true` nên bỏ qua index.
    stmt = select(Series).where(Series.is_published)
    if genre_slug is not None:
        # Thể loại đã xóa mềm bị bộ lọc ORM loại khỏi phép join, nên lọc theo nó trả rỗng.
        stmt = (
            stmt.join(series_genres, series_genres.c.series_id == Series.id)
            .join(Genre, Genre.id == series_genres.c.genre_id)
            .where(Genre.slug == genre_slug)
        )
    if with_banner:
        stmt = stmt.where(Series.banner_url.is_not(None), Series.banner_url != "")

    # sort == "new": khớp index ix_series_published (published_at DESC, id DESC).
    if cursor is not None:
        try:
            after = datetime.fromisoformat(cursor.value)
        except ValueError as exc:
            raise InvalidCursorError("Con trỏ không hợp lệ") from exc
        stmt = stmt.where(tuple_(Series.published_at, Series.id) < (after, cursor.id))
    return stmt.order_by(Series.published_at.desc(), Series.id.desc()).limit(limit + 1)


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
    rows = list((await db.execute(stmt)).scalars().unique())

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        last = rows[-1]
        next_cursor = SeriesCursor(
            sort=sort, value=last.published_at.isoformat(), id=last.id
        ).encode()
    return rows, next_cursor
