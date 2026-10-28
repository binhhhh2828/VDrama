"""Ràng buộc DB của nhóm tài khoản (users, sessions, email_tokens).

Kiểm tra quy tắc nằm ở tầng DB, nên đúng kể cả khi code ứng dụng có lỗi.
"""

from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import EmailToken, User, UserSession
from app.tests.conftest import alembic_config, hard_delete

LATER = datetime.now(UTC) + timedelta(days=30)


def make_user(db: Session, email: str = "a@example.com", **kw) -> User:
    user = User(email=email, password_hash="x", display_name="A", **kw)
    db.add(user)
    db.flush()
    return user


def make_session(db: Session, user: User, token: str = "h1") -> UserSession:
    s = UserSession(user_id=user.id, refresh_token_hash=token, expires_at=LATER)
    db.add(s)
    db.flush()
    return s


def test_user_defaults(db: Session):
    user = make_user(db)
    db.refresh(user)
    assert user.role == "user"
    assert user.is_active is True
    assert user.created_at is not None and user.created_at.tzinfo is not None
    assert user.email_verified_at is None


def test_email_unique_case_insensitive(db: Session):
    make_user(db, "Binh@Example.com")
    with pytest.raises(IntegrityError, match="uq_users_email_lower"):
        make_user(db, "binh@example.COM")


def test_email_lookup_uses_lower_index(db: Session):
    make_user(db, "Binh@Example.com")
    found = db.scalar(select(User).where(func.lower(User.email) == "binh@example.com"))
    assert found is not None


def test_invalid_role_rejected(db: Session):
    with pytest.raises(IntegrityError, match="ck_users_role"):
        make_user(db, role="superadmin")


def test_updated_at_changes_on_update(db: Session):
    user = make_user(db)
    db.commit()
    before = user.updated_at
    db.execute(text("SELECT pg_sleep(0.01)"))
    user.display_name = "B"
    db.commit()
    db.refresh(user)
    assert user.updated_at > before


def test_session_id_generated_by_db(db: Session):
    s = make_session(db, make_user(db))
    db.refresh(s)
    assert s.id is not None
    assert s.revoked_at is None and s.last_seen_at is not None


def test_refresh_token_hash_unique(db: Session):
    user = make_user(db)
    make_session(db, user, "same")
    with pytest.raises(IntegrityError, match="uq_sessions_refresh_token_hash"):
        make_session(db, user, "same")


def test_session_ip_is_inet(db: Session):
    user = make_user(db)
    s = UserSession(user_id=user.id, refresh_token_hash="h", expires_at=LATER, ip="not-an-ip")
    db.add(s)
    with pytest.raises(Exception, match="inet"):
        db.flush()


def test_session_rotation_columns_go_together(db: Session):
    """previous_refresh_token_hash và rotated_at cùng NULL hoặc cùng có giá trị (migration 0010)."""
    user = make_user(db)
    now = datetime.now(UTC)
    for kw in ({"previous_refresh_token_hash": "old"}, {"rotated_at": now}):
        db.add(UserSession(user_id=user.id, refresh_token_hash="h", expires_at=LATER, **kw))
        with pytest.raises(IntegrityError, match="ck_sessions_rotation_pair"):
            db.flush()
        db.rollback()
        user = make_user(db)
    s = make_session(db, user, "new")
    s.previous_refresh_token_hash, s.rotated_at = "old", now
    db.flush()


def test_previous_refresh_token_hash_unique(db: Session):
    user = make_user(db)
    now = datetime.now(UTC)
    for token in ("a", "b"):
        db.add(
            UserSession(
                user_id=user.id,
                refresh_token_hash=token,
                previous_refresh_token_hash="same",
                rotated_at=now,
                expires_at=LATER,
            )
        )
    with pytest.raises(IntegrityError, match="uq_sessions_previous_refresh_token_hash"):
        db.flush()


def test_new_user_columns_default_null(db: Session):
    user = make_user(db)
    db.refresh(user)
    assert user.terms_accepted_at is None
    assert user.vip_expires_at is None


def test_vip_expires_at_partial_index(db: Session):
    """Index chỉ chứa user đã từng mua VIP (job nhắc hạn), không phình theo số user."""
    indexdef = db.scalar(
        text("SELECT indexdef FROM pg_indexes WHERE indexname = 'ix_users_vip_expires_at'")
    )
    assert indexdef is not None
    assert "WHERE (vip_expires_at IS NOT NULL)" in indexdef


def test_invalid_email_token_purpose_rejected(db: Session):
    user = make_user(db)
    db.add(EmailToken(user_id=user.id, purpose="login", token_hash="t", expires_at=LATER))
    with pytest.raises(IntegrityError, match="ck_email_tokens_purpose"):
        db.flush()


def test_email_token_hash_unique(db: Session):
    user = make_user(db)
    for _ in range(2):
        token = EmailToken(
            user_id=user.id, purpose="verify_email", token_hash="t", expires_at=LATER
        )
        db.add(token)
    with pytest.raises(IntegrityError, match="uq_email_tokens_token_hash"):
        db.flush()


def test_deleting_user_cascades_sessions_and_tokens(db: Session):
    user = make_user(db)
    make_session(db, user)
    db.add(EmailToken(user_id=user.id, purpose="reset_password", token_hash="t", expires_at=LATER))
    db.commit()

    hard_delete(db, "users", user.id)
    db.commit()

    assert db.scalar(select(func.count()).select_from(UserSession)) == 0
    assert db.scalar(select(func.count()).select_from(EmailToken)) == 0


def test_every_foreign_key_is_indexed(db: Session):
    """Postgres không tự index khóa ngoại; thiếu index làm cascade/join chậm khi bảng lớn."""
    insp = inspect(db.get_bind())
    missing = []
    for table in insp.get_table_names():
        indexed = {tuple(ix["column_names"]) for ix in insp.get_indexes(table)}
        indexed |= {tuple(uc["column_names"]) for uc in insp.get_unique_constraints(table)}
        indexed.add(tuple(insp.get_pk_constraint(table)["constrained_columns"]))
        for fk in insp.get_foreign_keys(table):
            cols = tuple(fk["constrained_columns"])
            if not any(ix[: len(cols)] == cols for ix in indexed):
                missing.append(f"{table}{cols}")
    assert not missing, f"Khóa ngoại thiếu index: {missing}"


def test_downgrade_to_0001_drops_account_tables(migrated_db_url: str, db: Session):
    db.close()
    command.downgrade(alembic_config(), "0001")
    tables = set(inspect(db.get_bind()).get_table_names())
    assert not {"users", "sessions", "email_tokens"} & tables
