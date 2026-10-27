"""Import mọi model ở đây để Alembic thấy chúng trong Base.metadata."""

from app.models.activity import Favorite, WatchHistory
from app.models.catalog import Episode, Genre, Series, SeriesStats, series_genres
from app.models.email_token import EmailToken
from app.models.user import User
from app.models.user_session import UserSession
from app.models.vip import Payment, PaymentEvent, Subscription, VipPlan

__all__ = [
    "EmailToken",
    "Episode",
    "Favorite",
    "Genre",
    "Payment",
    "PaymentEvent",
    "Series",
    "SeriesStats",
    "Subscription",
    "User",
    "UserSession",
    "VipPlan",
    "WatchHistory",
    "series_genres",
]
