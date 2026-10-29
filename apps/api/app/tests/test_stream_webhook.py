"""Webhook Stream (chữ ký, cập nhật trạng thái tập) và đồng bộ tay của admin."""

import json
import time
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.models import AuditLog, Episode
from app.models.enums import StreamStatus
from app.services import stream
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.services.stream import InvalidWebhookSignatureError, parse_video, verify_webhook
from app.tests import stream_keys
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import BASE, add_episode, add_series, become_admin
from app.tests.test_me_admin import signed_up

pytestmark = pytest.mark.usefixtures("stream_on")

VIDEO_ID = "ea95132c15732412d22c1476fa83f27a"
OTHER_ID = "ffffffffffffffffffffffffffffffff"
THUMB = f"https://customer-x.cloudflarestream.com/{VIDEO_ID}/thumbnails/thumbnail.jpg"
WEBHOOK = "/api/v1/webhooks/stream"


def video(uid: str = VIDEO_ID, *, state: str = "ready", **kw) -> dict:
    """Thân webhook theo ví dụ trong tài liệu Cloudflare (rút gọn)."""
    status = {
        "state": state,
        "pctComplete": "100.000000",
        "errorReasonCode": "",
        **kw.pop("status", {}),
    }
    return {
        "uid": uid,
        "readyToStream": state == "ready",
        "status": status,
        "requireSignedURLs": True,
        "duration": 1520.4,
        "thumbnail": THUMB,
        "meta": {},
        **kw,
    }


def sign(body: bytes, *, ts: int | None = None, secret: str = stream_keys.WEBHOOK_SECRET) -> str:
    ts = int(time.time()) if ts is None else ts
    return f"time={ts},sig1={stream.webhook_signature(secret, ts, body)}"


class FakeCloudflare:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.video: dict = video()
        self.fail_updates = False
        self.fail_get = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.method == "GET":
            if self.fail_get:
                return httpx.Response(500, json={"success": False})
            return httpx.Response(200, json={"success": True, "result": self.video})
        if self.fail_updates:
            return httpx.Response(500, json={"success": False})
        return httpx.Response(200, json={"success": True, "result": {"uid": VIDEO_ID}})

    def origin_updates(self) -> list[dict]:
        return [json.loads(r.content) for r in self.requests if r.method == "POST"]


@pytest.fixture
def cloudflare(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeCloudflare]:
    fake = FakeCloudflare()
    monkeypatch.setattr(stream, "transport", httpx.MockTransport(fake.handler))
    yield fake


@pytest_asyncio.fixture
async def cf(api: httpx.AsyncClient) -> AsyncIterator[httpx.AsyncClient]:
    """Client như Cloudflare gọi tới: không Origin, không cookie (`api` để trỏ đúng DB)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as c:
        yield c


async def send(cf: httpx.AsyncClient, payload: dict | bytes, **kw) -> httpx.Response:
    body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "Webhook-Signature": sign(body, **kw)}
    return await cf.post(WEBHOOK, content=body, headers=headers)


@pytest.fixture
def uploading(db: Session) -> Episode:
    s = add_series(db, "nang-tho")
    ep = add_episode(db, s, 1, published=False, stream_status="uploading")
    ep.stream_video_id = VIDEO_ID
    db.commit()
    return ep


def reload(db: Session, episode: Episode) -> Episode:
    db.expire_all()
    return db.get(Episode, episode.id)


def logs(db: Session, action: str) -> list[AuditLog]:
    db.expire_all()
    return list(db.scalars(select(AuditLog).where(AuditLog.action == action)))


def site_host() -> str:
    return urlsplit(get_settings().public_origin).netloc


# --- Webhook: cập nhật trạng thái ---


async def test_ready_updates_episode(
    cf: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    res = await send(cf, video())
    assert res.status_code == 200, res.text
    assert res.json() == {"result": "updated"}
    ep = reload(db, uploading)
    assert ep.stream_status == "ready"
    assert ep.duration_sec == 1520
    assert ep.thumbnail_url == THUMB
    [log] = logs(db, "episodes.stream_update")
    assert log.actor_type == "webhook" and log.actor_user_id is None
    assert log.changes["stream_status"] == ["uploading", "ready"]
    # Chạy nền sau khi trả lời: chỉ cho nhúng trên domain của site.
    assert cloudflare.origin_updates() == [{"allowedOrigins": [site_host()]}]
    [req] = cloudflare.requests
    assert req.url.path == f"/client/v4/accounts/{stream_keys.ACCOUNT_ID}/stream/{VIDEO_ID}"


async def test_duplicate_event_is_noop(
    cf: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    assert (await send(cf, video())).json() == {"result": "updated"}
    assert (await send(cf, video())).json() == {"result": "unchanged"}
    assert len(logs(db, "episodes.stream_update")) == 1
    assert len(cloudflare.origin_updates()) == 1


async def test_keeps_thumbnail_chosen_by_admin(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode
):
    db.execute(
        text("UPDATE episodes SET thumbnail_url = 'https://anh/rieng.jpg' WHERE id = :id"),
        {"id": uploading.id},
    )
    db.commit()
    await send(cf, video())
    assert reload(db, uploading).thumbnail_url == "https://anh/rieng.jpg"


async def test_error_state(cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode):
    payload = video(state="error", status={"errorReasonCode": "ERR_MALFORMED_VIDEO"})
    assert (await send(cf, payload)).status_code == 200
    ep = reload(db, uploading)
    assert ep.stream_status == "error"
    assert ep.duration_sec is None
    [log] = logs(db, "episodes.stream_update")
    assert log.changes["error_code"] == "ERR_MALFORMED_VIDEO"
    assert cloudflare.origin_updates() == []


async def test_ready_without_signed_urls_marked_error(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode
):
    """Video xem công khai được: không đánh dấu ready (sẽ lộ phim VIP khi xuất bản)."""
    await send(cf, video(requireSignedURLs=False))
    assert reload(db, uploading).stream_status == "error"
    assert cloudflare.origin_updates() == []


async def test_unknown_video_ignored(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode
):
    res = await send(cf, video(OTHER_ID))
    assert res.status_code == 200
    assert res.json() == {"result": "unknown_video"}
    assert reload(db, uploading).stream_status == "uploading"
    assert logs(db, "episodes.stream_update") == []


async def test_published_episode_not_downgraded(cf: httpx.AsyncClient, db: Session, cloudflare):
    s = add_series(db, "dang-chieu")
    ep = add_episode(db, s, 1)
    ep.stream_video_id = VIDEO_ID
    db.commit()
    res = await send(cf, video(state="error"))
    assert res.json() == {"result": "skipped_published"}
    assert reload(db, ep).stream_status == "ready"


async def test_deleted_episode_still_updated(
    cf: httpx.AsyncClient, db: Session, adb: AsyncSession, cloudflare, uploading: Episode
):
    await soft_delete(adb, await adb.get(Episode, uploading.id), actor=Actor.system(), reason="x")
    await adb.commit()
    assert (await send(cf, video())).json() == {"result": "updated"}
    db.expire_all()
    status = db.scalar(
        text("SELECT stream_status FROM episodes WHERE id = :id"), {"id": uploading.id}
    )
    assert status == "ready"


async def test_can_publish_after_ready(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode
):
    await send(cf, video())
    ep = reload(db, uploading)
    ep.is_published, ep.published_at = True, BASE
    db.commit()  # CHECK publish_requires_ready cho qua


async def test_allowed_origins_failure_keeps_ready(
    cf: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    cloudflare.fail_updates = True
    assert (await send(cf, video())).status_code == 200
    assert reload(db, uploading).stream_status == "ready"


# --- Webhook: xác thực ---


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Webhook-Signature": ""},
        {"Webhook-Signature": "sig1=abc"},
        {"Webhook-Signature": "time=abc,sig1=abc"},
    ],
)
async def test_missing_or_malformed_signature_401(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading: Episode, headers
):
    res = await cf.post(WEBHOOK, content=json.dumps(video()).encode(), headers=headers)
    assert res.status_code == 401
    assert error_code(res) == "invalid_signature"
    assert reload(db, uploading).stream_status == "uploading"


async def test_wrong_secret_401(cf: httpx.AsyncClient, db: Session, cloudflare, uploading):
    res = await send(cf, video(), secret="khoa-khac")
    assert res.status_code == 401
    assert reload(db, uploading).stream_status == "uploading"


async def test_tampered_body_401(cf: httpx.AsyncClient, db: Session, cloudflare, uploading):
    body = json.dumps(video(state="error")).encode()
    header = sign(body)
    tampered = json.dumps(video()).encode()
    res = await cf.post(WEBHOOK, content=tampered, headers={"Webhook-Signature": header})
    assert res.status_code == 401
    assert reload(db, uploading).stream_status == "uploading"


@pytest.mark.parametrize("offset", [-301, 301])
async def test_stale_or_future_timestamp_401(
    cf: httpx.AsyncClient, db: Session, cloudflare, uploading, offset: int
):
    """Chống phát lại: chữ ký đúng nhưng lệch quá 5 phút."""
    res = await send(cf, video(), ts=int(time.time()) + offset)
    assert res.status_code == 401
    assert reload(db, uploading).stream_status == "uploading"


async def test_not_configured_503(
    cf: httpx.AsyncClient, cloudflare, uploading, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("CF_STREAM_WEBHOOK_SECRET", "")
    get_settings.cache_clear()
    res = await send(cf, video())
    assert res.status_code == 503


@pytest.mark.parametrize(
    "payload", [b"khong phai json", b"[]", json.dumps({"uid": "ngan"}).encode()]
)
async def test_bad_payload_400(cf: httpx.AsyncClient, cloudflare, uploading, payload: bytes):
    res = await send(cf, payload)
    assert res.status_code == 400
    assert error_code(res) == "bad_request"


async def test_body_too_large_413(cf: httpx.AsyncClient, cloudflare, uploading):
    payload = video(meta={"x": "a" * 70_000})
    res = await send(cf, payload)
    assert res.status_code == 413
    assert error_code(res) == "payload_too_large"


def test_verify_webhook_unit():
    body = b'{"uid":"x"}'
    now = datetime(2026, 10, 29, tzinfo=UTC)
    ts = int(now.timestamp())
    verify_webhook(sign(body, ts=ts), body, stream_keys.WEBHOOK_SECRET, now=now)
    verify_webhook(sign(body, ts=ts - 300), body, stream_keys.WEBHOOK_SECRET, now=now)
    # Chữ ký hex viết hoa vẫn hợp lệ; thứ tự trường không quan trọng.
    sig = stream.webhook_signature(stream_keys.WEBHOOK_SECRET, ts, body)
    verify_webhook(f"sig1={sig.upper()}, time={ts}", body, stream_keys.WEBHOOK_SECRET, now=now)
    with pytest.raises(InvalidWebhookSignatureError):
        verify_webhook(sign(body, ts=ts), body + b" ", stream_keys.WEBHOOK_SECRET, now=now)


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (video(), StreamStatus.READY),
        (video(readyToStream=False), StreamStatus.PROCESSING),
        (video(state="inprogress"), StreamStatus.PROCESSING),
        (video(state="queued"), StreamStatus.PROCESSING),
        (video(state="pendingupload"), StreamStatus.UPLOADING),
        (video(state="error"), StreamStatus.ERROR),
        ({"uid": VIDEO_ID}, StreamStatus.PROCESSING),
    ],
)
def test_parse_video_status(data, expected):
    assert parse_video(data).status == expected


def test_parse_video_fields():
    v = parse_video(video(duration=-1, thumbnail="http://khong-https"))
    assert v.duration_sec is None and v.thumbnail_url is None
    assert parse_video(video(duration=59.6)).duration_sec == 60
    assert parse_video(video(duration=True)).duration_sec is None
    # Tài liệu Cloudflare viết tên trường lỗi theo hai kiểu.
    alt = {"uid": VIDEO_ID, "status": {"state": "error", "errReasonCode": "ERR_NON_VIDEO"}}
    assert parse_video(alt).error_code == "ERR_NON_VIDEO"
    assert parse_video({**video(), "requireSignedURLs": "true"}).require_signed_urls is False
    for bad in ({}, {"uid": "ngan"}, {"uid": 123}):
        with pytest.raises(ValueError):
            parse_video(bad)


# --- Đồng bộ tay ---


def sync_url(episode: Episode | int) -> str:
    episode_id = episode if isinstance(episode, int) else episode.id
    return f"/api/v1/admin/episodes/{episode_id}/stream-sync"


async def test_admin_sync_applies_state(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    await become_admin(api, db)
    res = await api.post(sync_url(uploading))
    assert res.status_code == 200, res.text
    assert res.json() == {
        "episode_id": uploading.id,
        "video_id": VIDEO_ID,
        "stream_status": "ready",
        "duration_sec": 1520,
        "thumbnail_url": THUMB,
        "result": "updated",
    }
    get = cloudflare.requests[0]
    assert get.method == "GET"
    assert get.url.path == f"/client/v4/accounts/{stream_keys.ACCOUNT_ID}/stream/{VIDEO_ID}"
    [log] = logs(db, "episodes.stream_sync")
    assert log.actor_type == "admin"
    assert cloudflare.origin_updates() == [{"allowedOrigins": [site_host()]}]
    # Lần hai không đổi gì.
    assert (await api.post(sync_url(uploading))).json()["result"] == "unchanged"
    assert len(logs(db, "episodes.stream_sync")) == 1


async def test_sync_still_processing(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    cloudflare.video = video(state="inprogress")
    await become_admin(api, db)
    body = (await api.post(sync_url(uploading))).json()
    assert body["stream_status"] == "processing"
    assert cloudflare.origin_updates() == []


async def test_sync_episode_without_video_409(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare
):
    s = add_series(db, "moi")
    ep = Episode(series_id=s.id, number=1)
    db.add(ep)
    db.commit()
    await become_admin(api, db)
    res = await api.post(sync_url(ep))
    assert res.status_code == 409
    assert cloudflare.requests == []


@pytest.mark.parametrize("bad", ["other_uid", "error"])
async def test_sync_provider_problem_502(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode, bad
):
    if bad == "other_uid":
        cloudflare.video = video(OTHER_ID)
    else:
        cloudflare.fail_get = True
    await become_admin(api, db)
    res = await api.post(sync_url(uploading))
    assert res.status_code == 502
    assert reload(db, uploading).stream_status == "uploading"


async def test_sync_permissions(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, uploading: Episode
):
    assert (await api.post(sync_url(uploading))).status_code == 401
    await signed_up(api)
    assert (await api.post(sync_url(uploading))).status_code == 403
    assert cloudflare.requests == []


async def test_sync_unknown_episode_404(api: httpx.AsyncClient, db: Session, cloudflare):
    await become_admin(api, db)
    assert (await api.post(sync_url(999999))).status_code == 404
