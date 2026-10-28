"""Dữ liệu catalog trả cho client. Cùng một nội dung cho mọi người xem (cache được)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str


class SeriesCard(BaseModel):
    """Một phim trong danh sách (trang chủ, thể loại, tìm kiếm)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    poster_url: str | None
    banner_url: str | None
    year: int | None
    country: str | None
    status: str
    total_episodes: int | None
    published_at: datetime | None
    genres: list[GenreOut]


class SeriesPage(BaseModel):
    items: list[SeriesCard]
    # Truyền lại vào `cursor` để lấy trang sau; null là đã hết.
    next_cursor: str | None
