"""Dữ liệu mẫu cho dev và demo: đủ các trường hợp để làm frontend khi chưa có phim thật.

Chạy: `DEMO_PASSWORD=... uv run python -m app.cli seed-demo`. Từ chối chạy khi ENV=prod. Chạy lại
không tạo trùng (bỏ qua thể loại/phim/gói/tài khoản đã có, kể cả bản đã xóa mềm). Nội dung tiếng Anh
cho khớp giao diện (thị trường quốc tế); tên phim là tên tự đặt.

Các trường hợp có trong dữ liệu:
- Phim có/không banner, đang chiếu/hoàn thành, nhiều thể loại, lượt xem khác nhau (cho "hot").
- Mỗi phim vài tập: 2 tập đầu miễn phí, còn lại VIP; vài phim có tập cuối chưa xuất bản
  (video đang xử lý).
- Một phim chưa xuất bản (chỉ admin xem trước được) và một phim đã xóa mềm (không ai thấy).
- Gói VIP mẫu.
- Ba tài khoản demo (người xem thường, VIP, admin) khi có mật khẩu (`DEMO_PASSWORD`). Không có
  mật khẩu thì bỏ qua phần tài khoản, không bao giờ tự đặt mật khẩu mặc định.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import Episode, Genre, Series, SeriesStats, User, VipPlan, series_genres
from app.models.enums import SeriesStatus, StreamStatus, UserRole
from app.models.soft_delete import INCLUDE_DELETED
from app.schemas.auth import PASSWORD_MAX, PASSWORD_MIN
from app.services.admin_accounts import create_or_promote_admin, find_by_email_including_deleted
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.services.vip import grant_vip


class DemoSeedRefusedError(Exception):
    """Không được chạy ở môi trường này (prod), hoặc dữ liệu đầu vào không hợp lệ."""


GENRES = [
    ("romance", "Romance"),
    ("comedy", "Comedy"),
    ("action", "Action"),
    ("fantasy", "Fantasy"),
    ("drama", "Drama"),
    ("family", "Family"),
]


@dataclass(frozen=True)
class DemoSeries:
    slug: str
    title: str
    logline: str
    genres: tuple[str, ...]
    episodes: int
    views: int
    banner: bool = False
    completed: bool = False
    draft_last_episode: bool = False  # tập cuối chưa xuất bản (video đang xử lý)
    published: bool = True
    deleted: bool = False


SERIES = [
    DemoSeries(
        "virtual-city",
        "Virtual City",
        "Is love real, or just an algorithm? A lonely coder falls for the AI she built.",
        ("romance", "drama"),
        12,
        5200,
        banner=True,
    ),
    DemoSeries(
        "memories-of-you",
        "Memories of You",
        "She wakes up with no memory of the last five years, and a ring on her finger.",
        ("romance",),
        8,
        3100,
        banner=True,
    ),
    DemoSeries(
        "love-again",
        "Love Again",
        "Four sisters, one family restaurant, and a summer none of them saw coming.",
        ("family", "comedy"),
        10,
        8700,
        completed=True,
    ),
    DemoSeries(
        "parallel-secrets",
        "Parallel Secrets",
        "A detective finds a door to the world where her partner never died.",
        ("fantasy", "action"),
        9,
        4400,
        banner=True,
        draft_last_episode=True,
    ),
    DemoSeries(
        "summer-promise",
        "Summer Promise",
        "Two rival street-food stalls. One very small alley. Zero chance of peace.",
        ("comedy",),
        6,
        950,
    ),
    DemoSeries(
        "behind-the-lights",
        "Behind the Lights",
        "A shy stylist becomes the only person who knows the pop idol's secret.",
        ("drama", "comedy"),
        7,
        2200,
        draft_last_episode=True,
    ),
    DemoSeries(
        "sky-of-memories",
        "Sky of Memories",
        "Coming home for the new year means facing everything he ran away from.",
        ("family",),
        5,
        12000,
        completed=True,
        banner=True,
    ),
    DemoSeries(
        "crack-in-time",
        "Crack in Time",
        "Every night at midnight, one street racer gets ten seconds back.",
        ("action",),
        8,
        0,
    ),
    DemoSeries(
        "faded-moonlight",
        "Faded Moonlight",
        "A palace healer must save the prince who sentenced her family.",
        ("fantasy", "romance"),
        11,
        6100,
    ),
    DemoSeries(
        "twin-destinies",
        "Twin Destinies",
        "Best friends for twenty years. One wedding invitation changes everything.",
        ("romance", "comedy"),
        6,
        1500,
        completed=True,
    ),
    DemoSeries(
        "the-one-in-my-dream",
        "The One in My Dream",
        "Coming soon: a stranger keeps appearing in her dreams, then at her door.",
        ("drama",),
        3,
        0,
        published=False,
    ),
    DemoSeries(
        "removed-pilot",
        "Removed Pilot",
        "A pilot episode that was taken down.",
        ("comedy",),
        2,
        300,
        deleted=True,
    ),
]

FREE_EPISODES = 2


@dataclass(frozen=True)
class DemoPlan:
    name: str
    price_vnd: int
    duration_days: int


PLANS = [
    DemoPlan("VIP Monthly", 99_000, 30),
    DemoPlan("VIP Quarterly", 259_000, 90),
    DemoPlan("VIP Yearly", 899_000, 365),
]


@dataclass(frozen=True)
class DemoAccount:
    email: str
    display_name: str
    role: str
    vip: bool = False


ACCOUNTS = [
    DemoAccount("viewer@example.com", "Demo Viewer", UserRole.USER),
    DemoAccount("vip@example.com", "Demo VIP", UserRole.USER, vip=True),
    DemoAccount("admin@example.com", "Demo Admin", UserRole.ADMIN),
]

SEED_REASON = "Demo data (seed-demo)"


@dataclass(frozen=True)
class SeedResult:
    genres_created: int
    series_created: int
    series_skipped: int
    episodes_created: int
    plans_created: int = 0
    accounts_created: int = 0
    # True: không có mật khẩu nên không tạo tài khoản demo nào.
    accounts_skipped_no_password: bool = False


def _image(kind: str, slug: str, size: str) -> str:
    # Ảnh giữ chỗ cho dev (dịch vụ ảnh ngẫu nhiên theo seed). Ảnh thật lưu ở R2 (Giai đoạn 4).
    return f"https://picsum.photos/seed/{kind}-{slug}/{size}"


async def seed_demo(db: AsyncSession, *, password: str | None = None) -> SeedResult:
    """Thêm dữ liệu mẫu còn thiếu. `password`: mật khẩu chung của tài khoản demo (None: bỏ qua).

    Không commit: người gọi commit.
    """
    if get_settings().env == "prod":
        raise DemoSeedRefusedError("Không chạy seed-demo ở ENV=prod")
    if password is not None and not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        raise DemoSeedRefusedError(f"DEMO_PASSWORD phải dài {PASSWORD_MIN}–{PASSWORD_MAX} ký tự")

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
            description=f"{demo.logline} (Demo series: placeholder content.)",
            poster_url=_image("poster", demo.slug, "400/600"),
            banner_url=_image("banner", demo.slug, "1600/600") if demo.banner else None,
            year=published_at.year,
            country="Vietnam",
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
                    title=f"Episode {number}",
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
            await soft_delete(
                db, series, actor=Actor.system(), reason=f"{SEED_REASON}: removed series"
            )
        series_created += 1

    plans: dict[str, VipPlan] = {}
    plans_created = 0
    for demo_plan in PLANS:
        plan = (
            await db.execute(
                select(VipPlan)
                .where(VipPlan.name == demo_plan.name)
                .execution_options(**include_deleted)
            )
        ).scalar_one_or_none()
        if plan is None:
            plan = VipPlan(
                name=demo_plan.name,
                price_vnd=demo_plan.price_vnd,
                duration_days=demo_plan.duration_days,
            )
            db.add(plan)
            await db.flush()
            plans_created += 1
        plans[demo_plan.name] = plan

    accounts_created = 0
    if password is not None:
        accounts_created = await _seed_accounts(db, password, plans[PLANS[0].name])

    return SeedResult(
        genres_created=genres_created,
        series_created=series_created,
        series_skipped=series_skipped,
        episodes_created=episodes_created,
        plans_created=plans_created,
        accounts_created=accounts_created,
        accounts_skipped_no_password=password is None,
    )


async def _seed_accounts(db: AsyncSession, password: str, vip_plan: VipPlan) -> int:
    """Tạo tài khoản demo còn thiếu. Tài khoản đã có (kể cả đã xóa) thì để nguyên."""
    created = 0
    for account in ACCOUNTS:
        if await find_by_email_including_deleted(db, account.email) is not None:
            continue
        if account.role == UserRole.ADMIN:
            await create_or_promote_admin(
                db,
                email=account.email,
                password=password,
                display_name=account.display_name,
                reason=SEED_REASON,
            )
        else:
            user = User(
                email=account.email,
                password_hash=await hash_password(password),
                display_name=account.display_name,
                role=UserRole.USER,
                terms_accepted_at=func.now(),
                email_verified_at=func.now(),
            )
            db.add(user)
            await db.flush()
            if account.vip:
                # Đi qua services/vip như mọi lần cấp VIP: có subscription, có nhật ký.
                await grant_vip(
                    db, user_id=user.id, plan=vip_plan, actor=Actor.system(), reason=SEED_REASON
                )
        created += 1
    return created
