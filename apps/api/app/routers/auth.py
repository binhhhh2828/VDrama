from fastapi import APIRouter, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.cookies import (
    clear_auth_cookies,
    read_access_cookie,
    read_refresh_cookie,
    set_auth_cookies,
)
from app.core import rate_limit
from app.core.db import DbSession
from app.core.errors import ApiError, ErrorCode, error_body
from app.core.request_context import current_request
from app.core.security import InvalidTokenError, decode_access_token
from app.schemas.auth import LoginIn, RegisterIn, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def email_taken() -> ApiError:
    return ApiError(409, ErrorCode.EMAIL_TAKEN, "Email đã được sử dụng.")


def invalid_credentials() -> ApiError:
    return ApiError(401, ErrorCode.INVALID_CREDENTIALS, "Email hoặc mật khẩu không đúng.")


def account_disabled() -> ApiError:
    return ApiError(
        403, ErrorCode.ACCOUNT_DISABLED, "Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ."
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterIn, response: Response, db: DbSession) -> UserOut:
    """Tạo tài khoản và đăng nhập luôn."""
    rate_limit.hit(rate_limit.REGISTER_PER_IP, "register", current_request().ip)
    try:
        user, issued = await auth_service.register(db, data)
    except auth_service.EmailTakenError:
        raise email_taken() from None
    await db.commit()
    set_auth_cookies(response, issued)
    return UserOut.of(user)


@router.post("/login")
async def login(data: LoginIn, response: Response, db: DbSession) -> UserOut:
    ip = current_request().ip
    rate_limit.hit(rate_limit.LOGIN_PER_IP, "login", ip)
    rate_limit.hit(rate_limit.LOGIN_PER_IP_EMAIL, "login", ip, data.email.lower())
    try:
        user, issued = await auth_service.login(db, data.email, data.password)
    except auth_service.InvalidCredentialsError:
        raise invalid_credentials() from None
    except auth_service.AccountDisabledError:
        raise account_disabled() from None
    await db.commit()
    set_auth_cookies(response, issued)
    return UserOut.of(user)


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
async def refresh(request: Request, db: DbSession) -> Response:
    """Cấp access token mới từ cookie refresh, xoay vòng refresh token."""
    rate_limit.hit(rate_limit.REFRESH_PER_IP, "refresh", current_request().ip)
    try:
        issued = await auth_service.refresh(db, read_refresh_cookie(request))
    except auth_service.SessionInvalidError:
        await db.commit()  # lưu việc thu hồi phiên (token bị dùng lại, user bị khóa)
        response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content=error_body(
                ErrorCode.SESSION_EXPIRED, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."
            ),
        )
        clear_auth_cookies(response)
        return response
    await db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    set_auth_cookies(response, issued)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: DbSession) -> Response:
    """Thu hồi phiên của thiết bị này và xóa cookie. Luôn trả 204 (kể cả khi chưa đăng nhập)."""
    session_id = None
    access = read_access_cookie(request)
    if access:
        try:
            session_id = decode_access_token(access).session_id
        except InvalidTokenError:
            pass
    await auth_service.revoke_session(
        db, refresh_token=read_refresh_cookie(request), session_id=session_id
    )
    await db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response)
    return response
