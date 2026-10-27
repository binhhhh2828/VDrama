# VDrama

Website xem phim bộ có tài khoản và gói VIP. Kế hoạch đầy đủ: [plan.md](plan.md). Quy trình làm việc với Claude Code: [CLAUDE.md](CLAUDE.md).

## Chạy local

Cần: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 24 + pnpm, Docker (tùy chọn).

```bash
# API  → http://localhost:8000/api/health
cd apps/api && uv sync && uv run uvicorn app.main:app --reload
# Windows: thêm  --loop app.core.loop:selector_loop_factory

# Web  → http://localhost:3000  (API_PROXY_TARGET=http://localhost:8000 để proxy /api)
cd apps/web && pnpm install && pnpm dev

# Hoặc cả bộ (Postgres + migration + api + web): http://localhost:3000, http://localhost:8000/api/health/db
docker compose -f docker-compose.dev.yml up --build
```

## Database

PostgreSQL, SQLAlchemy 2 async + psycopg 3, migration bằng Alembic (`apps/api/alembic/versions/`, mỗi nhóm bảng một file `000N_*.py`). Thiết kế bảng và lý do: [docs/plans/gd2-b1-database.md](docs/plans/gd2-b1-database.md).

Chạy bằng compose thì migration tự chạy (service `migrate`) trước khi API khởi động. Khi chạy API trực tiếp trên máy:

```bash
docker compose -f docker-compose.dev.yml up -d db
cd apps/api
export DATABASE_URL=postgresql://vdrama:vdrama@localhost:5432/vdrama
uv run alembic upgrade head                                      # áp dụng migration
uv run alembic revision --autogenerate -m "mô tả" --rev-id 0007  # tạo migration mới, nhớ đọc và chỉnh tay
uv run alembic check                                             # model và migration có khớp nhau không
```

Test cần Postgres đọc `TEST_DATABASE_URL`; mỗi test tạo một database tạm riêng rồi xóa, không đụng dữ liệu dev:

```bash
cd apps/api && TEST_DATABASE_URL=postgresql://vdrama:vdrama@localhost:5432/vdrama uv run pytest -q
```

## Kiểm tra

```bash
cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd apps/web && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```
