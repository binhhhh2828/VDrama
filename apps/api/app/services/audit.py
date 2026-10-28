"""Ghi nhật ký thao tác. Đây là chỗ duy nhất ghi vào audit_logs.

Cách dùng trong một service (cùng transaction với thay đổi):

    before = snapshot(obj)
    ...thay đổi obj...
    await db.flush()
    await record(db, action="series.delete", obj=obj, actor=actor, reason=reason,
                 before=before, after=snapshot(obj))

Gọi require_reason() TRƯỚC khi thay đổi gì, để thiếu lý do thì không có gì bị đổi.
Không commit ở đây: caller commit, nên thay đổi và nhật ký cùng thành công hoặc cùng bị hủy.
"""

import enum
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.request_context import current_request
from app.models.audit import AuditLog
from app.models.enums import ActorType

# Không bao giờ ghi giá trị thật của các trường này vào nhật ký.
SENSITIVE_FIELDS = frozenset(
    {
        "password_hash",
        "refresh_token_hash",
        "previous_refresh_token_hash",
        "token_hash",
    }
)
REDACTED = "***"

# Cột sổ sách tự đổi theo mỗi lần ghi hoặc do DB tự tính: không đưa vào nhật ký.
IGNORED_FIELDS = frozenset({"updated_at", "search_text"})

# Động từ bắt buộc nhập lý do (quyết định đã chốt ở plan bổ sung schema).
REASON_REQUIRED_VERBS = frozenset(
    {
        "delete",
        "restore",
        "role_change",
        "create_admin",
        "cancel",
        "refund",
        "grant_vip",
        "link_transaction",
    }
)


class AuditReasonRequiredError(ValueError):
    """Thao tác nhạy cảm nhưng không có lý do."""


@dataclass(frozen=True)
class Actor:
    type: ActorType
    user_id: int | None = None

    @classmethod
    def admin(cls, user_id: int) -> "Actor":
        return cls(ActorType.ADMIN, user_id)

    @classmethod
    def user(cls, user_id: int) -> "Actor":
        return cls(ActorType.USER, user_id)

    @classmethod
    def system(cls) -> "Actor":
        return cls(ActorType.SYSTEM)

    @classmethod
    def webhook(cls) -> "Actor":
        return cls(ActorType.WEBHOOK)


def require_reason(action: str, reason: str | None) -> str | None:
    """Kiểm tra lý do trước khi thay đổi dữ liệu. Trả lý do đã bỏ khoảng trắng thừa."""
    cleaned = (reason or "").strip() or None
    verb = action.rsplit(".", 1)[-1]
    if verb in REASON_REQUIRED_VERBS and cleaned is None:
        raise AuditReasonRequiredError(f"Thao tác {action} bắt buộc nhập lý do")
    return cleaned


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal | uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set):
        return [_json_safe(v) for v in value]
    return str(value)


def snapshot(obj: Any) -> dict[str, Any]:
    """Giá trị các cột của một đối tượng ORM (đã nạp sẵn, không phát sinh truy vấn)."""
    state = inspect(obj)
    values = {}
    for attr in state.mapper.column_attrs:
        if attr.key in state.unloaded:  # cột chưa nạp: bỏ qua, không nạp ngầm (async)
            continue
        values[attr.key] = _json_safe(state.dict.get(attr.key))
    return values


async def load_snapshot(db: AsyncSession, obj: Any) -> dict[str, Any]:
    """Như snapshot() nhưng nạp đủ mọi cột trước (cột chưa nạp thì nạp lại cả đối tượng).

    Dùng cho ảnh "trước/sau" của nhật ký để không bỏ sót trường nào đã đổi.
    """
    if inspect(obj).unloaded:
        await db.refresh(obj)
    return snapshot(obj)


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, list[Any]]:
    """{"trường": [trước, sau]} cho các trường đã đổi; trường nhạy cảm bị che.

    Chỉ so các trường có trong cả hai ảnh chụp: trường vắng mặt nghĩa là chưa được nạp,
    không phải là NULL.
    """
    changes: dict[str, list[Any]] = {}
    for key in sorted((before.keys() & after.keys()) - IGNORED_FIELDS):
        old, new = before[key], after[key]
        if old == new:
            continue
        if key in SENSITIVE_FIELDS:
            changes[key] = [REDACTED if old is not None else None, REDACTED]
        else:
            changes[key] = [old, new]
    return changes


def entity_type_of(obj: Any) -> str:
    return obj.__table__.name


async def record(
    db: AsyncSession,
    *,
    action: str,
    actor: Actor,
    obj: Any = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    subject_user_id: int | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
    reason: str | None = None,
) -> AuditLog:
    """Ghi một dòng nhật ký trong transaction hiện tại (không commit)."""
    reason = require_reason(action, reason)
    if obj is not None:
        entity_type = entity_type or entity_type_of(obj)
        entity_id = entity_id if entity_id is not None else getattr(obj, "id", None)
    if entity_type is None:
        raise ValueError("Thiếu entity_type cho nhật ký")

    changes = diff(before or {}, after or {})
    for key, value in (extra or {}).items():
        changes[key] = _json_safe(value)

    req = current_request()
    log = AuditLog(
        actor_type=actor.type,
        actor_user_id=actor.user_id,
        action=action,
        entity_type=entity_type,
        entity_id=None if entity_id is None else str(entity_id),
        subject_user_id=subject_user_id,
        changes=changes,
        reason=reason,
        ip=req.ip,
        user_agent=req.user_agent,
        request_id=req.request_id,
    )
    db.add(log)
    await db.flush()
    return log
