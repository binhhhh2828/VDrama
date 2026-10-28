"""Catalog công khai (chỉ đọc): khách cũng xem được. Tài liệu: docs/api.md (Catalog)."""

from typing import Annotated

from fastapi import APIRouter, Path, Query
from fastapi.exceptions import RequestValidationError

from app.api.deps import OptionalUser
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode
from app.models import User
from app.models.enums import UserRole
from app.schemas.catalog import EpisodeOut, GenreOut, SeriesCard, SeriesDetail, SeriesPage
from app.services import catalog as catalog_service

router = APIRouter(tags=["catalog"])


def invalid_query(field: str, message: str) -> RequestValidationError:
    """Lỗi 422 cùng dạng với lỗi validate tự động (có `fields`)."""
    return RequestValidationError(
        [{"loc": ("query", field), "msg": message, "type": "value_error"}]
    )


@router.get("/genres")
async def genres(db: DbSession) -> list[GenreOut]:
    return [GenreOut.model_validate(g) for g in await catalog_service.list_genres(db)]


@router.get("/series")
async def series_list(
    db: DbSession,
    sort: catalog_service.SeriesSort = "new",
    genre: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    with_banner: bool = False,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=500)] = None,
) -> SeriesPage:
    try:
        rows, next_cursor = await catalog_service.list_series(
            db,
            sort=sort,
            genre_slug=genre,
            with_banner=with_banner,
            limit=limit,
            cursor=cursor,
        )
    except catalog_service.InvalidCursorError as exc:
        raise invalid_query("cursor", str(exc)) from None
    return SeriesPage(items=[SeriesCard.model_validate(s) for s in rows], next_cursor=next_cursor)


def series_not_found() -> ApiError:
    return ApiError(404, ErrorCode.NOT_FOUND, "Không tìm thấy phim.")


def _is_admin(user: User | None) -> bool:
    """Admin xem trước được phim/tập chưa xuất bản (ma trận phân quyền)."""
    return user is not None and user.role == UserRole.ADMIN


SeriesSlug = Annotated[str, Path(min_length=1, max_length=200)]


@router.get("/series/{slug}")
async def series_detail(slug: SeriesSlug, db: DbSession, user: OptionalUser) -> SeriesDetail:
    data = await catalog_service.get_series_detail(db, slug, include_unpublished=_is_admin(user))
    if data is None:
        raise series_not_found()
    card = SeriesCard.model_validate(data.series)
    return SeriesDetail(
        **card.model_dump(),
        description=data.series.description,
        episode_count=data.episode_count,
        latest_episode_number=data.latest_episode_number,
        view_count=data.view_count,
        is_published=data.series.is_published,
    )


@router.get("/series/{slug}/episodes")
async def series_episodes(slug: SeriesSlug, db: DbSession, user: OptionalUser) -> list[EpisodeOut]:
    episodes = await catalog_service.list_episodes(db, slug, include_unpublished=_is_admin(user))
    if episodes is None:
        raise series_not_found()
    return [EpisodeOut.of(ep) for ep in episodes]
