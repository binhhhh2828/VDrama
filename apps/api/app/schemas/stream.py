from datetime import datetime

from pydantic import BaseModel


class PlayOut(BaseModel):
    """URL phát có token ngắn hạn. Hết hạn thì frontend gọi lại `play` để lấy URL mới."""

    episode_id: int
    hls_url: str
    dash_url: str
    iframe_url: str
    expires_at: datetime
