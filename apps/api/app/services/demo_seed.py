"""Dữ liệu mẫu cho dev: đủ các trường hợp để làm frontend khi chưa có phim thật.

Chạy: `uv run python -m app.cli seed-demo`. Từ chối chạy khi ENV=prod. Chạy lại không tạo trùng
(bỏ qua thể loại/phim đã có slug, kể cả bản đã xóa mềm). Tên phim là tên tự đặt.

Các trường hợp có trong dữ liệu:
- Phim có/không banner, đang chiếu/hoàn thành, nhiều thể loại, lượt xem khác nhau (cho "hot").
- Mỗi phim vài tập: 2 tập đầu miễn phí, còn lại VIP; vài phim có tập cuối chưa xuất bản
  (video đang xử lý).
- Một phim chưa xuất bản (chỉ admin xem trước được) và một phim đã xóa mềm (không ai thấy).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Episode, Genre, Series, SeriesStats, series_genres
from app.models.enums import SeriesStatus, StreamStatus
from app.models.soft_delete import INCLUDE_DELETED
from app.services.audit import Actor
from app.services.soft_delete import soft_delete


class DemoSeedRefusedError(Exception):
    """Không được chạy ở môi trường này (prod)."""


GENRES = [
    ("tinh-cam", "Tình cảm"),
    ("hai", "Hài"),
    ("hanh-dong", "Hành động"),
    ("co-trang", "Cổ trang"),
    ("tam-ly", "Tâm lý"),
    ("gia-dinh", "Gia đình"),
]


@dataclass(frozen=True)
class DemoSeries:
    slug: str
    title: str
    genres: tuple[str, ...]
    episodes: int
    views: int
    banner: bool = False
    completed: bool = False
    draft_last_episode: bool = False  # tập cuối chưa xuất bản (video đang xử lý)
    published: bool = True
    deleted: bool = False


SERIES = [
    DemoSeries("hen-uoc-mua-thu", "Hẹn Ước Mùa Thu", ("tinh-cam", "tam-ly"), 12, 5200, banner=True),
    DemoSeries("chang-trai-ben-song", "Chàng Trai Bên Sông", ("tinh-cam",), 8, 3100, banner=True),
    DemoSeries(
        "nha-co-bon-chi-em", "Nhà Có Bốn Chị Em", ("gia-dinh", "hai"), 10, 8700, completed=True
    ),
    DemoSeries(
        "kiem-khach-phuong-nam",
        "Kiếm Khách Phương Nam",
        ("co-trang", "hanh-dong"),
        9,
        4400,
        banner=True,
        draft_last_episode=True,
    ),
    DemoSeries("cuoi-di-dung-ngai", "Cười Đi Đừng Ngại", ("hai",), 6, 950),
    DemoSeries(
        "bi-mat-phong-tro", "Bí Mật Phòng Trọ", ("tam-ly", "hai"), 7, 2200, draft_last_episode=True
    ),
    DemoSeries(
        "ve-nha-an-tet", "Về Nhà Ăn Tết", ("gia-dinh",), 5, 12000, completed=True, banner=True
    ),
    DemoSeries("duong-dua-dem", "Đường Đua Đêm", ("hanh-dong",), 8, 0),
    DemoSeries("cung-dien-anh-trang", "Cung Điện Ánh Trăng", ("co-trang", "tinh-cam"), 11, 6100),
    DemoSeries(
        "ban-than-hay-nguoi-yeu",
        "Bạn Thân Hay Người Yêu",
        ("tinh-cam", "hai"),
        6,
        1500,
        completed=True,
    ),
    DemoSeries("phim-sap-chieu", "Phim Sắp Chiếu", ("tam-ly",), 3, 0, published=False),
    DemoSeries("phim-da-go", "Phim Đã Gỡ", ("hai",), 2, 300, deleted=True),
]

FREE_EPISODES = 2


@dataclass(frozen=True)
class SeedResult:
    genres_created: int
    series_created: int
    series_skipped: int
    episodes_created: int


def _image(kind: str, slug: str, size: str) -> str:
    # Ảnh giữ chỗ cho dev (dịch vụ ảnh ngẫu nhiên theo seed). Ảnh thật lưu ở R2 (Giai đoạn 4).
    return f"https://picsum.photos/seed/{kind}-{slug}/{size}"


async def seed_demo(db: AsyncSession) -> SeedResult:
    """Thêm dữ liệu mẫu còn thiếu. Không commit: người gọi commit."""
    if get_settings().env == "prod":
        raise DemoSeedRefusedError("Không chạy seed-demo ở ENV=prod")

    now = await db.scalar(select(func.now()))
    include_deleted = {INCLUDE_DELETED: True}

    genre_ids: dict[str, int] = {}
    genres_created = 0
    for slug, name in GENRES:
        genre = (
            await db.execute(
                select(Genre).where(Genre.slug == slug).execution_options(**include_deleted)
            )
        ).scalar_one_or_none()
        if genre is None:
            genre = Genre(slug=slug, name=name)
            db.add(genre)
            await db.flush()
            genres_created += 1
        genre_ids[slug] = genre.id

    series_created = series_skipped = episodes_created = 0
    for index, demo in enumerate(SERIES):
        exists = await db.scalar(
            select(Series.id).where(Series.slug == demo.slug).execution_options(**include_deleted)
        )
        if exists is not None:
            series_skipped += 1
            continue

        published_at: datetime = now - timedelta(days=index * 3 + 1)
        series = Series(
            slug=demo.slug,
            title=demo.title,
            description=f"{demo.title}: phim mẫu để thử giao diện. Nội dung chỉ để minh họa.",
            poster_url=_image("poster", demo.slug, "400/600"),
            banner_url=_image("banner", demo.slug, "1600/600") if demo.banner else None,
            year=published_at.year,
            country="Việt Nam",
            status=SeriesStatus.COMPLETED if demo.completed else SeriesStatus.ONGOING,
            total_episodes=demo.episodes if demo.completed else demo.episodes + 4,
            is_published=demo.published,
            published_at=published_at if demo.published else None,
        )
        db.add(series)
        await db.flush()
        for slug in demo.genres:
            await db.execute(
                insert(series_genres).values(series_id=series.id, genre_id=genre_ids[slug])
            )
        db.add(SeriesStats(series_id=series.id, view_count=demo.views))

        for number in range(1, demo.episodes + 1):
            is_draft = demo.draft_last_episode and number == demo.episodes
            db.add(
                Episode(
                    series_id=series.id,
                    number=number,
                    title=f"Tập {number}",
                    duration_sec=1200 + (number * 97) % 900,  # 20–35 phút
                    thumbnail_url=_image("thumb", f"{demo.slug}-{number}", "640/360"),
                    stream_video_id=f"demo-{demo.slug}-{number}",  # id giả, không phát được
                    stream_status=StreamStatus.PROCESSING if is_draft else StreamStatus.READY,
                    is_free=number <= FREE_EPISODES,
                    is_published=not is_draft,
                    published_at=None if is_draft else published_at + timedelta(hours=number),
                )
            )
            episodes_created += 1
        await db.flush()

        if demo.deleted:
            await soft_delete(db, series, actor=Actor.system(), reason="Dữ liệu mẫu: phim đã gỡ")
        series_created += 1

    return SeedResult(genres_created, series_created, series_skipped, episodes_created)
