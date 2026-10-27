"""Import mọi model ở đây để Alembic thấy chúng trong Base.metadata."""

from app.models.catalog import Episode, Genre, Series, SeriesStats, series_genres
from app.models.email_token import EmailToken
from app.models.user import User
from app.models.user_session import UserSession

__all__ = [
    "EmailToken",
    "Episode",
    "Genre",
    "Series",
    "SeriesStats",
    "User",
    "UserSession",
    "series_genres",
]
