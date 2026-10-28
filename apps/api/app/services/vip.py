"""VIP: chỗ duy nhất thêm/hủy subscription và ghi `users.vip_expires_at`.

- `subscriptions` là nguồn sự thật (lịch sử từng lần mua). `users.vip_expires_at` là bản tóm
  tắt = hạn cuối của các subscription `active`, luôn tính lại trong cùng transaction.
- Đang là VIP khi `vip_expires_at > now()`: tự hết hạn đúng giây, không cần job.
- Mua/tặng khi còn hạn: gói mới nối tiếp từ hạn hiện tại (không mất ngày). Hết hạn rồi mới mua:
  tính từ lúc mua.
- Hủy một gói: các gói phía sau chưa bắt đầu được dời lên cho liền mạch.

Mọi thao tác ghi nhật ký; khóa dòng user trước khi tính để hai lần mua song song không chồng
lên cùng một khoảng thời gian. Không commit: người gọi commit.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Subscription, User, VipPlan
from app.models.enums import SubscriptionStatus
from app.services.audit import Actor, load_snapshot, record, require_reason, snapshot


class SubscriptionNotActiveError(Exception):
    pass


def is_vip(user: User, now: datetime | None = None) -> bool:
    expires = user.vip_expires_at
    return expires is not None and expires > (now or datetime.now(UTC))


async def _db_now(db: AsyncSession) -> datetime:
    """Giờ của DB (đầu transaction), để mọi mốc thời gian VIP dùng chung một đồng hồ."""
    return await db.scalar(select(func.now()))


async def _lock_user(db: AsyncSession, user_id: int) -> User:
    user = (
        await db.execute(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if user is None:
        raise LookupError(f"Không tìm thấy user {user_id}")
    return user


async def _active_subscriptions(db: AsyncSession, user_id: int) -> list[Subscription]:
    stmt = (
        select(Subscription)
        .where(Subscription.user_id == user_id, Subscription.status == SubscriptionStatus.ACTIVE)
        .order_by(Subscription.starts_at, Subscription.id)
    )
    return list((await db.execute(stmt)).scalars())


async def _sync_vip_expires_at(db: AsyncSession, user: User) -> list[datetime | None]:
    """Tính lại users.vip_expires_at từ subscriptions. Trả [trước, sau] để ghi nhật ký."""
    before = user.vip_expires_at
    latest = await db.scalar(
        select(func.max(Subscription.expires_at)).where(
            Subscription.user_id == user.id, Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    user.vip_expires_at = latest
    await db.flush()
    return [before, latest]


async def grant_vip(
    db: AsyncSession,
    *,
    user_id: int,
    plan: VipPlan,
    actor: Actor,
    payment_id: int | None = None,
    reason: str | None = None,
) -> Subscription:
    """Thêm một gói VIP nối tiếp hạn hiện tại.

    Có `payment_id`: gói do thanh toán (Giai đoạn 5). Không có: admin tặng VIP, bắt buộc lý do.
    """
    action = "subscriptions.create" if payment_id is not None else "subscriptions.grant_vip"
    reason = require_reason(action, reason)
    user = await _lock_user(db, user_id)
    now = await _db_now(db)

    current_end = await db.scalar(
        select(func.max(Subscription.expires_at)).where(
            Subscription.user_id == user_id, Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    starts_at = max(now, current_end) if current_end else now
    sub = Subscription(
        user_id=user_id,
        plan_id=plan.id,
        payment_id=payment_id,
        starts_at=starts_at,
        expires_at=starts_at + timedelta(days=plan.duration_days),
        status=SubscriptionStatus.ACTIVE,
    )
    db.add(sub)
    await db.flush()
    vip_change = await _sync_vip_expires_at(db, user)

    await record(
        db,
        action=action,
        actor=actor,
        obj=sub,
        subject_user_id=user_id,
        after=await load_snapshot(db, sub),
        extra={"users.vip_expires_at": vip_change},
        reason=reason,
    )
    return sub


async def cancel_subscription(
    db: AsyncSession, subscription_id: int, *, actor: Actor, reason: str
) -> Subscription:
    """Hủy một gói đang active, dời các gói phía sau chưa bắt đầu lên, tính lại hạn VIP."""
    action = "subscriptions.cancel"
    reason = require_reason(action, reason)
    sub = await db.get(Subscription, subscription_id)
    if sub is None:
        raise LookupError(f"Không tìm thấy subscription {subscription_id}")
    user = await _lock_user(db, sub.user_id)
    await db.refresh(sub)  # đọc lại sau khi khóa: tránh dùng trạng thái cũ
    if sub.status != SubscriptionStatus.ACTIVE:
        raise SubscriptionNotActiveError(f"Subscription {subscription_id} không còn active")
    now = await _db_now(db)

    before = snapshot(sub)
    sub.status = SubscriptionStatus.CANCELLED
    await db.flush()

    # Dời các gói chưa bắt đầu: nối liền sau gói đang chạy (hoặc từ bây giờ nếu không còn gói
    # nào đang chạy). Gói đã bắt đầu giữ nguyên.
    remaining = await _active_subscriptions(db, user.id)
    started = [s for s in remaining if s.starts_at <= now]
    cursor = max([now, *(s.expires_at for s in started)])
    moved = []
    for s in remaining:
        if s.starts_at <= now:
            continue
        length = s.expires_at - s.starts_at
        if s.starts_at != cursor:
            moved.append((s, snapshot(s)))
            s.starts_at, s.expires_at = cursor, cursor + length
        cursor = s.expires_at
    await db.flush()

    vip_change = await _sync_vip_expires_at(db, user)
    await record(
        db,
        action=action,
        actor=actor,
        obj=sub,
        subject_user_id=user.id,
        before=before,
        after=await load_snapshot(db, sub),
        extra={"users.vip_expires_at": vip_change, "rescheduled": [s.id for s, _ in moved]},
        reason=reason,
    )
    for s, s_before in moved:
        await record(
            db,
            action="subscriptions.reschedule",
            actor=actor,
            obj=s,
            subject_user_id=user.id,
            before=s_before,
            after=await load_snapshot(db, s),
            extra={"cause_subscription_id": sub.id},
            reason=reason,
        )
    return sub
