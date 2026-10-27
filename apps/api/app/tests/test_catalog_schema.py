"""Ràng buộc DB, tìm kiếm không dấu và việc dùng index của nhóm catalog."""

from datetime import UTC, datetime

import pytest
from alembic import command
from sqlalchemy import func, insert, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Episode, Genre, Series, SeriesStats, series_genres
from app.services.search import series_search_condition
from app.tests.conftest import alembic_config, hard_delete

NOW = datetime.now(UTC)


def make_series(db: Session, slug: str = "nang-tho", title: str = "Nàng Thơ", **kw) -> Series:
    series = Series(slug=slug, title=title, **kw)
    db.add(series)
    db.flush()
    return series


def make_episode(db: Session, series: Series, number: int = 1, **kw) -> Episode:
    ep = Episode(series_id=series.id, number=number, **kw)
    db.add(ep)
    db.flush()
    return ep


def search(db: Session, q: str) -> list[str]:
    return list(db.scalars(select(Series.title).where(series_search_condition(q))))


def explain(db: Session, sql: str, *, allow_bitmap: bool = True, **params) -> str:
    """Kế hoạch truy vấn khi cấm quét tuần tự: chứng minh index dùng được cho truy vấn đó
    (bảng test quá nhỏ nên bình thường Postgres sẽ chọn quét tuần tự)."""
    db.execute(text("SET LOCAL enable_seqscan = off"))
    if not allow_bitmap:
        # Quét bitmap không giữ thứ tự index; tắt đi để kiểm tra index tự trả đúng thứ tự.
        db.execute(text("SET LOCAL enable_bitmapscan = off"))
    rows = db.execute(text(f"EXPLAIN {sql}"), params)
    return "\n".join(r[0] for r in rows)


# --- series -----------------------------------------------------------------


def test_series_defaults(db: Session):
    s = make_series(db)
    db.refresh(s)
    assert s.status == "ongoing"
    assert s.is_published is False


def test_series_slug_unique(db: Session):
    make_series(db, "a")
    with pytest.raises(IntegrityError, match="uq_series_slug"):
        make_series(db, "a", "Khác")


def test_series_invalid_status_rejected(db: Session):
    with pytest.raises(IntegrityError, match="ck_series_status"):
        make_series(db, status="paused")


def test_published_series_requires_published_at(db: Session):
    with pytest.raises(IntegrityError, match="ck_series_published_at_set"):
        make_series(db, is_published=True)


def test_search_text_is_generated(db: Session):
    s = make_series(db, title="Đảo Hoang Mùa Hạ")
    db.refresh(s)
    assert s.search_text == "dao hoang mua ha"


# --- tìm kiếm ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("query", "found"),
    [
        ("nang tho", True),
        ("NÀNG THƠ", True),
        ("Nàng", True),
        ("tho", True),
        ("dao hoang", True),  # Đ → d
        ("không có", False),
        ("%", False),  # ký tự đặc biệt của LIKE bị escape, không khớp tất cả
    ],
)
def test_search_without_diacritics(db: Session, query: str, found: bool):
    make_series(db, "nang-tho", "Nàng Thơ")
    make_series(db, "dao-hoang", "Đảo Hoang")
    assert bool(search(db, query)) is found


def test_search_uses_trigram_index(db: Session):
    make_series(db)
    plan = explain(
        db,
        "SELECT id FROM series WHERE search_text ILIKE '%' || lower(immutable_unaccent(:q)) || '%'",
        q="nang",
    )
    assert "ix_series_search_text_trgm" in plan


def test_published_listing_uses_keyset_index(db: Session):
    plan = explain(
        db,
        "SELECT id FROM series WHERE is_published "
        "AND (published_at, id) < (:at, :id) ORDER BY published_at DESC, id DESC LIMIT 20",
        allow_bitmap=False,
        at=NOW,
        id=10**9,
    )
    assert "ix_series_published" in plan
    assert "Sort" not in plan  # thứ tự lấy thẳng từ index, không phải sắp xếp lại


# --- episodes ---------------------------------------------------------------


def test_episode_number_unique_per_series(db: Session):
    a, b = make_series(db, "a"), make_series(db, "b")
    make_episode(db, a, 1)
    make_episode(db, b, 1)  # khác series thì được
    with pytest.raises(IntegrityError, match="uq_episodes_series_id_number"):
        make_episode(db, a, 1)


@pytest.mark.parametrize(
    ("kw", "constraint"),
    [
        ({"number": 0}, "ck_episodes_number_positive"),
        ({"duration_sec": -1}, "ck_episodes_duration_sec"),
        ({"stream_status": "done"}, "ck_episodes_stream_status"),
    ],
)
def test_episode_checks(db: Session, kw: dict, constraint: str):
    s = make_series(db)
    kw.setdefault("number", 1)
    with pytest.raises(IntegrityError, match=constraint):
        make_episode(db, s, **kw)


def test_stream_video_id_unique_but_nullable(db: Session):
    s = make_series(db)
    make_episode(db, s, 1)
    make_episode(db, s, 2)  # nhiều tập chưa có video (NULL) vẫn được
    make_episode(db, s, 3, stream_video_id="cf-abc")
    with pytest.raises(IntegrityError, match="uq_episodes_stream_video_id"):
        make_episode(db, s, 4, stream_video_id="cf-abc")


@pytest.mark.parametrize("stream_status", ["none", "processing", "error"])
def test_cannot_publish_episode_without_ready_video(db: Session, stream_status: str):
    s = make_series(db)
    with pytest.raises(IntegrityError, match="ck_episodes_publish_requires_ready"):
        make_episode(db, s, is_published=True, published_at=NOW, stream_status=stream_status)


def test_publish_ready_episode(db: Session):
    s = make_series(db)
    ep = make_episode(db, s, is_published=True, published_at=NOW, stream_status="ready")
    assert ep.id is not None


# --- xóa --------------------------------------------------------------------


def test_cannot_delete_series_with_episodes(db: Session):
    s = make_series(db)
    make_episode(db, s)
    db.commit()
    with pytest.raises(IntegrityError, match="fk_episodes_series_id_series"):
        hard_delete(db, "series", s.id)


def test_deleting_series_cascades_stats_and_genres(db: Session):
    s = make_series(db)
    g = Genre(slug="tinh-cam", name="Tình cảm")
    db.add_all([g, SeriesStats(series_id=s.id)])
    db.flush()
    db.execute(insert(series_genres).values(series_id=s.id, genre_id=g.id))
    db.commit()

    hard_delete(db, "series", s.id)
    db.commit()
    assert db.scalar(select(func.count()).select_from(SeriesStats)) == 0
    assert db.scalar(select(func.count()).select_from(series_genres)) == 0
    assert db.get(Genre, g.id) is not None  # thể loại vẫn còn


def test_deleting_genre_cascades_links(db: Session):
    s = make_series(db)
    g = Genre(slug="hanh-dong", name="Hành động")
    s.genres.append(g)
    db.commit()
    hard_delete(db, "genres", g.id)
    db.commit()
    db.refresh(s)
    assert s.genres == []


def test_genre_slug_unique(db: Session):
    db.add_all([Genre(slug="x", name="X"), Genre(slug="x", name="Y")])
    with pytest.raises(IntegrityError, match="uq_genres_slug"):
        db.flush()


def test_series_stats_defaults_and_non_negative(db: Session):
    s = make_series(db)
    stats = SeriesStats(series_id=s.id)
    db.add(stats)
    db.flush()
    db.refresh(stats)
    assert (stats.view_count, stats.favorite_count) == (0, 0)
    stats.view_count = -1
    with pytest.raises(IntegrityError, match="ck_series_stats_non_negative"):
        db.flush()


# --- migration --------------------------------------------------------------


def test_downgrade_to_0002_drops_catalog(migrated_db_url: str, db: Session):
    db.close()
    command.downgrade(alembic_config(), "0002")
    bind = db.get_bind()
    tables = set(inspect(bind).get_table_names())
    assert not {"series", "series_stats", "genres", "series_genres", "episodes"} & tables
    with bind.connect() as conn:
        fn = conn.scalar(text("SELECT count(*) FROM pg_proc WHERE proname = 'immutable_unaccent'"))
    assert fn == 0
