"""Giới hạn tần suất cho các endpoint dễ bị dò (đăng nhập, đăng ký, refresh).

Dùng thư viện `limits` (cửa sổ trượt). Đếm lưu trong RAM của process: đủ cho một container API.
Khi chạy nhiều container, đổi `storage_from_string("memory://")` sang Redis
("redis://...") hoặc rate limit ở Cloudflare (đã ghi ở plan.md Giai đoạn 6).

Khóa đếm là IP thật (app/core/client_ip.py) và, với đăng nhập, cả cặp IP + email.
"""

import logging
import math
import time

from limits import RateLimitItem, parse
from limits.storage import storage_from_string
from limits.strategies import MovingWindowRateLimiter

from app.core.errors import ApiError, ErrorCode

logger = logging.getLogger(__name__)

LOGIN_PER_IP = parse("10/minute")
LOGIN_PER_IP_EMAIL = parse("5/minute")
REGISTER_PER_IP = parse("5/hour")
REFRESH_PER_IP = parse("30/minute")
# Xin URL xem phim: người xem bình thường chỉ vài lần mỗi tập; chặn script xin token hàng loạt.
PLAY_PER_USER = parse("60/minute")
# Chống đếm trùng lượt xem: mỗi (user, tập) tối đa 1 lượt mỗi 6 giờ.
VIEW_COUNT_WINDOW = parse("1/6 hours")

_storage = storage_from_string("memory://")
_limiter = MovingWindowRateLimiter(_storage)


def too_many(retry_after: int) -> ApiError:
    return ApiError(
        429,
        ErrorCode.RATE_LIMITED,
        "Bạn thao tác quá nhiều lần, vui lòng thử lại sau.",
        headers={"Retry-After": str(retry_after)},
    )


def hit(item: RateLimitItem, *keys: str | None) -> None:
    """Tính một lần thử; vượt ngưỡng thì ném 429 kèm Retry-After (giây).

    Thiếu một khóa (thường là IP không xác định) thì bỏ qua, không đếm: gộp mọi request như vậy
    vào một bộ đếm chung sẽ khiến người này chặn người kia. Qua TCP luôn có IP, nên trường hợp
    này chỉ xảy ra khi chạy qua unix socket hoặc trong test.
    """
    if any(not k for k in keys):
        # Không ghi giá trị khóa vào log: có thể chứa email.
        logger.warning("Bỏ qua rate limit %s: thiếu khóa đếm (thường là IP)", item)
        return
    identifiers = [str(k) for k in keys]
    if _limiter.hit(item, *identifiers):
        return
    reset_at = _limiter.get_window_stats(item, *identifiers).reset_time
    raise too_many(max(1, math.ceil(reset_at - time.time())))


def first_in_window(item: RateLimitItem, *keys: str) -> bool:
    """Tính một lần; True nếu còn trong ngưỡng. Không ném lỗi (dùng để chống đếm trùng)."""
    return _limiter.hit(item, *(str(k) for k in keys))


def reset() -> None:
    """Xóa mọi bộ đếm (dùng trong test)."""
    _storage.reset()
