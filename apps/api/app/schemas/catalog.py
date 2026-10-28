"""Dữ liệu catalog trả cho client. Cùng một nội dung cho mọi người xem (cache được)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models import Episode


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


class SearchResult(BaseModel):
    """Kết quả tìm kiếm: chỉ trang đầu (tối đa 50), không có con trỏ."""

    items: list[SeriesCard]


class SeriesDetail(SeriesCard):
    """Trang chi tiết phim. Số tập chỉ tính tập đã xuất bản."""

    description: str | None
    episode_count: int
    latest_episode_number: int | None
    view_count: int
    # Luôn true với người thường; admin xem trước phim nháp thì thấy false.
    is_published: bool


class EpisodeOut(BaseModel):
    """Một tập trong danh sách. Không bao giờ có id video (chỉ `play` mới cấp đường phát)."""

    id: int
    number: int
    title: str | None
    duration_sec: int | None
    thumbnail_url: str | None
    # "free": ai đăng nhập cũng xem được; "vip": cần gói VIP còn hạn. Frontend ghép với
    # `/me.is_vip` để hiện ổ khóa (catalog trả cùng nội dung cho mọi người).
    access: Literal["free", "vip"]
    published_at: datetime | None
    # Luôn true với người thường; admin xem trước thì thấy cả tập chưa xuất bản (false).
    is_published: bool

    @classmethod
    def of(cls, ep: Episode) -> "EpisodeOut":
        return cls(
            id=ep.id,
            number=ep.number,
            title=ep.title,
            duration_sec=ep.duration_sec,
            thumbnail_url=ep.thumbnail_url,
            access="free" if ep.is_free else "vip",
            published_at=ep.published_at,
            is_published=ep.is_published,
        )
