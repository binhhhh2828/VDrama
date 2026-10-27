"""Tìm kiếm series không dấu, dùng cột series.search_text + index GIN trigram (migration 0004)."""

from sqlalchemy import ColumnElement, func

from app.models import Series

LIKE_ESCAPE = "\\"


def escape_like(value: str) -> str:
    """Escape ký tự đặc biệt của LIKE để từ khóa người dùng được hiểu theo nghĩa đen."""
    for ch in (LIKE_ESCAPE, "%", "_"):
        value = value.replace(ch, LIKE_ESCAPE + ch)
    return value


def series_search_condition(query: str) -> ColumnElement[bool]:
    """Điều kiện WHERE cho ô tìm kiếm: "nang tho" khớp "Nàng Thơ".

    Chuẩn hóa từ khóa bằng đúng biểu thức của cột (lower + immutable_unaccent) để
    Postgres dùng được index trigram. Từ khóa nên dài từ 3 ký tự trở lên.
    """
    normalized = func.lower(func.immutable_unaccent(escape_like(query.strip())))
    return Series.search_text.ilike(func.concat("%", normalized, "%"), escape=LIKE_ESCAPE)
