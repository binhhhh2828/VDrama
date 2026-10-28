"""services/vip.py: hạn VIP nối tiếp, hủy gói và dời gói sau, users.vip_expires_at luôn khớp."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, Subscription, User, VipPlan
from app.models.enums import SubscriptionStatus
from app.services.audit import Actor
from app.services.vip import (
    SubscriptionNotActiveError,
    cancel_subscription,
    grant_vip,
    is_vip,
)

ADMIN = Actor.system()
CLOSE = timedelta(seconds=5)


async def setup(adb: AsyncSession) -> tuple[User, VipPlan]:
    user = User(email="vip@example.com", password_hash="x", display_name="V")
    plan = VipPlan(name="Tháng", price_vnd=49000, duration_days=30)
    adb.add_all([user, plan])
    await adb.flush()
    return user, plan


async def grant(adb: AsyncSession, user: User, plan: VipPlan) -> Subscription:
    return await grant_vip(adb, user_id=user.id, plan=plan, actor=ADMIN, reason="tặng")


async def assert_summary_matches(adb: AsyncSession, user: User) -> None:
    """users.vip_expires_at = hạn cuối của subscription active (bản tóm tắt không lệch)."""
    expected = await adb.scalar(
        select(func.max(Subscription.expires_at)).where(
            Subscription.user_id == user.id, Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    await adb.refresh(user)
    assert user.vip_expires_at == expected


def test_is_vip_boundaries():
    exp = datetime(2026, 11, 1, tzinfo=UTC)
    user = User(vip_expires_at=None)
    assert not is_vip(user)  # chưa từng mua
    user.vip_expires_at = exp
    assert is_vip(user, now=exp - timedelta(seconds=1))
    assert not is_vip(user, now=exp)
    assert not is_vip(user, now=exp + timedelta(seconds=1))  # vừa quá hạn một giây


async def test_first_purchase_starts_now(adb: AsyncSession):
    user, plan = await setup(adb)
    sub = await grant(adb, user, plan)
    now = datetime.now(UTC)
    assert abs(sub.starts_at - now) < CLOSE
    assert sub.expires_at - sub.starts_at == timedelta(days=30)
    await assert_summary_matches(adb, user)
    assert is_vip(user)


async def test_renew_while_active_stacks(adb: AsyncSession):
    user, plan = await setup(adb)
    first = await grant(adb, user, plan)
    second = await grant(adb, user, plan)
    assert second.starts_at == first.expires_at  # không mất ngày nào
    await assert_summary_matches(adb, user)
    assert user.vip_expires_at == first.expires_at + timedelta(days=30)


async def test_buy_again_after_expiry_starts_now(adb: AsyncSession):
    user, plan = await setup(adb)
    past = datetime.now(UTC) - timedelta(days=40)
    adb.add(
        Subscription(
            user_id=user.id, plan_id=plan.id, starts_at=past, expires_at=past + timedelta(days=30)
        )
    )
    await adb.flush()
    sub = await grant(adb, user, plan)
    assert abs(sub.starts_at - datetime.now(UTC)) < CLOSE  # tính từ lúc mua, không từ hạn cũ
    await assert_summary_matches(adb, user)


async def test_grant_without_payment_requires_reason(adb: AsyncSession):
    user, plan = await setup(adb)
    with pytest.raises(ValueError, match="lý do"):
        await grant_vip(adb, user_id=user.id, plan=plan, actor=ADMIN, reason="  ")
    assert await adb.scalar(select(func.count()).select_from(Subscription)) == 0


async def test_grant_is_logged_with_summary_change(adb: AsyncSession):
    user, plan = await setup(adb)
    sub = await grant(adb, user, plan)
    [log] = (await adb.execute(select(AuditLog))).scalars()
    assert log.action == "subscriptions.grant_vip"
    assert log.entity_id == str(sub.id) and log.subject_user_id == user.id
    before, after = log.changes["users.vip_expires_at"]
    assert before is None and after == sub.expires_at.isoformat()


async def test_cancel_only_subscription_ends_vip(adb: AsyncSession):
    user, plan = await setup(adb)
    sub = await grant(adb, user, plan)
    await cancel_subscription(adb, sub.id, actor=ADMIN, reason="hoàn tiền")
    assert sub.status == SubscriptionStatus.CANCELLED
    await assert_summary_matches(adb, user)
    assert user.vip_expires_at is None and not is_vip(user)


async def test_cancel_current_moves_next_to_now(adb: AsyncSession):
    """Hủy gói đang chạy: gói nối tiếp phía sau bắt đầu ngay, giữ nguyên độ dài."""
    user, plan = await setup(adb)
    first = await grant(adb, user, plan)
    second = await grant(adb, user, plan)
    await cancel_subscription(adb, first.id, actor=ADMIN, reason="hoàn tiền")
    await adb.refresh(second)
    assert abs(second.starts_at - datetime.now(UTC)) < CLOSE
    assert second.expires_at - second.starts_at == timedelta(days=30)
    await assert_summary_matches(adb, user)


async def test_cancel_middle_closes_gap(adb: AsyncSession):
    user, plan = await setup(adb)
    first = await grant(adb, user, plan)
    middle = await grant(adb, user, plan)
    last = await grant(adb, user, plan)
    await cancel_subscription(adb, middle.id, actor=ADMIN, reason="hoàn tiền")
    await adb.refresh(first)
    await adb.refresh(last)
    assert last.starts_at == first.expires_at  # không có khoảng trống
    await assert_summary_matches(adb, user)
    assert user.vip_expires_at == first.expires_at + timedelta(days=30)

    actions = sorted((await adb.execute(select(AuditLog.action))).scalars())
    assert actions.count("subscriptions.cancel") == 1
    assert actions.count("subscriptions.reschedule") == 1


async def test_cancel_last_does_not_move_others(adb: AsyncSession):
    user, plan = await setup(adb)
    first = await grant(adb, user, plan)
    last = await grant(adb, user, plan)
    first_start = first.starts_at
    await cancel_subscription(adb, last.id, actor=ADMIN, reason="hoàn tiền")
    await adb.refresh(first)
    assert first.starts_at == first_start
    await assert_summary_matches(adb, user)
    assert user.vip_expires_at == first.expires_at


async def test_cancel_requires_reason_and_active(adb: AsyncSession):
    user, plan = await setup(adb)
    sub = await grant(adb, user, plan)
    with pytest.raises(ValueError, match="lý do"):
        await cancel_subscription(adb, sub.id, actor=ADMIN, reason="")
    await cancel_subscription(adb, sub.id, actor=ADMIN, reason="hoàn tiền")
    with pytest.raises(SubscriptionNotActiveError):
        await cancel_subscription(adb, sub.id, actor=ADMIN, reason="lần nữa")


async def test_me_shows_vip(adb: AsyncSession):
    """UserOut (trả ở /me, đăng ký, đăng nhập) phản ánh VIP."""
    from app.schemas.auth import UserOut

    user, plan = await setup(adb)
    sub = await grant(adb, user, plan)
    await adb.refresh(user)
    out = UserOut.of(user)
    assert out.is_vip is True and out.vip_expires_at == sub.expires_at
