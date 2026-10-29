"""Lệnh cài đặt Stream: tạo khóa ký, đăng ký webhook (API Cloudflare giả lập)."""

import json
from collections.abc import Iterator

import httpx
import pytest

from app.cli import main
from app.core.config import Settings, get_settings
from app.services import stream
from app.tests import stream_keys

pytestmark = pytest.mark.usefixtures("stream_on")

KEY_ID = "8f926b2b01f383510025a78a4dcbf6a"
SECRET = "85011ed3a913c6ad5f9cf6c5573cc0a7"
ACCOUNT = f"/client/v4/accounts/{stream_keys.ACCOUNT_ID}/stream"


class FakeCloudflare:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.response = httpx.Response(200, json={"success": True, "result": {}})

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.response


@pytest.fixture
def cloudflare(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeCloudflare]:
    fake = FakeCloudflare()
    monkeypatch.setattr(stream, "transport", httpx.MockTransport(fake.handler))
    yield fake


def ok(result: dict) -> httpx.Response:
    return httpx.Response(200, json={"success": True, "errors": [], "result": result})


def env_lines(output: str) -> dict[str, str]:
    lines = [line for line in output.splitlines() if line.startswith("CF_")]
    return dict(line.split("=", 1) for line in lines)


def test_create_signing_key(cloudflare: FakeCloudflare, capsys):
    pem = stream_keys.pem_b64()
    cloudflare.response = ok({"id": KEY_ID, "pem": pem, "jwk": "x", "created": "2026-10-29"})
    assert main(["stream-create-signing-key"]) == 0
    [req] = cloudflare.requests
    assert (req.method, req.url.path) == ("POST", f"{ACCOUNT}/keys")
    assert req.headers["authorization"] == f"Bearer {stream_keys.API_TOKEN}"
    # In đúng dạng dán vào .env, và giá trị đó nạp được vào Settings.
    values = env_lines(capsys.readouterr().out)
    assert values == {"CF_STREAM_SIGNING_KEY_ID": KEY_ID, "CF_STREAM_SIGNING_KEY_PEM": pem}

    settings = Settings(
        _env_file=None,
        cf_stream_signing_key_id=values["CF_STREAM_SIGNING_KEY_ID"],
        cf_stream_signing_key_pem=values["CF_STREAM_SIGNING_KEY_PEM"],
    )
    assert settings.stream_signing_key is not None


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(403, json={"success": False, "errors": [{"code": 10000}]}),
        ok({"id": KEY_ID}),  # thiếu pem
        ok({"id": KEY_ID, "pem": "aGVsbG8="}),  # pem không dùng được
        httpx.Response(200, content=b"<html>"),
    ],
)
def test_create_signing_key_failures(cloudflare: FakeCloudflare, capsys, response):
    cloudflare.response = response
    assert main(["stream-create-signing-key"]) == 1
    captured = capsys.readouterr()
    assert "CF_STREAM_SIGNING_KEY" not in captured.out
    assert captured.err.startswith("Lỗi:")


def test_set_webhook(cloudflare: FakeCloudflare, capsys):
    url = "https://vdrama.vn/api/v1/webhooks/stream"
    cloudflare.response = ok({"notificationUrl": url, "modified": "x", "secret": SECRET})
    assert main(["stream-set-webhook", url]) == 0
    [req] = cloudflare.requests
    assert (req.method, req.url.path) == ("PUT", f"{ACCOUNT}/webhook")
    assert json.loads(req.content) == {"notificationUrl": url}
    assert env_lines(capsys.readouterr().out) == {"CF_STREAM_WEBHOOK_SECRET": SECRET}


def test_set_webhook_requires_https(cloudflare: FakeCloudflare, capsys):
    assert main(["stream-set-webhook", "http://vdrama.vn/api/v1/webhooks/stream"]) == 1
    assert "https://" in capsys.readouterr().err
    assert cloudflare.requests == []


def test_set_webhook_without_secret_fails(cloudflare: FakeCloudflare, capsys):
    cloudflare.response = ok({"notificationUrl": "https://x"})
    assert main(["stream-set-webhook", "https://vdrama.vn/api/v1/webhooks/stream"]) == 1


def test_not_configured(cloudflare: FakeCloudflare, capsys, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "")
    get_settings.cache_clear()
    assert main(["stream-create-signing-key"]) == 1
    assert "CF_ACCOUNT_ID" in capsys.readouterr().err
    assert cloudflare.requests == []
