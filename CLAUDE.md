# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Monorepo VDrama (kế hoạch đầy đủ ở `plan.md`): `apps/api` (FastAPI, Python 3.12, uv) và `apps/web` (Next.js, TypeScript, Tailwind, pnpm). Đã xong Giai đoạn 1 (khung dự án), phần DB của Giai đoạn 2 (toàn bộ bảng, trạng thái có kiểm soát, xóa mềm, nhật ký thao tác; migration 0001–0009, thêm 0011 cho xóa mềm lịch sử xem/yêu thích) và auth (`docs/plans/gd2-b2-auth.md`, migration 0010: đăng ký, đăng nhập, refresh xoay vòng, đăng xuất, `/me`, phân quyền admin, VIP, CSRF, rate limit). Catalog và tìm kiếm cũng đã xong (`docs/plans/gd2-b3-catalog.md`: `/genres`, `/series`, `/series/{slug}`, `/series/{slug}/episodes`, `/search`, lệnh `seed-demo`). Cloudflare Stream và xem tập đã xong (`docs/plans/gd2-b4-stream-play.md`: `play`, upload tus cho admin, webhook, đồng bộ tay, lệnh `stream-*`; chưa thử với tài khoản Cloudflare thật). Lịch sử xem, yêu thích và test phân quyền tổng thể đã xong (`docs/plans/gd2-b5-activity.md`: `/me/history`, `/me/favorites`, migration 0011, `test_permissions.py`). Còn lại của Giai đoạn 2: xác thực email / quên mật khẩu; chưa có endpoint thanh toán. Thanh toán dùng SePay + VietQR trước (xem `plan.md` Giai đoạn 5). Chi tiết stack và các quyết định kiến trúc nằm trong `plan.md`, không lặp lại ở đây.

## Quy trình làm việc (bắt buộc)

Mọi thay đổi không tầm thường đi theo vòng lặp: **Khám phá → Plan → Thực thi từng bước → Kiểm tra → Commit**.

1. **Khám phá**: đọc code liên quan, chưa sửa gì (dùng Plan Mode). Yêu cầu mơ hồ thì hỏi làm rõ trước.
2. **Plan**: ghi kế hoạch vào `plan.md` ở thư mục gốc (xem mẫu ở `docs/plan-template.md`). Chờ người dùng review/chỉnh xong mới code.
3. **Thực thi**: làm đúng **một bước** trong `plan.md`, rồi dừng cho người dùng xem. Không làm cả plan một lượt.
4. **Kiểm tra**: chạy test, lint, type-check của dự án; sửa đến khi pass. Báo trung thực nếu có thứ không chạy được.
5. **Commit**: mỗi bước chạy ổn là một commit nhỏ, message rõ ràng. Chỉ commit khi người dùng yêu cầu.

### Quy tắc với plan.md

- `plan.md` là bộ nhớ liên phiên: phiên mới bắt đầu bằng việc đọc `CLAUDE.md` và `plan.md`, tiếp tục từ bước chưa đánh dấu `[x]`.
- Mỗi bước phải nhỏ, làm xong chạy được và test được, có tiêu chí hoàn thành riêng.
- Xong bước nào thì đánh `[x]` ngay trong `plan.md`. Nếu phải đổi hướng, sửa plan trước rồi mới code.
- Việc lớn thì chia thành nhiều plan nhỏ; plan đã xong có thể chuyển vào `docs/plans/` để lưu.

### Slash command có sẵn (`.claude/commands/`)

- `/plan <mô tả>`: khám phá và viết `plan.md`, không sửa code.
- `/step [số bước]`: làm một bước trong plan, kiểm tra, đánh dấu, dừng.
- `/review`: review thay đổi hiện tại như reviewer khó tính.
- `/resume`: nạp lại ngữ cảnh từ CLAUDE.md và plan.md ở phiên mới.

## Lệnh thường dùng

API (chạy trong `apps/api`):

- Cài/chạy: `uv sync`, `uv run uvicorn app.main:app --reload`
- Kiểm tra: `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest -q`
- Test cần Postgres: bật DB (`docker compose -f docker-compose.dev.yml up -d db`) rồi đặt `TEST_DATABASE_URL=postgresql://vdrama:vdrama@localhost:5432/vdrama`; thiếu biến này các test đó tự bỏ qua (CI luôn đặt)
- Windows: psycopg async cần SelectorEventLoop, chạy server bằng `uv run uvicorn app.main:app --reload --loop app.core.loop:selector_loop_factory` (Linux/Docker không cần)
- Migration (cần `DATABASE_URL` trỏ tới DB): `uv run alembic upgrade head`, `uv run alembic downgrade -1`, `uv run alembic revision --autogenerate -m "mô tả" --rev-id 000N`, `uv run alembic check`. Luôn đọc và chỉnh tay migration sinh ra. Migration đặt id `000N`, một nhóm bảng một file.
- Fixture test DB: `empty_db_url` (database tạm trống, tự xóa), `migrated_db_url` (đã `upgrade head`) trong `app/tests/conftest.py`
- Một test: `uv run pytest app/tests/test_health.py::test_health_ok`

Web (chạy trong `apps/web`):

- Chạy: `pnpm dev` (đặt `API_PROXY_TARGET=http://localhost:8000` để proxy `/api/*` sang FastAPI)
- Kiểm tra: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`

Cả bộ local: `docker compose -f docker-compose.dev.yml up --build` (service `migrate` tự chạy `alembic upgrade head` trước khi api khởi động). CI (`.github/workflows/ci.yml`) chạy đúng các lệnh kiểm tra trên.

## Kiến trúc

- Web và API dùng **một domain**: mọi route API nằm dưới `/api` (kể cả `/api/health`), Caddy chuyển `/api/*` sang FastAPI, phần còn lại sang Next.js. Local không có Caddy nên Next.js `rewrites` thay vai trò đó. Không dùng CORS.
- Code API theo lớp trong `apps/api/app/`: `routers/` → `services/` → `models/`, cấu hình ở `core/config.py` (pydantic-settings, đọc `.env`). DB là SQLAlchemy 2 **async** + psycopg 3 (`core/db.py`: engine tạo lười, dependency `DbSession`); `DATABASE_URL` là URL qua pooler cho app, `DATABASE_URL_DIRECT` cho migration. Kế hoạch DB/scale: `docs/plans/gd2-b1-database.md`. Model nằm ở `app/models/` theo nhóm (user, user_session, email_token, catalog, vip, activity); thêm model mới phải import trong `app/models/__init__.py` để Alembic thấy. Mọi khóa ngoại phải có index (có test chung bắt lỗi này); không index cột ghi liên tục của `watch_history` (có test đo HOT update). Ràng buộc nghiệp vụ quan trọng nằm ở tầng DB (CHECK/unique/FK), có test trong `app/tests/test_*_schema.py`. Tìm series theo tên luôn dùng `series_search_condition()` (`app/services/search.py`) để khớp index trigram; tìm user theo email so `lower(email)`.
- **Quy ước dữ liệu** (đều có test, vi phạm thì test hoặc DB báo lỗi):
  - Trạng thái, vai trò, mã lỗi dùng `StrEnum` trong `app/models/enums.py` (`PaymentStatus.PAID`...), không gõ chuỗi tay. CHECK sinh từ enum bằng `sql_in()`. Thêm giá trị mới thì sửa cả enum lẫn migration (test `test_db_check_matches_enum` bắt lệch). Chuyển trạng thái payments/subscriptions chỉ theo `PAYMENT_TRANSITIONS`/`SUBSCRIPTION_TRANSITIONS` (trigger trong DB chặn phần còn lại).
  - Xóa mềm (`users`, `series`, `episodes`, `genres`, `vip_plans`): mọi truy vấn ORM tự ẩn dòng đã xóa (`app/models/soft_delete.py`); cần thấy cả dòng đã xóa (admin, thùng rác, kiểm tra trùng) thì `execution_options(include_deleted=True)` hoặc `get_including_deleted()`. Truy vấn phục vụ người dùng **không viết SQL tay** (`text()` không được lọc). Xóa/khôi phục chỉ qua `app/services/soft_delete.py`, không tự gán `deleted_at`. Ẩn "theo cha" (tập của series đã xóa) do truy vấn nghiệp vụ tự join điều kiện của series.
  - Dữ liệu **người dùng tự xóa** (`watch_history`, `favorites`) dùng `DeletedAtMixin` (chỉ cột `deleted_at`, cùng bộ lọc tự ẩn, không `deleted_by_id`, không ghi `audit_logs`): người dùng thấy là đã xóa, hệ thống vẫn giữ, DB chặn xóa thật. Service của bảng tự đặt `deleted_at`; xem lại / yêu thích lại thì dùng lại dòng cũ và đặt `deleted_at = NULL`. Không index `deleted_at` của `watch_history` (giữ HOT update).
  - DB chặn `DELETE`/`TRUNCATE` thật trên các bảng quan trọng; test cascade/restrict dùng helper `hard_delete()` trong `app/tests/conftest.py` (bật cờ bảo trì trong đúng transaction).
  - Mọi thao tác admin, thay đổi trạng thái tiền và quyền tài khoản phải ghi `audit_logs` qua `app/services/audit.py` trong **cùng transaction**: gọi `require_reason()` trước khi đổi dữ liệu, chụp `await load_snapshot()` trước/sau, rồi `record(...)`. Tên hành động dạng `<bảng>.<động từ>` (ví dụ `series.delete`). Người thực hiện truyền bằng `Actor.admin(id)` / `Actor.system()` / `Actor.webhook()`. Mật khẩu/token đã được che sẵn.
  - Đơn `paid` phải có `paid_event_id` (giao dịch ngân hàng thật từ SePay); không viết code đánh dấu đã thanh toán theo cách khác.
  - Service async đọc cột do DB tính (`now()`, cột sinh sẵn) phải nạp lại tường minh (`refresh`/`load_snapshot`), vì nạp ngầm trong async báo lỗi `MissingGreenlet`.
- Mỗi request có `X-Request-ID` (`app/core/request_context.py`); `current_request()` trả request_id, IP, user agent cho nhật ký và log. IP luôn lấy qua `app/core/client_ip.py` (chỉ tin `CF-Connecting-IP` khi `TRUST_CLOUDFLARE_IP=true`).
- **API và auth** (tài liệu cho frontend: `docs/api.md`):
  - API nghiệp vụ dưới `/api/v1`. Lỗi luôn ném `ApiError(status, ErrorCode.X, "câu tiếng Việt")` (`app/core/errors.py`), không tự dựng JSON lỗi; mã lỗi mới thêm vào `ErrorCode`.
  - Endpoint cần đăng nhập dùng `CurrentUser` / `OptionalUser` / `AdminUser` (`app/api/deps.py`); không tự đọc cookie hay JWT. Mỗi request kiểm tra phiên + user trong DB; role đọc từ DB, không từ token.
  - Token chỉ nằm trong cookie httpOnly (`app/api/cookies.py`). Mật khẩu, JWT, refresh token chỉ qua `app/core/security.py` (argon2id chạy trong thread, các hàm là async).
  - Phiên chỉ tạo qua `services/auth.create_session` (Giai đoạn 5 thêm giới hạn thiết bị ở đó). VIP chỉ đổi qua `services/vip.py` (`grant_vip`, `cancel_subscription`), không ghi tay `users.vip_expires_at`; kiểm tra VIP bằng `is_vip(user)`.
  - Request thay đổi dữ liệu phải có `Origin` đúng `PUBLIC_ORIGIN` (`app/api/csrf.py`). Endpoint dễ bị dò thêm `rate_limit.hit(...)` (`app/core/rate_limit.py`, đếm trong RAM).
  - Service không commit; router commit sau khi mọi thứ thành công.
  - Test gọi API dùng fixture `api` (client https, có `Origin`, trên DB tạm đã migrate); bộ đếm rate limit tự reset mỗi test.
- **Catalog** (`app/services/catalog.py`):
  - Truy vấn công khai chỉ lấy phim/tập đã xuất bản và tự ẩn "theo cha" (tập của phim nháp/đã xóa không lộ ra). Admin chỉ xem trước được ở trang chi tiết và danh sách tập; danh sách và tìm kiếm không bao giờ có phim nháp.
  - Lọc cờ boolean bằng `.where(Series.is_published)`, **không** dùng `.is_(True)`: index một phần khai báo `WHERE is_published`, Postgres không suy ra được từ `IS true` nên bỏ qua index. Truy vấn danh sách quan trọng có test `EXPLAIN` trên câu truy vấn thật của service.
  - Phân trang danh sách bằng con trỏ keyset (giá trị sắp xếp + `id`), không dùng `OFFSET`.
  - Response công khai không bao giờ có `stream_video_id`; đường phát chỉ cấp qua endpoint `play`.
  - Dữ liệu mẫu cho dev: `DEMO_PASSWORD=... uv run python -m app.cli seed-demo` (tiếng Anh, có 3 tài khoản demo viewer/vip/admin `@example.com`; không chạy ở prod, chạy lại không trùng).
- **Video / Cloudflare Stream** (`app/services/stream.py`, `play.py`, `episode_video.py`):
  - Quyền xem chỉ kiểm tra ở `services/play.py` (`GET /episodes/{id}/play`); nơi khác không tự cấp URL phát. Token ký cục bộ (RS256), **không gọi API Cloudflare khi người xem bấm xem**.
  - Mọi gọi API Cloudflare đi qua `services/stream.py` (`_call`, timeout ngắn); test thay `stream.transport` bằng `httpx.MockTransport`, không bao giờ gọi Cloudflare thật. Lỗi mạng/HTTP thành `StreamProviderError` (502), thiếu cấu hình thành `StreamNotConfiguredError` (503).
  - Trạng thái video của tập chỉ đổi qua `episode_video.apply_video_state()` (webhook và đồng bộ tay dùng chung, idempotent, có audit). Video không bật `requireSignedURLs` không bao giờ thành `ready`.
  - Test cần cấu hình Stream dùng fixture `stream_on` (khóa thật sinh trong test, ở `app/tests/stream_keys.py`).
- **Lịch sử xem, yêu thích** (`app/services/activity.py`, router `app/routers/me.py`):
  - Quyền báo tiến độ xem dùng chung `play.find_watchable_episode()` với `play`; không tự viết lại kiểm tra quyền xem ở nơi khác.
  - Số đếm tóm tắt (`series_stats.favorite_count`) chỉ đổi khi trạng thái thật sự đổi: dùng `… RETURNING` để biết, không đọc rồi ghi.
- **Phân quyền có lưới test** (`app/tests/test_permissions.py`): tự quét mọi route qua `app.openapi()`. Endpoint ghi dữ liệu mới mà không cần đăng nhập phải thêm vào `PUBLIC_WRITES` kèm lý do; endpoint admin phải dùng `AdminUser`. Mã lỗi mới phải thêm vào bảng mã lỗi của `docs/api.md` (có test so khớp). Đổi quyền thì sửa bảng `MATRIX` cùng bảng Phân quyền trong `docs/api.md`.
- Next.js ở phiên bản mới có breaking changes: đọc docs trong `apps/web/node_modules/next/dist/docs/` trước khi viết code web (theo `apps/web/AGENTS.md`).
- **Web đa ngôn ngữ** (`docs/plans/gd4-i18n.md`, `docs/design.md` mục Đa ngôn ngữ): route người xem nằm dưới `app/[lang]` (tiếng Anh ở gốc nhờ `src/proxy.ts`, tiếng Việt ở `/vi`); admin và `/dev` ở `app/(internal)`, chỉ tiếng Anh. Chữ giao diện luôn đi qua từ điển `src/lib/i18n/dictionaries/` (`useT()` ở client, `getServerT(lang)` ở server), không viết chữ thẳng trong JSX và không tạo `lib/copy.ts` mới. Liên kết/điều hướng dùng `Link`, `useRouter`, `usePathname` của `@/components/i18n/navigation`, không dùng `next/link` hay `next/navigation` thô (có test chặn). Thêm khóa mới thì thêm cả `en.ts` lẫn `vi.ts`.

## Điều không được làm

- Không code khi `plan.md` chưa được người dùng duyệt (trừ sửa nhỏ, hiển nhiên).
- Không làm nhiều bước plan trong một lượt.
- Không commit, push hay tạo PR khi chưa được yêu cầu.
- Làm việc lớn trên branch riêng, không trực tiếp trên `main`.
