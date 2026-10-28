"""GET /api/v1/search: tìm phim theo tên, không dấu, chỉ phim đã xuất bản."""

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models import Series
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import add_series

SEARCH = "/api/v1/search"


async def found(api: httpx.AsyncClient, q: str, **params) -> list[str]:
    res = await api.get(SEARCH, params={"q": q, **params})
    assert res.status_code == 200, res.text
    return [s["slug"] for s in res.json()["items"]]


@pytest.fixture
def library(db: Session) -> None:
    add_series(db, "nang-tho", title="Nàng Thơ", days=1)
    add_series(db, "nang-tho-mua-ha", title="Nàng Thơ Và Mùa Hạ Dài Nhất", days=5)
    add_series(db, "dao-hoang", title="Đảo Hoang Mùa Hạ", days=2)
    add_series(db, "tram-phan-tram", title="100% Yêu", days=3)
    add_series(db, "gach-duoi", title="Tên_Gạch Dưới", days=4)
    add_series(db, "gach-cheo", title="Phim A\\B", days=6)
    db.commit()


@pytest.mark.parametrize("q", ["nang tho", "Nàng Thơ", "NÀNG THƠ", "nàng tho", "  nang tho  "])
async def test_search_ignores_diacritics_and_case(api: httpx.AsyncClient, library, q: str):
    assert await found(api, q) == ["nang-tho", "nang-tho-mua-ha"]


async def test_closer_title_ranks_first(api: httpx.AsyncClient, library):
    """Tên sát từ khóa hơn đứng trước, dù phim kia mới hơn."""
    assert (await found(api, "nang tho"))[0] == "nang-tho"


async def test_partial_word_match(api: httpx.AsyncClient, library):
    assert set(await found(api, "mua ha")) == {"nang-tho-mua-ha", "dao-hoang"}


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("0%", ["tram-phan-tram"]),  # % là ký tự thường, không phải "khớp mọi thứ"
        ("%%", []),
        ("na_g", []),  # _ không phải "một ký tự bất kỳ" (nếu không sẽ khớp "nang")
        ("_oang", []),  # nếu không sẽ khớp "hoang"
        ("n_gach", ["gach-duoi"]),  # gạch dưới thật trong tên thì vẫn tìm được
        ("a\\b", ["gach-cheo"]),
        ("\\\\", []),
    ],
)
async def test_like_wildcards_are_literal(api: httpx.AsyncClient, library, q, expected):
    assert await found(api, q) == expected


async def test_same_score_newer_first(api: httpx.AsyncClient, db: Session):
    add_series(db, "trung-cu", title="Trùng Tên", days=1)
    add_series(db, "trung-moi", title="Trùng Tên", days=2)
    db.commit()
    assert await found(api, "trung ten") == ["trung-moi", "trung-cu"]


async def test_hidden_series_not_found(api: httpx.AsyncClient, db: Session, adb: AsyncSession):
    add_series(db, "nhap", title="Bí Mật Nháp", published=False)
    gone = add_series(db, "xoa", title="Bí Mật Đã Xóa", days=1)
    add_series(db, "con", title="Bí Mật Còn", days=2)
    db.commit()
    await soft_delete(adb, await adb.get(Series, gone.id), actor=Actor.system(), reason="test")
    await adb.commit()
    assert await found(api, "bi mat") == ["con"]


async def test_limit(api: httpx.AsyncClient, db: Session):
    for i in range(5):
        add_series(db, f"phim-{i}", title=f"Phim Hay {i}", days=i)
    db.commit()
    assert len(await found(api, "phim hay", limit=3)) == 3


async def test_result_items_are_series_cards(api: httpx.AsyncClient, library):
    res = await api.get(SEARCH, params={"q": "dao hoang"})
    [card] = res.json()["items"]
    assert card["title"] == "Đảo Hoang Mùa Hạ" and "genres" in card
    assert set(res.json()) == {"items"}


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"q": "a"},
        {"q": "  a  "},
        {"q": "x" * 101},
        {"q": "phim", "limit": 0},
        {"q": "phim", "limit": 51},
    ],
)
async def test_invalid_query_422(api: httpx.AsyncClient, params: dict):
    res = await api.get(SEARCH, params=params)
    assert res.status_code == 422
    assert error_code(res) == "validation_error"
    expected_field = "limit" if "limit" in params else "q"
    assert expected_field in [f["field"] for f in res.json()["error"]["fields"]]


async def test_two_char_query_allowed(api: httpx.AsyncClient, db: Session):
    add_series(db, "vo", title="Vợ Ơi")
    db.commit()
    assert await found(api, "vo") == ["vo"]
