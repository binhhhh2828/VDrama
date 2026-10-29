from pydantic import BaseModel, ConfigDict, Field

from app.services.activity import MAX_PROGRESS_SEC


class ProgressIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Giây đã xem tới trong tập.
    progress_sec: int = Field(ge=0, le=MAX_PROGRESS_SEC)
