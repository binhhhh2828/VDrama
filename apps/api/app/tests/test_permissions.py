"""Lưới an toàn phân quyền cho cả API.

1. Kiểm kê route: endpoint thêm sau này mà quên bảo vệ thì test đỏ.
2. Ma trận quyền khách / user / VIP / VIP hết hạn / admin, đọc như bảng "Phân quyền" ở docs/api.md.
3. Bảng mã lỗi trong docs/api.md khớp `ErrorCode`.
4. Một luồng đầu-cuối ở mức API: đăng ký → xem → VIP → hết hạn → đăng xuất.
"""

import re
from pathlib import Path

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.errors import ErrorCode
from app.main import app
from app.models import Episode, VipPlan
from app.services.audit import Actor
from app.services.vip import grant_vip
from app.tests.test_catalog_api import add_episode, add_series, become_admin
from app.tests.test_me_admin import signed_up
from app.tests.test_play_api import set_vip

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}

# Endpoint ghi dữ liệu được phép gọi khi chưa đăng nhập. Thêm vào đây phải có lý do rõ ràng.
PUBLIC_WRITES = {
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),  # xác thực bằng refresh cookie
    ("POST", "/api/v1/auth/logout"),  # luôn 204, kể cả khi chưa đăng nhập
    ("POST", "/api/v1/webhooks/stream"),  # xác thực bằng chữ ký
}


def routes() -> list[tuple[str, str]]:
    """Mọi (method, path) của API, đọc từ lược đồ OpenAPI.

    Dùng OpenAPI (giao diện công khai) thay vì duyệt `app.routes`: từ FastAPI 0.16x router con
    nằm trong lớp bọc nội bộ. Route `include_in_schema=False` không có ở đây: đừng dùng cờ đó
    cho endpoint nghiệp vụ.
    """
    paths = app.openapi()["paths"]
    return sorted((method.upper(), path) for path, ops in paths.items() for method in ops)


def concrete(path: str) -> str:
    """Điền tham số đường dẫn bằng giá trị hợp lệ (id 1, slug "1")."""
    return re.sub(r"\{[^}]+\}", "1", path)


ADMIN_ROUTES = [r for r in routes() if r[1].startswith("/api/v1/admin")]
ME_ROUTES = [r for r in routes() if r[1] == "/api/v1/me" or r[1].startswith("/api/v1/me/")]
PRIVATE_WRITES = [r for r in routes() if r[0] in UNSAFE and r not in PUBLIC_WRITES]


def test_inventory_finds_routes():
    """Kiểm kê thật sự thấy route (nếu cách gắn router đổi mà danh sách rỗng thì test vô nghĩa)."""
    assert ("POST", "/api/v1/admin/episodes/{episode_id}/upload") in ADMIN_ROUTES
    assert ("PUT", "/api/v1/me/favorites/{series_id}") in PRIVATE_WRITES
    assert ("GET", "/api/v1/me/history") in ME_ROUTES
    assert PUBLIC_WRITES <= set(routes()), "PUBLIC_WRITES có route không còn tồn tại"


@pytest.mark.parametrize(("method", "path"), ADMIN_ROUTES)
async def test_admin_routes_reject_guest_and_user(api: httpx.AsyncClient, method: str, path: str):
    res = await api.request(method, concrete(path), json={})
    assert res.status_code == 401, res.text
    await signed_up(api)
    res = await api.request(method, concrete(path), json={})
    assert res.status_code == 403, res.text
    assert res.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize(("method", "path"), PRIVATE_WRITES)
async def test_writes_require_login(api: httpx.AsyncClient, method: str, path: str):
    """Mọi endpoint ghi dữ liệu cần đăng nhập, trừ danh sách PUBLIC_WRITES."""
    res = await api.request(method, concrete(path), json={})
    assert res.status_code == 401, f"{method} {path} không cần đăng nhập: {res.status_code}"


@pytest.mark.parametrize(("method", "path"), ME_ROUTES)
async def test_me_routes_require_login(api: httpx.AsyncClient, method: str, path: str):
    res = await api.request(method, concrete(path), json={})
    assert res.status_code == 401, res.text


# --- Ma trận quyền ---------------------------------------------------------------

ROLES = ["guest", "user", "vip", "vip_expired", "admin"]

#           khách  user  VIP  VIP hết hạn  admin
MATRIX: dict[str, tuple[int, int, int, int, int]] = {
    "xem catalog": (200, 200, 200, 200, 200),
    "xem tập free": (401, 200, 200, 200, 200),
    "xem tập VIP": (401, 403, 200, 403, 200),
    "xem tập chưa xuất bản": (404, 404, 404, 404, 200),
    "API admin": (401, 403, 403, 403, 409),  # admin qua được quyền; 409 vì tập chưa có video
    "xem lịch sử": (401, 200, 200, 200, 200),
    "báo tiến độ tập VIP": (401, 403, 204, 403, 204),
    "yêu thích": (401, 204, 204, 204, 204),
}


@pytest.fixture
def world(db: Session) -> dict[str, int]:
    s = add_series(db, "nang-tho")
    eps = {
        "free": add_episode(db, s, 1, free=True),
        "vip": add_episode(db, s, 2),
        "draft": add_episode(db, s, 3, published=False, stream_status="ready", free=True),
    }
    no_video = Episode(series_id=s.id, number=4)
    db.add(no_video)
    db.commit()
    return {"series": s.id, "no_video": no_video.id, **{k: e.id for k, e in eps.items()}}


async def become(api: httpx.AsyncClient, db: Session, role: str) -> None:
    if role == "guest":
        return
    if role == "admin":
        await become_admin(api, db)
        return
    user_id, _ = await signed_up(api)
    if role == "vip":
        set_vip(db, user_id, "1 day")
    elif role == "vip_expired":
        set_vip(db, user_id, "-1 second")


async def act(api: httpx.AsyncClient, action: str, w: dict[str, int]) -> int:
    v1 = "/api/v1"
    calls = {
        "xem catalog": ("GET", f"{v1}/series", None),
        "xem tập free": ("GET", f"{v1}/episodes/{w['free']}/play", None),
        "xem tập VIP": ("GET", f"{v1}/episodes/{w['vip']}/play", None),
        "xem tập chưa xuất bản": ("GET", f"{v1}/episodes/{w['draft']}/play", None),
        "API admin": ("POST", f"{v1}/admin/episodes/{w['no_video']}/stream-sync", None),
        "xem lịch sử": ("GET", f"{v1}/me/history", None),
        "báo tiến độ tập VIP": ("PUT", f"{v1}/me/history/{w['vip']}", {"progress_sec": 1}),
        "yêu thích": ("PUT", f"{v1}/me/favorites/{w['series']}", None),
    }
    method, path, body = calls[action]
    return (await api.request(method, path, json=body)).status_code


@pytest.mark.usefixtures("stream_on")
@pytest.mark.parametrize("role", ROLES)
async def test_permission_matrix(api: httpx.AsyncClient, db: Session, world, role: str):
    await become(api, db, role)
    column = ROLES.index(role)
    expected = {action: codes[column] for action, codes in MATRIX.items()}
    actual = {action: await act(api, action, world) for action in MATRIX}
    assert actual == expected


# --- Tài liệu khớp code ------------------------------------------------------------

API_DOC = Path(__file__).resolve().parents[4] / "docs" / "api.md"


def documented_error_codes() -> set[str]:
    doc = API_DOC.read_text(encoding="utf-8")
    section = doc.split("### Định dạng lỗi", 1)[1].split("\n### ", 1)[0]
    return set(re.findall(r"^\| `([a-z_]+)` \| \d{3} \|", section, flags=re.MULTILINE))


def test_error_codes_documented():
    """Thêm mã lỗi mới thì phải ghi vào bảng mã lỗi của docs/api.md (và ngược lại)."""
    in_code = {code.value for code in ErrorCode}
    in_doc = documented_error_codes()
    assert in_code - in_doc == set(), "Có trong ErrorCode nhưng thiếu trong docs/api.md"
    assert in_doc - in_code == set(), "Có trong docs/api.md nhưng không còn trong ErrorCode"


# --- Luồng đầu-cuối mức API ------------------------------------------------------


@pytest.mark.usefixtures("stream_on")
async def test_end_to_end_viewer_journey(
    api: httpx.AsyncClient, db: Session, adb: AsyncSession, world
):
    v1 = "/api/v1"
    free, vip, series = world["free"], world["vip"], world["series"]

    # Đăng ký → xem tập miễn phí được, tập VIP thì không.
    user_id, _ = await signed_up(api)
    assert (await api.get(f"{v1}/episodes/{free}/play")).status_code == 200
    res = await api.get(f"{v1}/episodes/{vip}/play")
    assert res.status_code == 403 and res.json()["error"]["code"] == "vip_required"
    assert (await api.get(f"{v1}/me")).json()["is_vip"] is False

    # Được tặng VIP (Giai đoạn 5 sẽ là thanh toán) → xem tập VIP, lưu tiến độ, yêu thích.
    plan = VipPlan(name="Tháng", price_vnd=49000, duration_days=30)
    adb.add(plan)
    await adb.flush()
    await grant_vip(adb, user_id=user_id, plan=plan, actor=Actor.system(), reason="kiểm thử")
    await adb.commit()
    assert (await api.get(f"{v1}/me")).json()["is_vip"] is True
    assert (await api.get(f"{v1}/episodes/{vip}/play")).status_code == 200
    put = await api.put(f"{v1}/me/history/{vip}", json={"progress_sec": 600})
    assert put.status_code == 204
    assert (await api.put(f"{v1}/me/favorites/{series}")).status_code == 204

    # VIP hết hạn → tập VIP bị chặn lại, nhưng lịch sử và yêu thích vẫn còn.
    db.execute(
        text("UPDATE users SET vip_expires_at = now() - interval '1 second' WHERE id = :id"),
        {"id": user_id},
    )
    db.commit()
    assert (await api.get(f"{v1}/episodes/{vip}/play")).status_code == 403
    assert (await api.get(f"{v1}/episodes/{free}/play")).status_code == 200
    [item] = (await api.get(f"{v1}/me/history")).json()["items"]
    assert (item["episode"]["id"], item["progress_sec"]) == (vip, 600)
    assert [s["id"] for s in (await api.get(f"{v1}/me/favorites")).json()["items"]] == [series]

    # Đăng xuất → mọi thứ cần đăng nhập trả 401.
    assert (await api.post(f"{v1}/auth/logout")).status_code == 204
    for method, path in (
        ("GET", f"{v1}/me"),
        ("GET", f"{v1}/me/history"),
        ("GET", f"{v1}/episodes/{free}/play"),
        ("PUT", f"{v1}/me/favorites/{series}"),
    ):
        assert (await api.request(method, path)).status_code == 401, (method, path)
    # Catalog công khai vẫn xem được.
    assert (await api.get(f"{v1}/series/nang-tho")).json()["favorite_count"] == 1
