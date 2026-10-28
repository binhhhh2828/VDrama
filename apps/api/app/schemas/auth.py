from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

from app.models import User
from app.services.vip import is_vip

# 8–128 ký tự: giới hạn trên chặn mật khẩu cực dài làm nghẽn CPU khi hash.
PASSWORD_MIN = 8
PASSWORD_MAX = 128

Password = Annotated[str, Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: Password
    display_name: DisplayName
    accept_terms: bool

    @model_validator(mode="after")
    def _check(self) -> "RegisterIn":
        if not self.accept_terms:
            raise ValueError("Bạn cần đồng ý điều khoản sử dụng")
        if self.password.strip().lower() == self.email.lower():
            raise ValueError("Mật khẩu không được trùng email")
        return self


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Không kiểm tra định dạng email ở đây: email sai cũng chỉ là "sai thông tin đăng nhập".
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=320)]
    password: Annotated[str, Field(min_length=1, max_length=PASSWORD_MAX)]


class UserOut(BaseModel):
    """Thông tin user trả cho client. Không bao giờ có password_hash."""

    id: int
    email: str
    display_name: str
    avatar_url: str | None
    role: str
    email_verified: bool
    created_at: datetime
    # VIP: hạn cuối (None = chưa từng mua) và trạng thái tại thời điểm server trả lời.
    vip_expires_at: datetime | None
    is_vip: bool

    @classmethod
    def of(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            role=user.role,
            email_verified=user.email_verified_at is not None,
            created_at=user.created_at,
            vip_expires_at=user.vip_expires_at,
            is_vip=is_vip(user),
        )
