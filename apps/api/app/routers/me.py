"""Tài khoản đang đăng nhập: thông tin, lịch sử xem, yêu thích. Tài liệu: docs/api.md."""

from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.api.deps import CurrentUser
from app.core import rate_limit
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.routers.catalog import SeriesSlug, invalid_query
from app.routers.play import EpisodeId, play_denied
from app.schemas.activity import (
    ContinueItemOut,
    ContinueWatchingOut,
    EpisodeProgressOut,
    FavoriteStatusOut,
    ProgressIn,
    SeriesProgressOut,
)
from app.schemas.auth import UserOut
from app.schemas.catalog import EpisodeOut, SeriesCard, SeriesPage
from app.services import activity
from app.services.catalog import InvalidCursorError
from app.services.play import PlayDeniedError

router = APIRouter(tags=["me"])

# Giới hạn của cột BIGINT: id lớn hơn thì trả 422 thay vì để DB báo lỗi.
SeriesId = Annotated[int, Path(ge=1, le=2**63 - 1)]


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.of(user)


@router.put("/me/history/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def report_progress(
    episode_id: EpisodeId, data: ProgressIn, db: DbSession, user: CurrentUser
) -> None:
    """Player báo tiến độ mỗi ~15–30 giây và khi tạm dừng/đóng trang."""
    rate_limit.hit(rate_limit.HISTORY_PER_USER, "history", str(user.id))
    try:
        await activity.record_progress(db, user, episode_id, data.progress_sec)
    except PlayDeniedError as exc:
        raise play_denied(exc) from None
    await db.commit()


@router.get("/me/history")
async def continue_watching(
    db: DbSession, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=50)] = 20
) -> ContinueWatchingOut:
    """ "Xem tiếp": mỗi phim một dòng là tập xem gần nhất, phim xem gần nhất trước."""
    items = await activity.continue_watching(db, user.id, limit=limit)
    return ContinueWatchingOut(
        items=[
            ContinueItemOut(
                series=SeriesCard.model_validate(item.series),
                episode=EpisodeOut.of(item.episode),
                progress_sec=item.progress_sec,
                updated_at=item.updated_at,
            )
            for item in items
        ]
    )


@router.get("/me/history/series/{slug}")
async def series_progress(slug: SeriesSlug, db: DbSession, user: CurrentUser) -> SeriesProgressOut:
    """Tiến độ các tập đã xem của một phim (thanh tiến độ, nút "Xem tiếp tập N")."""
    rows = await activity.series_progress(db, user, slug)
    if rows is None:
        raise ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy phim.")
    return SeriesProgressOut(
        items=[
            EpisodeProgressOut(
                episode_id=ep.id,
                number=ep.number,
                progress_sec=h.progress_sec,
                updated_at=h.updated_at,
            )
            for ep, h in rows
        ]
    )


@router.delete("/me/history/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode_history(episode_id: EpisodeId, db: DbSession, user: CurrentUser) -> None:
    """Xóa một tập khỏi lịch sử (người dùng không thấy nữa; hệ thống xóa mềm)."""
    await activity.delete_history(db, user.id, episode_id)
    await db.commit()


@router.delete("/me/history", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_history(db: DbSession, user: CurrentUser) -> None:
    """Xóa toàn bộ lịch sử xem (người dùng không thấy nữa; hệ thống xóa mềm)."""
    await activity.delete_history(db, user.id)
    await db.commit()


# --- Yêu thích ---


@router.get("/me/favorites")
async def list_favorites(
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=500)] = None,
) -> SeriesPage:
    """Phim đã yêu thích, mới yêu thích trước; phân trang bằng con trỏ như danh sách phim."""
    try:
        rows, next_cursor = await activity.list_favorites(db, user.id, limit=limit, cursor=cursor)
    except InvalidCursorError as exc:
        raise invalid_query("cursor", str(exc)) from None
    return SeriesPage(items=[SeriesCard.model_validate(s) for s in rows], next_cursor=next_cursor)


@router.get("/me/favorites/{series_id}")
async def favorite_status(
    series_id: SeriesId, db: DbSession, user: CurrentUser
) -> FavoriteStatusOut:
    """Trang chi tiết phim dùng để tô nút yêu thích."""
    return FavoriteStatusOut(favorited=await activity.is_favorite(db, user.id, series_id))


@router.put("/me/favorites/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(series_id: SeriesId, db: DbSession, user: CurrentUser) -> None:
    rate_limit.hit(rate_limit.FAVORITE_PER_USER, "favorite", str(user.id))
    try:
        await activity.add_favorite(db, user.id, series_id)
    except activity.SeriesNotFoundError:
        raise ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy phim.") from None
    await db.commit()


@router.delete("/me/favorites/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(series_id: SeriesId, db: DbSession, user: CurrentUser) -> None:
    """Bỏ yêu thích (người dùng thấy đã bỏ; hệ thống xóa mềm). Chưa yêu thích vẫn 204."""
    rate_limit.hit(rate_limit.FAVORITE_PER_USER, "favorite", str(user.id))
    await activity.remove_favorite(db, user.id, series_id)
    await db.commit()
