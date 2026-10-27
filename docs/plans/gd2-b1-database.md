# Plan: Giai đoạn 2 / bước đầu — Nền DB (async), Alembic, migration theo từng nhóm bảng

> Trạng thái: **đã duyệt hướng; Bước 1 đang làm. Các bước 3–6 (thiết kế bảng) cần bạn đọc lại mục "Thiết kế bảng" trước khi code.**
> Liên quan: `plan.md` mục 4 (mô hình dữ liệu) và Giai đoạn 2. Mục 4 của `plan.md` sẽ được cập nhật theo plan này khi xong.

## Mục tiêu và phạm vi

Nền DB hoàn chỉnh cho backend: kết nối Postgres **async**, mô hình SQLAlchemy cho toàn bộ bảng, và các migration Alembic tách theo nhóm bảng. Chạy và test được trên Postgres local (compose dev); cấu hình sẵn để trỏ sang Neon bằng biến môi trường. **Thiết kế để lên ~1000 người dùng (và xa hơn) mà không phải đập đi làm lại.**

**Không làm** (để các bước sau): endpoint nghiệp vụ (auth, catalog…), seed dữ liệu, kết nối Neon thật (cần tài khoản của bạn), chạy migration tự động khi deploy (Giai đoạn 6).

## Nguyên tắc để dễ scale

Ở quy mô 1000 người, Postgres đơn lẻ dư sức. Cái khó scale thường không phải "bảng nhiều" mà là: ghi liên tục vào cùng một dòng, thiếu index trên khóa ngoại, đếm toàn bảng, kết nối cạn, và migration khóa bảng. Plan xử lý đúng những chỗ đó:

1. **App phải stateless, trạng thái ở DB**: phiên đăng nhập nằm trong bảng `sessions`, không giữ trong bộ nhớ process. Nhờ đó chạy nhiều worker/nhiều container API mà không đổi code. (Lưu ý cho sau: `slowapi` rate limit mặc định lưu trong RAM từng process, khi chạy nhiều instance cần chuyển sang kho chung hoặc để Caddy/Cloudflare lo.)
2. **Tách dữ liệu ghi nhiều khỏi dữ liệu ổn định**: lượt xem/đếm nằm ở `series_stats` riêng, không `UPDATE` thẳng lên dòng `series`. Dòng catalog ít đổi nên cache/đọc nhanh, không bị bloat do update liên tục.
3. **Hot write dùng upsert 1 dòng/khóa**: `watch_history` ghi đè theo `(user_id, episode_id)` thay vì chèn dòng mới mỗi lần báo tiến độ; đặt `fillfactor` thấp để update tại chỗ (HOT), client chỉ gửi tiến độ mỗi ~15–30 giây. `sessions.last_seen_at` chỉ cập nhật khi refresh token, **không** cập nhật mỗi request.
4. **Mọi khóa ngoại đều có index** (Postgres không tự tạo), kèm index một phần (partial) cho các truy vấn nóng như phiên còn hiệu lực, đơn thanh toán `pending`.
5. **Phân trang bằng keyset** (không `OFFSET` sâu): index sẵn cho `(is_published, published_at DESC, id DESC)` để danh sách phim mới/hot trả nhanh ở mọi độ sâu.
6. **Tìm kiếm không dấu bằng GIN trigram** trên cột sinh sẵn, thay vì `ILIKE` quét bảng.
7. **Pool kết nối chỉnh được bằng env** (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`): tổng kết nối = số worker × pool; với Neon qua pooler (PgBouncer) tăng worker không làm cạn kết nối server.
8. **Điểm mở rộng đọc/ghi tách rời**: mọi truy cập DB đi qua dependency `get_db`; sau này thêm `DATABASE_URL_READ` (Neon read replica) chỉ cần thêm một dependency `get_db_ro`, không sửa chỗ khác. Chưa làm ngay (không cần ở 1000 người).
9. **Migration không khóa bảng lâu**: `lock_timeout` ngắn trong `env.py`; quy ước expand → migrate → contract khi đổi cột; bảng lớn sau này tạo index bằng `CREATE INDEX CONCURRENTLY`. Bảng sinh log lớn (nếu có, ví dụ lượt xem) thiết kế sẵn cột thời gian để chia partition theo tháng về sau.

## Quyết định kỹ thuật

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Driver | `psycopg` 3 **async** (`postgresql+psycopg://`), SQLAlchemy 2 `AsyncSession` | Một driver cho cả app (async) lẫn Alembic (sync), ít phụ thuộc hơn asyncpg. Chạy tốt với PgBouncer khi `prepare_threshold=None` (asyncpg cần mẹo `statement_cache_size=0`) |
| Hai URL | `DATABASE_URL` (app, pooled) và `DATABASE_URL_DIRECT` (migration; trống thì dùng `DATABASE_URL`) | Migration không đi qua pooler |
| URL từ Neon | Tự đổi `postgresql://` thành `postgresql+psycopg://` | Neon cấp URL dạng `postgresql://…?sslmode=require`, dán vào chạy luôn |
| Engine | Tạo lười, `pool_pre_ping=True`, `expire_on_commit=False`, đóng pool khi shutdown | Import không kết nối DB; chịu được Neon tự ngủ/ngắt kết nối nhàn rỗi |
| Timeout | Đặt `statement_timeout` ở mức role DB (Neon pooler không nhận tham số `options` lúc kết nối); `lock_timeout` đặt trong `env.py` cho migration | Tránh truy vấn treo làm cạn pool |
| Khóa chính | `bigint` identity; `uuid` cho `sessions` | `sessions.id` không được đoán được; series/phim ra ngoài bằng `slug` |
| Enum | `text` + `CHECK` | Đổi giá trị bằng migration dễ hơn ENUM của Postgres |
| Thời gian | `timestamptz`, mặc định `now()` ở DB; các bảng chính có `created_at`, `updated_at` | UTC thống nhất |
| Tiền | `integer` VND | Đúng quy tắc `plan.md` mục 6 |
| Email | Unique index trên `lower(email)` | Tránh trùng hoa/thường, không cần `citext` |
| Xóa | `CASCADE` cho dữ liệu riêng của user; `RESTRICT` cho payments/subscriptions → users và episodes → series | Không mất lịch sử thanh toán; ẩn phim bằng `is_published` |
| Naming convention | Đặt trong `MetaData` | Tên constraint ổn định, Alembic autogenerate/downgrade không lỗi |
| Test | `pytest-asyncio`, `httpx.AsyncClient`; test DB đọc `TEST_DATABASE_URL`, **tự bỏ qua có thông báo khi chưa đặt**; CI luôn đặt (service Postgres) | Máy dev không có DB vẫn chạy được test thường; CI không bao giờ "xanh giả" |

## Thiết kế bảng (đã rà soát lại)

Đổi so với `plan.md` mục 4 được **in đậm**.

**Nhóm tài khoản** (migration `0002`)
- **users**: id, email, password_hash, display_name, **avatar_url**, role (`user`|`admin`), is_active, **email_verified_at**, **last_login_at**, created_at, updated_at. Unique `lower(email)`.
- **sessions**: id (uuid), user_id → users (cascade), refresh_token_hash (unique), **device_info, ip, expires_at**, created_at, last_seen_at, revoked_at. Index `user_id` **đầy đủ** (ban đầu định dùng index một phần `WHERE revoked_at IS NULL`, nhưng như vậy cascade khi xóa user không có index; mỗi user chỉ vài phiên nên index đầy đủ vẫn đếm phiên hoạt động nhanh); index `expires_at` cho job dọn dẹp.
- **email_tokens**: id, user_id (cascade, có index), purpose (`verify_email`|`reset_password`), token_hash (unique), expires_at (có index cho job dọn dẹp), used_at, created_at.

**Nhóm catalog** (migration `0003`)
- **series**: id, slug (unique), title, description, poster_url, banner_url, year, country, status (`ongoing`|`completed`), **total_episodes**, is_published, **published_at**, created_at, updated_at. Index một phần `(published_at DESC, id DESC) WHERE is_published`.
- **series_stats** (**mới**): series_id (PK, → series cascade), view_count, favorite_count, updated_at. Cập nhật theo lô, phục vụ danh sách "hot" mà không ghi nóng vào bảng `series`.
- **genres**: id, slug (unique), name. **series_genres**: PK `(series_id, genre_id)` + **index `genre_id`** để lọc theo thể loại.
- **episodes**: id, series_id → series (restrict), number, title, duration_sec, **thumbnail_url**, stream_video_id (unique khi không null), **stream_status** (`none`|`uploading`|`processing`|`ready`|`error`; phục vụ webhook chuyển mã), is_free, is_published, published_at, created_at, updated_at. Unique `(series_id, number)` (cũng là index cho khóa ngoại).

**Tìm kiếm** (migration `0004`)
- Extension `unaccent`, `pg_trgm`; hàm `immutable_unaccent` bao bên ngoài `unaccent` (bản gốc không "immutable" nên không dùng được trong index); cột sinh sẵn `series.search_text = lower(immutable_unaccent(title))`; GIN trigram index trên cột đó.

**Nhóm VIP & thanh toán** (migration `0005`)
- **vip_plans**: id, name, price_vnd (>0), duration_days (>0), is_active.
- **payments**: id, user_id (restrict, index), plan_id (restrict, index), provider, provider_order_id (unique), amount_vnd, status (`pending`|`paid`|`failed`|`expired`|`refunded`), raw_payload (jsonb), **expires_at** (đơn pending tự đóng), created_at, **updated_at**, paid_at. Index một phần `(created_at) WHERE status = 'pending'` cho job đối soát/đóng đơn.
- **subscriptions**: id, user_id (restrict), plan_id (restrict, index), **payment_id → payments (unique)**, starts_at, expires_at, status (`active`|`expired`|`cancelled`). Unique `payment_id` đảm bảo **một lần thanh toán chỉ cộng VIP một lần** ngay ở tầng DB. Index `(user_id, expires_at DESC)`.
- **payment_events**: id, provider, event_id, payload (jsonb), received_at. Unique `(provider, event_id)`.

**Nhóm hoạt động người dùng** (migration `0006`)
- **watch_history**: PK `(user_id, episode_id)` (cascade), progress_sec, updated_at; `fillfactor = 70`; index `(user_id, updated_at DESC)` cho "xem tiếp"; index `episode_id` cho cascade.
- **favorites**: PK `(user_id, series_id)` (cascade), **created_at**; index `series_id`.

**Để dành, chưa làm ngay** (thêm sau bằng migration mới, không ảnh hưởng thiết kế trên): `audit_logs` cho thao tác admin/hoàn tiền (làm cùng phần admin), bảng ghi lượt xem để nuôi `series_stats` (làm cùng endpoint `play`), phát hiện dùng lại refresh token (rotation).

## Các bước (mỗi bước xong chạy được, test được, dừng cho bạn xem)

- [x] **Bước 1: Hạ tầng kết nối async** (xong; thêm `connect_timeout` và `core/loop.py` cho Windows)
  - Việc: thêm dependency (`sqlalchemy[asyncio]`, `alembic`, `psycopg[binary]`; dev: `pytest-asyncio`); mở rộng `core/config.py`; `core/db.py` (engine lười, `get_db`, `Base` + naming convention, đóng pool khi shutdown); `GET /api/health/db`.
  - Hoàn thành khi: `pytest` pass **không cần** Postgres (`/api/health` không đụng DB; `/api/health/db` trả 503 khi chưa cấu hình DB); với Postgres local chạy, test `/api/health/db` trả `ok`, và trả 503 khi DB không với tới được; ruff sạch.
- [x] **Bước 2: Alembic + hạ tầng test DB** (xong; test dùng database tạm riêng cho mỗi test)
  - Việc: `alembic init`; `env.py` dùng `database_url_direct`, `Base.metadata`, `lock_timeout`; migration `0001` (extension); `conftest.py` (DB test riêng, dọn sạch giữa các test); CI thêm service Postgres và đặt `TEST_DATABASE_URL`.
  - Hoàn thành khi: `alembic upgrade head` / `downgrade base` chạy sạch trên Postgres compose; test up/down migration pass local và CI.
- [x] **Bước 3: Nhóm tài khoản** (xong; thêm test chung bảo đảm mọi khóa ngoại đều có index, áp dụng tự động cho các nhóm bảng sau) — models + migration `0002` + test ràng buộc (email trùng khác hoa/thường bị chặn; xóa user cascade sessions/email_tokens; CHECK role sai bị từ chối). `alembic check` không báo lệch.
- [ ] **Bước 4: Nhóm catalog + tìm kiếm** — models + migrations `0003`, `0004` + test (trùng `(series_id, number)`, `slug`, `stream_video_id` bị chặn; tìm "nang tho" ra "Nàng Thơ" bằng truy vấn trigram; kiểm tra bằng `EXPLAIN` rằng truy vấn danh sách dùng đúng index).
- [ ] **Bước 5: Nhóm VIP & thanh toán** — models + migration `0005` + test (trùng `provider_order_id`, `(provider, event_id)`, `payment_id` trong subscriptions bị chặn; CHECK trạng thái; xóa user còn payments bị `RESTRICT`).
- [ ] **Bước 6: Nhóm hoạt động** — models + migration `0006` + test (upsert `watch_history` ghi đè đúng một dòng; cascade).
- [ ] **Bước 7: Tài liệu và dev compose** — cập nhật `.env.example`, compose dev (scheme `postgresql+psycopg://`), README, CLAUDE.md (lệnh migrate/test DB), `plan.md` mục 4; `alembic check` sạch; chạy lại `docker compose up`; CI xanh.

## Rủi ro

- **Autogenerate sinh migration thiếu/sai** (CHECK, index hàm, cột sinh sẵn, `fillfactor`): luôn đọc và chỉnh tay, có `alembic check` + test up/down.
- **Thiết kế bảng khó đổi khi có dữ liệu thật**: hiện chưa có dữ liệu nên đây là lúc rẻ nhất; vì vậy cần bạn đọc kỹ mục "Thiết kế bảng" trước Bước 3.
- **Async + test**: dễ dính lỗi vòng lặp sự kiện; dùng một cấu hình `pytest-asyncio` thống nhất ngay từ Bước 1.
- **Pooler Neon khác Postgres local**: chỉ kiểm chứng thật được khi có tài khoản Neon; không chặn bước này, đưa vào checklist Giai đoạn 6.
