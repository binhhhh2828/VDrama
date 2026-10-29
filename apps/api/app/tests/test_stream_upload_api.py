"""POST /admin/episodes/{id}/upload: tạo upload tus trên Cloudflare (giả lập), audit, quyền."""

import base64
from collections.abc import Callable, Iterator

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog, Episode, Series
from app.services import stream
from app.services.audit import Actor
from app.services.soft_delete import soft_delete
from app.tests import stream_keys
from app.tests.test_auth_api import error_code
from app.tests.test_catalog_api import add_episode, add_series, become_admin
from app.tests.test_me_admin import signed_up

pytestmark = pytest.mark.usefixtures("stream_on")

VIDEO_ID = "0123456789abcdef0123456789abcdef"
UPLOAD_URL = f"https://upload.videodelivery.net/tus/{VIDEO_ID}?tusv2=true"
SIZE = 734_003_200


class FakeCloudflare:
    """Ghi lại request gửi tới Cloudflare và trả phản hồi tùy test chỉnh."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.respond: Callable[[httpx.Request], httpx.Response] = lambda _: httpx.Response(
            201,
            headers={"Location": UPLOAD_URL, "stream-media-id": VIDEO_ID, "Tus-Resumable": "1.0.0"},
        )

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.respond(request)


@pytest.fixture
def cloudflare(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeCloudflare]:
    fake = FakeCloudflare()
    monkeypatch.setattr(stream, "transport", httpx.MockTransport(fake.handler))
    yield fake


@pytest.fixture
def draft_episode(db: Session) -> Episode:
    """Tập chưa xuất bản, đã có video cũ."""
    s = add_series(db, "nang-tho")
    ep = add_episode(
        db, s, 1, published=False, stream_status="error", duration_sec=60, thumbnail_url="x"
    )
    db.commit()
    return ep


def url(episode: Episode | int) -> str:
    episode_id = episode if isinstance(episode, int) else episode.id
    return f"/api/v1/admin/episodes/{episode_id}/upload"


def reload(db: Session, episode: Episode) -> Episode:
    db.expire_all()
    return db.get(Episode, episode.id)


def upload_logs(db: Session) -> list[AuditLog]:
    db.expire_all()
    return list(db.scalars(select(AuditLog).where(AuditLog.action == "episodes.upload_start")))


# --- Thành công ---


async def test_admin_starts_upload(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, draft_episode: Episode
):
    old_video = draft_episode.stream_video_id
    await become_admin(api, db)
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 201, res.text
    assert res.json() == {"upload_url": UPLOAD_URL, "video_id": VIDEO_ID}

    ep = reload(db, draft_episode)
    assert ep.stream_video_id == VIDEO_ID
    assert ep.stream_status == "uploading"
    assert ep.duration_sec is None and ep.thumbnail_url is None

    [log] = upload_logs(db)
    assert log.actor_type == "admin"
    assert log.entity_type == "episodes" and log.entity_id == str(ep.id)
    # Id video cũ còn trong nhật ký để dọn trên Cloudflare sau này.
    assert log.changes["stream_video_id"] == [old_video, VIDEO_ID]
    assert log.changes["stream_status"] == ["error", "uploading"]
    assert log.changes["size_bytes"] == SIZE


async def test_request_sent_to_cloudflare(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, draft_episode: Episode
):
    await become_admin(api, db)
    await api.post(url(draft_episode), json={"size_bytes": SIZE})
    [req] = cloudflare.requests
    assert req.method == "POST"
    assert req.url.host == "api.cloudflare.com"
    assert req.url.path == f"/client/v4/accounts/{stream_keys.ACCOUNT_ID}/stream"
    assert req.url.params["direct_user"] == "true"
    assert req.headers["authorization"] == f"Bearer {stream_keys.API_TOKEN}"
    assert req.headers["tus-resumable"] == "1.0.0"
    assert req.headers["upload-length"] == str(SIZE)
    assert req.content == b""  # không gửi file qua API, chỉ tạo upload
    pairs = dict((p.split(" ") + [""])[:2] for p in req.headers["upload-metadata"].split(","))
    assert base64.b64decode(pairs["maxDurationSeconds"]).decode() == "14400"
    assert pairs["requiresignedurls"] == ""  # khóa không có giá trị


def test_tus_metadata_format():
    assert stream.tus_metadata(max_duration_sec=600) == "maxDurationSeconds NjAw,requiresignedurls"


async def test_video_id_taken_from_location_when_header_missing(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, draft_episode: Episode
):
    cloudflare.respond = lambda _: httpx.Response(201, headers={"Location": UPLOAD_URL})
    await become_admin(api, db)
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 201, res.text
    assert reload(db, draft_episode).stream_video_id == VIDEO_ID


async def test_new_episode_without_video(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare
):
    """Tập mới chưa có video nào."""
    s = add_series(db, "moi")
    ep = Episode(series_id=s.id, number=1)
    db.add(ep)
    db.commit()
    await become_admin(api, db)
    assert (await api.post(url(ep), json={"size_bytes": 1})).status_code == 201
    [log] = upload_logs(db)
    assert log.changes["stream_video_id"] == [None, VIDEO_ID]


# --- Cloudflare lỗi: 502, DB không đổi ---


def _no_location(_: httpx.Request) -> httpx.Response:
    return httpx.Response(201)


def _bad_id(_: httpx.Request) -> httpx.Response:
    return httpx.Response(201, headers={"Location": "https://upload.example/tus/../x"})


def _http_location(_: httpx.Request) -> httpx.Response:
    return httpx.Response(201, headers={"Location": UPLOAD_URL.replace("https", "http")})


def _server_error(_: httpx.Request) -> httpx.Response:
    return httpx.Response(500, json={"success": False, "errors": [{"message": "boom"}]})


def _unauthorized(_: httpx.Request) -> httpx.Response:
    return httpx.Response(403, json={"success": False})


def _timeout(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectTimeout("timeout", request=request)


@pytest.mark.parametrize(
    "respond", [_no_location, _bad_id, _http_location, _server_error, _unauthorized, _timeout]
)
async def test_provider_failure_502_and_nothing_changes(
    api: httpx.AsyncClient,
    db: Session,
    cloudflare: FakeCloudflare,
    draft_episode: Episode,
    respond,
):
    before = (draft_episode.stream_video_id, draft_episode.stream_status)
    cloudflare.respond = respond
    await become_admin(api, db)
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 502
    assert error_code(res) == "stream_provider_error"
    ep = reload(db, draft_episode)
    assert (ep.stream_video_id, ep.stream_status) == before
    assert upload_logs(db) == []


async def test_not_configured_503(
    api: httpx.AsyncClient,
    db: Session,
    cloudflare: FakeCloudflare,
    draft_episode: Episode,
    monkeypatch: pytest.MonkeyPatch,
):
    await become_admin(api, db)
    monkeypatch.setenv("CF_STREAM_API_TOKEN", "")
    get_settings.cache_clear()
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 503
    assert error_code(res) == "stream_unavailable"
    assert cloudflare.requests == []


# --- Tập không thay được ---


async def test_published_episode_409(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare
):
    s = add_series(db, "dang-chieu")
    ep = add_episode(db, s, 1)
    db.commit()
    await become_admin(api, db)
    res = await api.post(url(ep), json={"size_bytes": SIZE})
    assert res.status_code == 409
    assert error_code(res) == "conflict"
    assert cloudflare.requests == []  # không tạo video thừa trên Cloudflare
    assert reload(db, ep).stream_status == "ready"


async def test_unknown_episode_404(api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare):
    await become_admin(api, db)
    assert (await api.post(url(999999), json={"size_bytes": SIZE})).status_code == 404
    assert cloudflare.requests == []


@pytest.mark.parametrize("target", ["episode", "series"])
async def test_deleted_404(
    api: httpx.AsyncClient,
    db: Session,
    adb: AsyncSession,
    cloudflare: FakeCloudflare,
    draft_episode: Episode,
    target: str,
):
    model, obj_id = (
        (Episode, draft_episode.id) if target == "episode" else (Series, draft_episode.series_id)
    )
    await soft_delete(adb, await adb.get(model, obj_id), actor=Actor.system(), reason="test")
    await adb.commit()
    await become_admin(api, db)
    assert (await api.post(url(draft_episode), json={"size_bytes": SIZE})).status_code == 404
    assert cloudflare.requests == []


# --- Quyền, CSRF, dữ liệu vào ---


async def test_guest_401(api: httpx.AsyncClient, cloudflare: FakeCloudflare, draft_episode):
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 401
    assert cloudflare.requests == []


async def test_user_403(api: httpx.AsyncClient, cloudflare: FakeCloudflare, draft_episode):
    await signed_up(api)
    res = await api.post(url(draft_episode), json={"size_bytes": SIZE})
    assert res.status_code == 403
    assert error_code(res) == "forbidden"
    assert cloudflare.requests == []


async def test_csrf_foreign_origin_403(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, draft_episode
):
    await become_admin(api, db)
    res = await api.post(
        url(draft_episode), json={"size_bytes": SIZE}, headers={"Origin": "https://evil.example"}
    )
    assert res.status_code == 403
    assert cloudflare.requests == []


@pytest.mark.parametrize(
    "body",
    [
        {"size_bytes": 0},
        {"size_bytes": -1},
        {"size_bytes": 10 * 1024**3 + 1},  # quá giới hạn mặc định 10 GB
        {},
        {"size_bytes": SIZE, "stream_video_id": "khac"},
    ],
)
async def test_invalid_body_422(
    api: httpx.AsyncClient, db: Session, cloudflare: FakeCloudflare, draft_episode, body
):
    await become_admin(api, db)
    res = await api.post(url(draft_episode), json=body)
    assert res.status_code == 422
    assert cloudflare.requests == []


async def test_max_size_configurable(
    api: httpx.AsyncClient,
    db: Session,
    cloudflare: FakeCloudflare,
    draft_episode,
    monkeypatch: pytest.MonkeyPatch,
):
    await become_admin(api, db)
    monkeypatch.setenv("STREAM_MAX_UPLOAD_BYTES", "1000")
    get_settings.cache_clear()
    assert (await api.post(url(draft_episode), json={"size_bytes": 1001})).status_code == 422
    assert (await api.post(url(draft_episode), json={"size_bytes": 1000})).status_code == 201
