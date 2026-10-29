"""Ràng buộc và hiệu năng ghi của nhóm hoạt động (watch_history, favorites)."""

import pytest
from alembic import command
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Episode, Favorite, Series, User, WatchHistory
from app.models.mixins import DeletedAtMixin, SoftDeleteMixin
from app.models.soft_delete import INCLUDE_DELETED
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


# --- xóa mềm (migration 0011) ---------------------------------------------------


def hot_counts(db: Session) -> tuple[int, int]:
    return tuple(
        db.execute(
            text(
                "SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_xact_user_tables "
                "WHERE relname = 'watch_history'"
            )
        ).one()
    )


def test_activity_models_use_light_soft_delete():
    """Có deleted_at và bộ lọc tự động, nhưng không phải xóa mềm kiểu admin (deleted_by_id)."""
    for model in (WatchHistory, Favorite):
        assert issubclass(model, DeletedAtMixin)
        assert not issubclass(model, SoftDeleteMixin)
        assert "deleted_by_id" not in model.__table__.c
    assert issubclass(SoftDeleteMixin, DeletedAtMixin)


def test_deleted_history_hidden_from_orm(db: Session, user: User, episode: Episode):
    db.execute(upsert_progress_stmt(user.id, episode.id, 30))
    db.execute(text("UPDATE watch_history SET deleted_at = now()"))
    db.expire_all()
    assert db.scalars(select(WatchHistory)).all() == []
    assert db.get(WatchHistory, (user.id, episode.id)) is None
    found = db.scalars(select(WatchHistory).execution_options(**{INCLUDE_DELETED: True})).all()
    assert [(f.progress_sec, f.is_deleted) for f in found] == [(30, True)]


def test_deleted_favorite_hidden_from_orm(db: Session, user: User, series: Series):
    db.add(Favorite(user_id=user.id, series_id=series.id))
    db.flush()
    db.execute(text("UPDATE favorites SET deleted_at = now()"))
    db.expire_all()
    assert db.scalars(select(Favorite)).all() == []
    found = db.scalars(select(Favorite).execution_options(**{INCLUDE_DELETED: True})).all()
    assert len(found) == 1 and found[0].is_deleted


def test_watching_again_restores_deleted_row(db: Session, user: User, episode: Episode):
    db.execute(upsert_progress_stmt(user.id, episode.id, 30))
    db.execute(text("UPDATE watch_history SET deleted_at = now()"))
    db.execute(upsert_progress_stmt(user.id, episode.id, 45))
    db.expire_all()
    row = db.get(WatchHistory, (user.id, episode.id))
    assert row is not None and row.deleted_at is None and row.progress_sec == 45
    # Vẫn đúng một dòng (dùng lại dòng cũ, không chèn dòng mới).
    count = select(func.count()).select_from(WatchHistory)
    assert db.scalar(count.execution_options(**{INCLUDE_DELETED: True})) == 1


def test_soft_delete_and_restore_are_hot(db: Session, user: User, episode: Episode):
    """Xóa mềm (đặt deleted_at) và xem lại (đặt NULL) cũng không sửa index."""
    db.execute(upsert_progress_stmt(user.id, episode.id, 0))
    db.execute(text("UPDATE watch_history SET deleted_at = now()"))
    db.execute(upsert_progress_stmt(user.id, episode.id, 15))
    upd, hot = hot_counts(db)
    assert upd == 2
    assert hot == upd


def test_no_index_on_deleted_at(db: Session):
    insp = inspect(db.get_bind())
    for table in ("watch_history", "favorites"):
        indexed = {col for ix in insp.get_indexes(table) for col in ix["column_names"]}
        assert "deleted_at" not in indexed, table


def test_downgrade_0011_removes_soft_delete(migrated_db_url: str, db: Session):
    db.close()
    command.downgrade(alembic_config(), "0010")
    insp = inspect(db.get_bind())
    for table in ("watch_history", "favorites"):
        assert "deleted_at" not in {c["name"] for c in insp.get_columns(table)}
    with db.get_bind().connect() as conn:
        triggers = conn.scalar(
            text(
                "SELECT count(*) FROM pg_trigger "
                "WHERE tgname LIKE 'trg_watch_history_%' OR tgname LIKE 'trg_favorites_%'"
            )
        )
        assert triggers == 0
    command.upgrade(alembic_config(), "head")
    insp = inspect(db.get_bind())
    assert "deleted_at" in {c["name"] for c in insp.get_columns("watch_history")}
