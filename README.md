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

# Hoặc cả bộ (web + api + Postgres)
docker compose -f docker-compose.dev.yml up --build
```

## Kiểm tra

```bash
cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd apps/web && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```
