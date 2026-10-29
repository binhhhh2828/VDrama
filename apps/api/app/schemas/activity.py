from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.catalog import EpisodeOut, SeriesCard
from app.services.activity import MAX_PROGRESS_SEC


class ProgressIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Giây đã xem tới trong tập.
    progress_sec: int = Field(ge=0, le=MAX_PROGRESS_SEC)


class ContinueItemOut(BaseModel):
    """Một dòng "Xem tiếp": tập xem gần nhất của một phim."""

    series: SeriesCard
    episode: EpisodeOut
    progress_sec: int
    updated_at: datetime  # lần báo tiến độ gần nhất


class ContinueWatchingOut(BaseModel):
    items: list[ContinueItemOut]


class EpisodeProgressOut(BaseModel):
    episode_id: int
    number: int
    progress_sec: int
    updated_at: datetime


class SeriesProgressOut(BaseModel):
    items: list[EpisodeProgressOut]
