# VDrama

Website xem phim bộ có tài khoản và gói VIP. Kế hoạch đầy đủ: [plan.md](plan.md). Quy trình làm việc với Claude Code: [CLAUDE.md](CLAUDE.md).

## Chạy local

Cần: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 24 + pnpm, Docker (tùy chọn).

Trong VS Code, cài extension Python của Microsoft. Workspace đã cấu hình để tự kích hoạt môi trường `apps\api\.venv` trong terminal mới. Lần đầu mở dự án, chạy `uv sync` trong thư mục `apps\api` để tạo môi trường; nếu terminal đã mở trước đó, hãy mở terminal mới.

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

## Auth

Đăng ký, đăng nhập, refresh, đăng xuất, `/me` dưới `/api/v1`; cookie httpOnly, không CORS. Tài liệu cho frontend (định dạng lỗi, cookie, CSRF, rate limit, phân quyền): [docs/api.md](docs/api.md). Thiết kế và lý do: [docs/plans/gd2-b2-auth.md](docs/plans/gd2-b2-auth.md).

Cấu hình trong `.env` (mẫu ở [.env.example](.env.example)): `JWT_SECRET` (bắt buộc ở prod), `PUBLIC_ORIGIN`, `COOKIE_SECURE` (dev đặt `false`), `TRUST_CLOUDFLARE_IP`. Ở `ENV=prod`, API không khởi động nếu thiếu `JWT_SECRET`, cookie không Secure, origin không phải https hoặc chưa bật `TRUST_CLOUDFLARE_IP`.

Tạo admin (chạy trên server, hỏi mật khẩu, ghi nhật ký):

```bash
cd apps/api && uv run python -m app.cli create-admin --email admin@vdrama.vn --reason "Admin đầu tiên"
```

Thử nhanh bằng curl khi chạy compose (lệnh thay đổi dữ liệu cần header `Origin`):

```bash
curl -i -c jar -b jar -H "Origin: http://localhost:3000" -H "Content-Type: application/json"   -d '{"email":"a@example.com","password":"mat-khau-dai","display_name":"A","accept_terms":true}'   http://localhost:8000/api/v1/auth/register
curl -b jar http://localhost:8000/api/v1/me
```

Cổng trên máy trùng với dự án khác thì đổi khi chạy compose: `DB_PORT=55432 API_PORT=8001 WEB_PORT=3001 docker compose -f docker-compose.dev.yml up --build`.

## Catalog

Danh sách phim, chi tiết, danh sách tập, thể loại, tìm kiếm không dấu dưới `/api/v1` (tài liệu: [docs/api.md](docs/api.md#catalog), thiết kế: [docs/plans/gd2-b3-catalog.md](docs/plans/gd2-b3-catalog.md)). Dữ liệu mẫu cho dev và demo (tiếng Anh: 12 phim, 3 gói VIP, 3 tài khoản demo; không chạy ở prod, chạy lại không trùng). Tài khoản demo dùng chung mật khẩu lấy từ biến `DEMO_PASSWORD` (8–128 ký tự, tự đặt); thiếu biến này thì chỉ bỏ qua phần tài khoản:

| Email | Vai trò |
|---|---|
| `viewer@example.com` | Người xem thường (tập VIP bị khóa) |
| `vip@example.com` | Người xem có VIP 30 ngày |
| `admin@example.com` | Admin |

```bash
docker compose -f docker-compose.dev.yml exec -e DEMO_PASSWORD='mật-khẩu-demo' api python -m app.cli seed-demo
# hoặc chạy trực tiếp: cd apps/api && DEMO_PASSWORD='mật-khẩu-demo' uv run python -m app.cli seed-demo
curl "http://localhost:8000/api/v1/series?sort=hot&limit=5"
curl "http://localhost:8000/api/v1/search?q=city"
```

Seed chỉ thêm phần còn thiếu (theo slug phim, tên gói, email). DB dev đã có dữ liệu mẫu tiếng Việt cũ (trước 2026-10-29) thì xóa DB rồi seed lại: `docker compose -f docker-compose.dev.yml down -v` (xóa **toàn bộ** dữ liệu dev), rồi `up` và chạy lệnh trên.

## Video (Cloudflare Stream)

Xem tập `GET /api/v1/episodes/{id}/play` (chỗ duy nhất kiểm tra quyền xem), upload video cho admin, webhook chuyển mã (tài liệu: [docs/api.md](docs/api.md#xem-tập), thiết kế: [docs/plans/gd2-b4-stream-play.md](docs/plans/gd2-b4-stream-play.md)). Dev chưa có tài khoản Cloudflare vẫn chạy được: `play` trả 503 `stream_unavailable`.

Cài đặt một lần cho mỗi môi trường:

1. Trên Cloudflare: lấy Account ID, tạo API token có quyền **Stream: Edit**, xem customer code (phần `customer-<code>` trong URL phát của một video bất kỳ). Đặt `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, `CF_STREAM_CUSTOMER_CODE` trong `.env`.
2. Tạo khóa ký token, dán hai dòng in ra vào `.env` (khóa chỉ hiện một lần):

   ```bash
   cd apps/api && uv run python -m app.cli stream-create-signing-key
   ```

3. Prod: đăng ký webhook, dán `CF_STREAM_WEBHOOK_SECRET` in ra vào `.env`. Mỗi tài khoản Cloudflare chỉ có **một** URL webhook: đừng đăng ký từ dev nếu dùng chung tài khoản với prod; dev dùng nút đồng bộ tay (`POST /api/v1/admin/episodes/{id}/stream-sync`).

   ```bash
   cd apps/api && uv run python -m app.cli stream-set-webhook https://vdrama.vn/api/v1/webhooks/stream
   ```

## Kiểm tra

```bash
cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
cd apps/web && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build
```
