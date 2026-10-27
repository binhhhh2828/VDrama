"""Nhật ký thao tác (migration 0009): ghi đúng, cùng transaction, bắt buộc lý do, che dữ liệu
nhạy cảm, có request_id; DB không cho sửa hay xóa nhật ký."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core import request_context
from app.core.request_context import REQUEST_ID_HEADER, RequestInfo
from app.models import AuditLog, Series, User, UserSession
from app.models.enums import ActorType
from app.services.audit import (
    REDACTED,
    Actor,
    AuditReasonRequiredError,
    record,
    snapshot,
)
from app.services.soft_delete import restore, soft_delete

NOW = datetime.now(UTC)


async def make_admin(adb: AsyncSession) -> User:
    admin = User(email="admin@example.com", password_hash="x", display_name="Admin", role="admin")
    adb.add(admin)
    await adb.flush()
    return admin


async def make_series(adb: AsyncSession) -> Series:
    s = Series(slug="nang-tho", title="Nàng Thơ")
    adb.add(s)
    await adb.flush()
    return s


async def logs(adb: AsyncSession) -> list[AuditLog]:
    return list((await adb.scalars(select(AuditLog).order_by(AuditLog.id))).all())


# --- ghi nhật ký khi xóa / khôi phục --------------------------------------------


async def test_soft_delete_writes_audit_log(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    await soft_delete(adb, s, actor=Actor.admin(admin.id), reason="  Đăng nhầm phim  ")
    await adb.commit()

    [log] = await logs(adb)
    assert log.action == "series.delete"
    assert log.actor_type == ActorType.ADMIN and log.actor_user_id == admin.id
    assert (log.entity_type, log.entity_id) == ("series", str(s.id))
    assert log.reason == "Đăng nhầm phim"  # bỏ khoảng trắng thừa
    assert log.changes["deleted_by_id"] == [None, admin.id]
    old, new = log.changes["deleted_at"]
    assert old is None and new is not None
    assert set(log.changes) == {"deleted_at", "deleted_by_id"}  # chỉ ghi trường đã đổi
    assert log.occurred_at is not None


async def test_restore_writes_audit_log(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    await soft_delete(adb, s, actor=Actor.admin(admin.id), reason="Đăng nhầm")
    await restore(adb, s, actor=Actor.admin(admin.id), reason="Xóa nhầm, khôi phục")
    await adb.commit()

    actions = [log.action for log in await logs(adb)]
    assert actions == ["series.delete", "series.restore"]
    restored = (await logs(adb))[1]
    assert restored.changes["deleted_by_id"] == [admin.id, None]


async def test_deleting_user_records_subject_and_revoked_sessions(adb: AsyncSession):
    admin = await make_admin(adb)
    user = User(email="khach@example.com", password_hash="x", display_name="Khách")
    adb.add(user)
    await adb.flush()
    later = NOW + timedelta(days=30)
    adb.add_all(
        UserSession(user_id=user.id, refresh_token_hash=f"h{i}", expires_at=later) for i in range(2)
    )
    await adb.flush()

    await soft_delete(adb, user, actor=Actor.admin(admin.id), reason="Chia sẻ tài khoản")
    await adb.commit()

    [log] = await logs(adb)
    assert log.action == "users.delete"
    assert log.subject_user_id == user.id
    assert log.changes["sessions_revoked"] == 2


async def test_no_log_when_nothing_changed(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    assert await restore(adb, s, actor=Actor.admin(admin.id), reason="Thử") is False
    assert await logs(adb) == []


# --- bắt buộc lý do ------------------------------------------------------------


@pytest.mark.parametrize("reason", [None, "", "   "])
async def test_delete_without_reason_changes_nothing(adb: AsyncSession, reason):
    admin, s = await make_admin(adb), await make_series(adb)
    with pytest.raises(AuditReasonRequiredError):
        await soft_delete(adb, s, actor=Actor.admin(admin.id), reason=reason)
    assert s.deleted_at is None  # chưa đổi gì
    assert await logs(adb) == []


async def test_reason_optional_for_ordinary_actions(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    log = await record(adb, action="series.publish", actor=Actor.admin(admin.id), obj=s)
    assert log.reason is None


# --- cùng transaction -----------------------------------------------------------


async def test_rollback_removes_both_change_and_log(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    await adb.commit()
    series_id = s.id

    await soft_delete(adb, s, actor=Actor.admin(admin.id), reason="Đăng nhầm")
    await adb.rollback()  # ví dụ bước sau trong cùng request bị lỗi

    adb.expunge_all()
    still_there = await adb.scalar(select(Series).where(Series.id == series_id))
    assert still_there is not None and still_there.deleted_at is None
    assert await adb.scalar(select(func.count()).select_from(AuditLog)) == 0


# --- che dữ liệu nhạy cảm -------------------------------------------------------


async def test_sensitive_fields_redacted(adb: AsyncSession):
    admin = await make_admin(adb)
    user = User(email="a@example.com", password_hash="argon2-cu", display_name="A")
    adb.add(user)
    await adb.flush()
    before = snapshot(user)
    user.password_hash = "argon2-moi"
    user.display_name = "B"
    await adb.flush()

    log = await record(
        adb,
        action="users.update",
        actor=Actor.admin(admin.id),
        obj=user,
        subject_user_id=user.id,
        before=before,
        after=snapshot(user),
    )
    assert log.changes["password_hash"] == [REDACTED, REDACTED]
    assert log.changes["display_name"] == ["A", "B"]
    assert "argon2" not in str(log.changes)


# --- request_id, IP, trình duyệt ------------------------------------------------


async def test_log_captures_request_context(adb: AsyncSession):
    admin, s = await make_admin(adb), await make_series(adb)
    info = RequestInfo(request_id="req-12345678", ip="203.0.113.7", user_agent="Firefox")
    token = request_context._current.set(info)
    try:
        log = await record(adb, action="series.publish", actor=Actor.admin(admin.id), obj=s)
    finally:
        request_context._current.reset(token)
    assert (log.request_id, str(log.ip), log.user_agent) == (
        "req-12345678",
        "203.0.113.7",
        "Firefox",
    )


async def test_log_outside_request_has_no_request_info(adb: AsyncSession):
    s = await make_series(adb)
    log = await record(adb, action="series.expire", actor=Actor.system(), obj=s)
    assert log.request_id is None and log.ip is None and log.actor_user_id is None


async def test_response_has_request_id(client: httpx.AsyncClient):
    res = await client.get("/api/health")
    rid = res.headers[REQUEST_ID_HEADER]
    assert len(rid) == 32 and int(rid, 16) >= 0


async def test_valid_incoming_request_id_kept(client: httpx.AsyncClient):
    res = await client.get("/api/health", headers={REQUEST_ID_HEADER: "abc-12345678"})
    assert res.headers[REQUEST_ID_HEADER] == "abc-12345678"


@pytest.mark.parametrize("bad", ["ngan", "co dau cach!", "x" * 65, "<script>"])
async def test_invalid_incoming_request_id_replaced(client: httpx.AsyncClient, bad):
    res = await client.get("/api/health", headers={REQUEST_ID_HEADER: bad})
    assert res.headers[REQUEST_ID_HEADER] != bad


# --- DB không cho sửa / xóa nhật ký ---------------------------------------------


@pytest.fixture
def one_log(db: Session) -> AuditLog:
    log = AuditLog(actor_type=ActorType.SYSTEM, action="series.publish", entity_type="series")
    db.add(log)
    db.commit()
    return log


def test_audit_log_cannot_be_updated(db: Session, one_log: AuditLog):
    with pytest.raises(IntegrityError, match="audit_log_immutable"):
        db.execute(text("UPDATE audit_logs SET reason = 'sửa' WHERE id = :id"), {"id": one_log.id})


def test_audit_log_update_blocked_even_in_maintenance(db: Session, one_log: AuditLog):
    db.execute(text("SET LOCAL vdrama.allow_hard_delete = 'on'"))
    with pytest.raises(IntegrityError, match="audit_log_immutable"):
        db.execute(text("UPDATE audit_logs SET reason = 'sửa' WHERE id = :id"), {"id": one_log.id})


@pytest.mark.parametrize("sql", ["DELETE FROM audit_logs", "TRUNCATE audit_logs"])
def test_audit_log_cannot_be_deleted(db: Session, one_log: AuditLog, sql: str):
    with pytest.raises(IntegrityError, match="hard_delete_blocked"):
        db.execute(text(sql))


# --- ràng buộc ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("kw", "constraint"),
    [
        ({"actor_type": "admin", "actor_user_id": None}, "ck_audit_logs_actor_user_known"),
        ({"actor_type": "robot"}, "ck_audit_logs_actor_type"),
        ({"action": "XoaPhim"}, "ck_audit_logs_action_format"),
    ],
)
def test_audit_log_checks(db: Session, kw: dict, constraint: str):
    data = {"actor_type": "system", "action": "series.publish", "entity_type": "series", **kw}
    db.add(AuditLog(**data))
    with pytest.raises(IntegrityError, match=constraint):
        db.flush()
