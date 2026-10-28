"""Định dạng lỗi thống nhất {"error": {"code", "message"}}."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import ApiError, ErrorCode, register_error_handlers
from app.main import app as main_app


class Body(BaseModel):
    email: str
    password: str


def make_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.post("/echo")
    def echo(body: Body) -> dict:
        return {}

    @app.get("/api-error")
    def api_error() -> None:
        raise ApiError(
            401, ErrorCode.INVALID_CREDENTIALS, "Email hoặc mật khẩu không đúng.", {"X-A": "1"}
        )

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("chi tiết nội bộ")

    return app


client = TestClient(make_app(), raise_server_exceptions=False)


def test_api_error_format():
    res = client.get("/api-error")
    assert res.status_code == 401
    assert res.json() == {
        "error": {"code": "invalid_credentials", "message": "Email hoặc mật khẩu không đúng."}
    }
    assert res.headers["X-A"] == "1"


def test_validation_error_lists_fields_without_echoing_input():
    res = client.post("/echo", json={"email": "a@b.c", "password": 12345678})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    assert [f["field"] for f in err["fields"]] == ["password"]
    assert "12345678" not in res.text


def test_missing_body_is_validation_error():
    res = client.post("/echo")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_not_found_and_method_not_allowed():
    res = client.get("/khong-co")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
    res = client.get("/echo")
    assert res.status_code == 405
    assert res.json()["error"]["code"] == "method_not_allowed"


def test_unhandled_error_hides_details():
    res = client.get("/boom")
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "internal_error"
    assert "chi tiết nội bộ" not in res.text


def test_main_app_uses_error_format():
    res = TestClient(main_app).get("/api/khong-co")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
