import httpx


async def test_health_db_not_configured(client: httpx.AsyncClient, set_database_url):
    set_database_url("")
    res = await client.get("/api/health/db")
    assert res.status_code == 503
    assert res.json()["reason"] == "database not configured"


async def test_health_db_unreachable(client: httpx.AsyncClient, set_database_url, monkeypatch):
    monkeypatch.setenv("DB_CONNECT_TIMEOUT", "2")
    # Cổng 1 không có gì lắng nghe: kết nối bị từ chối ngay.
    set_database_url("postgresql://vdrama:vdrama@127.0.0.1:1/vdrama")
    res = await client.get("/api/health/db")
    assert res.status_code == 503
    assert res.json()["reason"] == "database unreachable"


async def test_health_db_ok(client: httpx.AsyncClient, set_database_url, test_db_url):
    set_database_url(test_db_url)
    res = await client.get("/api/health/db")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_liveness_does_not_touch_db(client: httpx.AsyncClient, set_database_url):
    set_database_url("postgresql://vdrama:vdrama@127.0.0.1:1/vdrama")
    res = await client.get("/api/health")
    assert res.status_code == 200
