"""Catalog công khai (chỉ đọc): khách cũng xem được. Tài liệu: docs/api.md (Catalog)."""

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.exceptions import RequestValidationError

from app.core.db import DbSession
from app.schemas.catalog import GenreOut, SeriesCard, SeriesPage
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
