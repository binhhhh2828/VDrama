"""Ràng buộc và hiệu năng ghi của nhóm hoạt động (watch_history, favorites)."""

import pytest
from alembic import command
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Episode, Favorite, Series, User, WatchHistory
from app.services.activity import upsert_progress_stmt
from app.tests.conftest import alembic_config, hard_delete


@pytest.fixture
def user(db: Session) -> User:
    u = User(email="xem@example.com", password_hash="x", display_name="X")
    db.add(u)
    db.flush()
    return u


@pytest.fixture
def series(db: Session) -> Series:
    s = Series(slug="nang-tho", title="Nàng Thơ")
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def episode(db: Session, series: Series) -> Episode:
    e = Episode(series_id=series.id, number=1)
    db.add(e)
    db.flush()
    return e


def history_rows(db: Session) -> list[tuple[int, int, int]]:
    rows = db.execute(
        select(WatchHistory.user_id, WatchHistory.episode_id, WatchHistory.progress_sec)
    )
    return [tuple(r) for r in rows]


# --- watch_history ----------------------------------------------------------


def test_upsert_keeps_one_row_per_user_episode(db: Session, user: User, episode: Episode):
    for progress in (15, 30, 45):
        db.execute(upsert_progress_stmt(user.id, episode.id, progress))
    assert history_rows(db) == [(user.id, episode.id, 45)]


def test_upsert_clamps_negative_progress(db: Session, user: User, episode: Episode):
    db.execute(upsert_progress_stmt(user.id, episode.id, -5))
    assert history_rows(db) == [(user.id, episode.id, 0)]


def test_negative_progress_rejected_by_db(db: Session, user: User, episode: Episode):
    db.add(WatchHistory(user_id=user.id, episode_id=episode.id, progress_sec=-1))
    with pytest.raises(IntegrityError, match="ck_watch_history_progress_non_negative"):
        db.flush()


def test_progress_updates_are_hot(db: Session, user: User, episode: Episode):
    """Báo tiến độ phải là HOT update (không sửa index): bảng ghi nhiều nhất nên quan trọng nhất.

    Nếu sau này ai đó thêm index trên progress_sec/updated_at, test này sẽ báo.
    """
    db.execute(upsert_progress_stmt(user.id, episode.id, 0))
    for progress in range(15, 15 * 21, 15):
        db.execute(upsert_progress_stmt(user.id, episode.id, progress))
    upd, hot = db.execute(
        text(
            "SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_xact_user_tables "
            "WHERE relname = 'watch_history'"
        )
    ).one()
    assert upd == 20
    assert hot == upd


def test_watch_history_fillfactor(db: Session):
    opts = db.scalar(text("SELECT reloptions FROM pg_class WHERE relname = 'watch_history'"))
    assert "fillfactor=70" in opts


def test_continue_watching_uses_primary_key(db: Session):
    db.execute(text("SET LOCAL enable_seqscan = off"))
    plan = "\n".join(
        r[0]
        for r in db.execute(
            text(
                "EXPLAIN SELECT episode_id, progress_sec FROM watch_history "
                "WHERE user_id = :uid ORDER BY updated_at DESC LIMIT 20"
            ),
            {"uid": 1},
        )
    )
    assert "pk_watch_history" in plan


def test_deleting_user_or_episode_cascades_history(db: Session, user: User, series: Series):
    e1 = Episode(series_id=series.id, number=1)
    e2 = Episode(series_id=series.id, number=2)
    db.add_all([e1, e2])
    db.flush()
    db.execute(upsert_progress_stmt(user.id, e1.id, 10))
    db.execute(upsert_progress_stmt(user.id, e2.id, 10))
    db.commit()

    hard_delete(db, "episodes", e1.id)
    assert [r[1] for r in history_rows(db)] == [e2.id]
    hard_delete(db, "users", user.id)
    assert history_rows(db) == []


# --- favorites --------------------------------------------------------------


def test_favorite_once_per_series(db: Session, user: User, series: Series):
    db.add(Favorite(user_id=user.id, series_id=series.id))
    db.flush()
    db.expunge_all()
    db.add(Favorite(user_id=user.id, series_id=series.id))
    with pytest.raises(IntegrityError, match="pk_favorites"):
        db.flush()


def test_deleting_series_or_user_cascades_favorites(db: Session, user: User, series: Series):
    other = Series(slug="khac", title="Khác")
    db.add(other)
    db.flush()
    db.add_all(
        [
            Favorite(user_id=user.id, series_id=series.id),
            Favorite(user_id=user.id, series_id=other.id),
        ]
    )
    db.commit()

    hard_delete(db, "series", series.id)
    assert db.scalar(select(func.count()).select_from(Favorite)) == 1
    hard_delete(db, "users", user.id)
    assert db.scalar(select(func.count()).select_from(Favorite)) == 0


# --- migration --------------------------------------------------------------


def test_downgrade_to_0005_drops_activity_tables(migrated_db_url: str, db: Session):
    db.close()
    command.downgrade(alembic_config(), "0005")
    tables = set(inspect(db.get_bind()).get_table_names())
    assert not {"watch_history", "favorites"} & tables
    assert "payments" in tables
