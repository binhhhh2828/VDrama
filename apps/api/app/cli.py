"""Lệnh quản trị chạy trên server.

    uv run python -m app.cli create-admin --email admin@vdrama.vn --reason "Admin đầu tiên"
    uv run python -m app.cli seed-demo      # dữ liệu phim mẫu cho dev
    uv run python -m app.cli stream-create-signing-key
    uv run python -m app.cli stream-set-webhook https://vdrama.vn/api/v1/webhooks/stream

Hai lệnh stream-* gọi API Cloudflare (cần CF_ACCOUNT_ID, CF_STREAM_API_TOKEN) và in giá trị cần
dán vào .env; không tự ghi file, không lưu ở đâu khác.

create-admin: email chưa có tài khoản thì tạo admin mới, hỏi mật khẩu (nhập hai lần, không hiện
ra màn hình). Email đã có: nâng quyền lên admin, không đổi mật khẩu. Mật khẩu không nhận qua
tham số dòng lệnh để không lọt vào lịch sử shell. Mọi lần chạy đều ghi nhật ký thao tác (bắt
buộc lý do).
"""

import argparse
import asyncio
import getpass
import sys
from collections.abc import Awaitable, Callable

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.db import dispose_engine, get_sessionmaker
from app.core.loop import selector_loop_factory
from app.schemas.auth import PASSWORD_MAX, PASSWORD_MIN
from app.services import demo_seed, stream
from app.services.admin_accounts import (
    AdminAccountError,
    create_or_promote_admin,
    find_by_email_including_deleted,
)

_email = TypeAdapter(EmailStr)


def _ask_password(email: str, prompt: Callable[[str], str]) -> str:
    password = prompt("Mật khẩu cho tài khoản admin mới: ")
    if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        raise AdminAccountError(f"Mật khẩu phải dài {PASSWORD_MIN}–{PASSWORD_MAX} ký tự")
    if password.strip().lower() == email.lower():
        raise AdminAccountError("Mật khẩu không được trùng email")
    if prompt("Nhập lại mật khẩu: ") != password:
        raise AdminAccountError("Hai lần nhập mật khẩu không khớp")
    return password


async def create_admin(
    email: str,
    reason: str,
    display_name: str | None,
    prompt: Callable[[str], str] = getpass.getpass,
) -> str:
    async with get_sessionmaker()() as db:
        password = None
        if await find_by_email_including_deleted(db, email) is None:
            password = _ask_password(email, prompt)
        result = await create_or_promote_admin(
            db, email=email, reason=reason, password=password, display_name=display_name
        )
        await db.commit()
    if result.created:
        return f"Đã tạo admin mới: {email} (id {result.user.id})"
    if result.changed:
        return f"Đã nâng quyền admin cho: {email} (id {result.user.id})"
    return f"{email} đã là admin, không đổi gì"


async def seed_demo() -> str:
    async with get_sessionmaker()() as db:
        result = await demo_seed.seed_demo(db)
        await db.commit()
    return (
        f"Dữ liệu mẫu: thêm {result.genres_created} thể loại, {result.series_created} phim "
        f"({result.episodes_created} tập); bỏ qua {result.series_skipped} phim đã có"
    )


async def stream_create_signing_key() -> str:
    key = await stream.create_signing_key()
    return "\n".join(
        [
            "Đã tạo khóa ký token. Dán hai dòng sau vào .env (Cloudflare chỉ hiện khóa riêng",
            "một lần, không lấy lại được; mất thì tạo khóa mới):",
            f"CF_STREAM_SIGNING_KEY_ID={key.key_id}",
            f"CF_STREAM_SIGNING_KEY_PEM={key.pem_b64}",
        ]
    )


async def stream_set_webhook(url: str) -> str:
    secret = await stream.set_webhook(url)
    return "\n".join(
        [
            f"Đã đăng ký webhook {url} (thay URL cũ nếu có: mỗi tài khoản một URL).",
            "Dán dòng sau vào .env:",
            f"CF_STREAM_WEBHOOK_SECRET={secret}",
        ]
    )


def main(argv: list[str] | None = None, prompt: Callable[[str], str] = getpass.getpass) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin", help="Tạo admin mới hoặc nâng quyền tài khoản có sẵn")
    p.add_argument("--email", required=True)
    p.add_argument("--reason", required=True, help="Lý do (ghi vào nhật ký thao tác)")
    p.add_argument("--display-name", default=None)
    sub.add_parser("seed-demo", help="Thêm dữ liệu phim mẫu cho dev (không chạy ở ENV=prod)")
    sub.add_parser("stream-create-signing-key", help="Tạo khóa ký token xem phim trên Cloudflare")
    p = sub.add_parser("stream-set-webhook", help="Đăng ký URL webhook Stream, in secret")
    p.add_argument("url", help="Ví dụ https://vdrama.vn/api/v1/webhooks/stream")
    args = parser.parse_args(argv)

    if args.command == "create-admin":
        try:
            email = str(_email.validate_python(args.email))
        except ValidationError:
            print("Email không hợp lệ", file=sys.stderr)
            return 2

        def job() -> Awaitable[str]:
            return create_admin(email, args.reason, args.display_name, prompt)
    elif args.command == "stream-create-signing-key":

        def job() -> Awaitable[str]:
            return stream_create_signing_key()
    elif args.command == "stream-set-webhook":

        def job() -> Awaitable[str]:
            return stream_set_webhook(args.url)
    else:

        def job() -> Awaitable[str]:
            return seed_demo()

    async def run() -> str:
        try:
            return await job()
        finally:
            await dispose_engine()

    try:
        with asyncio.Runner(loop_factory=selector_loop_factory) as runner:
            print(runner.run(run()))
    except (
        AdminAccountError,
        demo_seed.DemoSeedRefusedError,
        stream.StreamNotConfiguredError,
        stream.StreamProviderError,
        ValueError,
    ) as exc:
        print(f"Lỗi: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
