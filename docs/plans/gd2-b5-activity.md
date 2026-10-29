# Plan: Giai đoạn 2 / Lịch sử xem, yêu thích, test phân quyền tổng thể

> Trạng thái: **đã duyệt (2026-10-29), đang làm**: xong Bước 1–4. Câu hỏi 1–4 chốt theo đề xuất. Câu hỏi 5 chốt 2026-10-29 (bản sửa đã duyệt): **người dùng thấy là đã xóa, hệ thống xóa mềm** (giữ dữ liệu cho phân tích sau này) cho cả lịch sử xem lẫn yêu thích. Làm trên branch `feat/activity`, tách từ `feat/stream` (stream và catalog chưa merge vào `main`).
> Liên quan: `plan.md` Giai đoạn 2, task "Watch history, favorites" và "Test tự động cho auth, play, phân quyền"; mục 5 (User: `/me/favorites`, `/me/history`). Bảng dùng: `watch_history`, `favorites`, `series_stats` (migration `0003`, `0006`). Frontend cần cho: trang xem phim (nhớ tiến độ), trang chi tiết (tiếp tục tập N, nút yêu thích), trang tài khoản (lịch sử, yêu thích) ở Giai đoạn 3.

## Mục tiêu và phạm vi

- **Mục tiêu**:
  1. Player báo tiến độ định kỳ; trang chủ/tài khoản có "Xem tiếp"; trang phim biết người xem đang ở tập nào, tới giây nào.
  2. Yêu thích phim: thêm, bỏ, danh sách, biết một phim đã yêu thích chưa; đếm `favorite_count`.
  3. Người dùng xóa được lịch sử xem của mình (dữ liệu cá nhân).
  4. Test phân quyền tổng thể: tự phát hiện endpoint mới quên bảo vệ, ma trận quyền khách/user/VIP/admin chạy như tài liệu, và một luồng đầu-cuối ở mức API.
- **Không làm**:
  - Đánh dấu "đã xem xong", tự chuyển tập kế tiếp: frontend tự tính từ `progress_sec` / `duration_sec` (Giai đoạn 3).
  - Đề xuất phim theo lịch sử.
  - Test đầu-cuối trên trình duyệt thật: Giai đoạn 8.

## Nối với phần đã có

- `watch_history`: PK `(user_id, episode_id)`, `fillfactor 70`, không index cột ghi liên tục (có test đo HOT update); hàm `upsert_progress_stmt()` có sẵn ở `app/services/activity.py`. `favorites`: PK `(user_id, series_id)`, `created_at`, index `series_id`.
- **Migration `0011`** (thêm ở Bước 2, theo quyết định xóa mềm): cột `deleted_at` cho cả hai bảng, và đưa hai bảng vào nhóm DB chặn `DELETE`/`TRUNCATE` thật (trigger `block_hard_delete` sẵn có). Không index `deleted_at` để giữ HOT update.
- **Quyền**: dùng lại đúng logic của `play` (một chỗ quyết quyền xem). Tách phần kiểm tra trong `services/play.py` thành hàm `find_watchable_episode()` để `play` và báo tiến độ dùng chung, không viết lại.
- Mọi endpoint ở đây dùng `CurrentUser`; thay đổi dữ liệu đi qua CSRF Origin như các API khác.

## Thiết kế

### Xóa mềm cho dữ liệu của người dùng

- **Người dùng thấy là đã xóa**: dòng có `deleted_at` biến mất khỏi mọi API (xem tiếp, tiến độ theo phim, danh sách yêu thích, `favorited`). **Hệ thống vẫn giữ** dòng trong DB; DB chặn xóa thật.
- **Cơ chế**: tách phần "cột `deleted_at` + tự ẩn khỏi mọi truy vấn ORM" của `SoftDeleteMixin` thành lớp nền `DeletedAtMixin` (`app/models/mixins.py`). Bộ lọc ở `app/models/soft_delete.py` áp cho lớp nền này, nên `WatchHistory`, `Favorite` tự được ẩn như `series`, `episodes`. `SoftDeleteMixin` (bảng admin quản lý) giữ nguyên: thêm `deleted_by_id`, bắt lý do, ghi nhật ký qua `services/soft_delete.py`.
- Người dùng tự xóa dữ liệu của mình **không ghi `audit_logs`** (không phải thao tác admin/tiền/quyền; ghi mỗi lần bấm xóa chỉ làm đầy nhật ký). Thời điểm xóa đã nằm ở `deleted_at`.
- **Xem lại / yêu thích lại sau khi xóa**: dùng lại đúng dòng cũ (khóa chính không đổi), đặt `deleted_at = NULL`. Lịch sử xem: tiến độ ghi đè như bình thường. Yêu thích: `created_at` đặt lại thành lúc yêu thích lại (để "mới yêu thích trước" đúng với người dùng).
- **Giới hạn cần biết**: xóa mềm chỉ giữ **trạng thái cuối** của mỗi dòng. Tiến độ xem vốn bị ghi đè mỗi 15–30 giây, xem lại sau khi xóa cũng ghi đè dòng đã xóa. Nếu sau này cần phân tích hành vi chi tiết (xem lúc nào, bao lâu, bỏ ở đâu, bỏ yêu thích khi nào) thì cần bảng sự kiện chỉ-thêm riêng; ghi vào backlog, không làm trong plan này.

### Lịch sử xem

| Method | Đường dẫn | Mô tả |
|---|---|---|
| PUT | `/me/history/{episode_id}` | Body `{ "progress_sec": 754 }`. Player gọi mỗi ~15–30 giây và khi tạm dừng/đóng trang. Trả 204 |
| GET | `/me/history` | "Xem tiếp": mỗi phim **một dòng** là tập xem gần nhất, mới nhất trước. `limit` 1–50 (mặc định 20), không phân trang |
| GET | `/me/history/series/{slug}` | Tiến độ mọi tập đã xem của một phim (cho thanh tiến độ trong danh sách tập và nút "Xem tiếp tập N") |
| DELETE | `/me/history/{episode_id}` | Xóa (mềm) một tập khỏi lịch sử. 204, gọi lại vẫn 204 |
| DELETE | `/me/history` | Xóa (mềm) toàn bộ lịch sử xem. 204 |

- **Báo tiến độ** kiểm tra quyền như `play`: tập ẩn/không có → 404, tập VIP mà hết VIP → 403 `vip_required` (đề xuất, Câu hỏi 1). `progress_sec` 0–86400; lớn hơn thời lượng tập thì cắt bằng thời lượng. Upsert một dòng (HOT update). Rate limit 30 lần/phút mỗi user (player 4 lần/phút, chừa nhiều tab).
- Không đếm lượt xem ở đây (đã đếm ở `play`).
- **Xem tiếp** trả: `series` (SeriesCard), `episode` (`id`, `number`, `title`, `duration_sec`, `thumbnail_url`, `access`), `progress_sec`, `updated_at`. Ẩn tập/phim đã xóa hoặc gỡ xuất bản (dòng vẫn nằm trong DB, phim xuất bản lại thì hiện lại). Lấy theo khóa chính `(user_id, …)`, mỗi user vài trăm dòng nên không cần index thêm (giữ HOT update); có test `EXPLAIN`.

### Yêu thích

| Method | Đường dẫn | Mô tả |
|---|---|---|
| PUT | `/me/favorites/{series_id}` | Thêm. 204, gọi lại vẫn 204 (không cộng hai lần) |
| DELETE | `/me/favorites/{series_id}` | Bỏ. 204, gọi lại vẫn 204 |
| GET | `/me/favorites` | Danh sách SeriesCard, mới yêu thích trước; con trỏ keyset `(created_at, series_id)`, `limit` 1–50 |
| GET | `/me/favorites/{series_id}` | `{ "favorited": true }`: trang chi tiết dùng để tô nút |

- Đường dẫn dùng **id** phim (thẻ phim đã có `id`), không dùng slug: slug có thể đổi khi admin sửa tên.
- Thêm vào phim không có / chưa xuất bản / đã xóa → 404. Phim bị gỡ sau khi đã yêu thích: ẩn khỏi danh sách, dòng vẫn giữ.
- Bỏ yêu thích là xóa mềm (`deleted_at`), thêm lại là khôi phục đúng dòng cũ.
- `series_stats.favorite_count` cộng/trừ trong cùng transaction, **chỉ khi trạng thái thật sự đổi** (thêm mới hoặc khôi phục dòng đã xóa → +1; xóa mềm dòng đang hiện → -1; dùng `… RETURNING` để biết có đổi không), nên bấm nhiều lần hay hai tab cùng lúc vẫn đúng. Trang chi tiết phim thêm trường `favorite_count`.
- Catalog vẫn không có `is_favorite` (giữ nội dung giống nhau cho mọi người để cache được).
- Rate limit thêm/bỏ: 60 lần/phút mỗi user.

### Test phân quyền tổng thể (task "Test tự động cho auth, play, phân quyền")

Auth, play, catalog đã có test riêng từng phần. Phần còn thiếu là lưới an toàn cho **endpoint thêm sau này**:

1. **Kiểm kê route**: duyệt mọi route của app (`app.routes`):
   - Mọi route dưới `/api/v1/admin` gọi bằng khách → 401, bằng user thường → 403 (tự điền tham số đường dẫn giả). Thêm endpoint admin mà quên `AdminUser` thì test đỏ.
   - Mọi route thay đổi dữ liệu (POST/PUT/PATCH/DELETE) phải cần đăng nhập, trừ danh sách cho phép ghi rõ trong test (`register`, `login`, `refresh`, `logout`, `webhooks/*`). Thêm endpoint ghi dữ liệu mà quên đăng nhập thì test đỏ.
   - Mọi route dưới `/api/v1/me` khách gọi → 401.
2. **Ma trận quyền** chạy đúng bảng "Phân quyền" trong `docs/api.md`: khách / user / VIP còn hạn / VIP hết hạn / admin × (xem catalog, xem tập free, xem tập VIP, tập chưa xuất bản, API admin, lịch sử, yêu thích). Một test tham số hóa đọc như bảng.
3. **Tài liệu khớp code**: mọi mã trong `ErrorCode` đều có trong bảng mã lỗi của `docs/api.md` và ngược lại.
4. **Luồng đầu-cuối mức API**: đăng ký → xem tập free → tập VIP bị 403 → được tặng VIP (`services/vip.grant_vip`) → xem tập VIP, báo tiến độ, yêu thích → VIP hết hạn → tập VIP 403 nhưng lịch sử và yêu thích vẫn còn → đăng xuất → mọi thứ 401.

## File bị ảnh hưởng

- `app/models/mixins.py`, `app/models/soft_delete.py`, `app/models/activity.py` (`DeletedAtMixin`), migration `alembic/versions/0011_*.py`
- `app/services/play.py` (tách `find_watchable_episode()`), `app/services/activity.py` (tiến độ, xem tiếp, yêu thích)
- `app/routers/me.py` (hoặc router mới `me_activity.py` nếu `me.py` dài), `app/schemas/activity.py`
- `app/schemas/catalog.py`, `app/services/catalog.py`, `app/routers/catalog.py` (`favorite_count` ở chi tiết phim)
- `app/core/rate_limit.py` (ngưỡng mới)
- Test mới: `test_history_api.py`, `test_favorites_api.py`, `test_permissions.py`
- `docs/api.md` (Lịch sử, Yêu thích, bảng Phân quyền), `plan.md`, `CLAUDE.md`

## Các bước

- [x] **Bước 1: Báo tiến độ xem** (xong 2026-10-29: khách nhận 401 trước khi xét tập vì `/me/*` luôn cần đăng nhập; admin báo được tiến độ khi xem trước tập chưa xuất bản; thời lượng chưa biết thì không cắt; HOT update kiểm tra qua đúng hàm service API dùng)
  - Việc: tạo branch `feat/activity`; tách `find_watchable_episode()` khỏi `play` (test `play` cũ phải xanh nguyên); `PUT /me/history/{episode_id}`; rate limit.
  - Hoàn thành khi: test khách 401; tập ẩn/xóa 404; tập VIP khi không có/hết VIP 403; báo nhiều lần chỉ một dòng, giữ giá trị mới nhất; `progress_sec` âm hoặc > 86400 → 422; lớn hơn thời lượng thì bị cắt; báo qua API vẫn là HOT update (`pg_stat_xact_user_tables`); vượt 30 lần/phút → 429; thiếu Origin có cookie → 403.
- [x] **Bước 2: Xóa mềm cho lịch sử xem và yêu thích (migration `0011`)** (xong 2026-10-29: `DeletedAtMixin` ở `app/models/mixins.py`, `SoftDeleteMixin` kế thừa nó nên bộ lọc cũ không đổi hành vi; hai bảng thêm vào danh sách test chặn xóa thật sẵn có; `alembic check` sạch, hạ/nâng `0011` thử trên database tạm)
  - Việc: `DeletedAtMixin` (tách từ `SoftDeleteMixin`, bộ lọc ORM áp cho lớp nền); `WatchHistory`, `Favorite` dùng mixin này; migration `0011`: cột `deleted_at` hai bảng, trigger chặn xóa thật; upsert tiến độ đặt lại `deleted_at = NULL`.
  - Hoàn thành khi: test dòng có `deleted_at` bị ẩn khỏi truy vấn ORM của hai bảng, `include_deleted` vẫn thấy; `DELETE`/`TRUNCATE` thật bị chặn, cờ bảo trì vẫn cho qua (cascade khi bảo trì xóa user/tập vẫn chạy); báo tiến độ lên dòng đã xóa thì dòng hiện lại; vẫn là HOT update (kể cả lúc xóa mềm); không có index trên `deleted_at`; `alembic upgrade`/`downgrade` hai chiều và `alembic check` sạch; mọi test xóa mềm cũ của bảng admin vẫn xanh.
- [x] **Bước 3: Xem tiếp và xóa lịch sử** (xong 2026-10-29: tập xem gần nhất bị gỡ thì "Xem tiếp" lùi về tập còn xem được gần nhất của phim đó; tiến độ theo phim cùng độ hiển thị với danh sách tập ở catalog (admin xem trước được); xóa giữ nguyên `updated_at` (lần xem cuối) cho phân tích; xóa tập chưa từng xem hoặc không tồn tại vẫn 204; `GET /me/history` và `/series/{slug}` trả `{"items": [...]}`)
  - Việc: `GET /me/history`, `GET /me/history/series/{slug}`, hai `DELETE`.
  - Hoàn thành khi: test mỗi phim một dòng là tập mới nhất, sắp theo lần xem gần nhất; tập/phim gỡ xuất bản hoặc xóa mềm bị ẩn, xuất bản lại thì hiện lại; user này không thấy lịch sử user khác; tiến độ theo phim đúng từng tập; xóa một tập / xóa hết chỉ ảnh hưởng chính mình, dòng vẫn còn trong DB với `deleted_at`, gọi lại vẫn 204; truy vấn xem tiếp đi theo khóa chính (`EXPLAIN`).
- [x] **Bước 4: Yêu thích** (xong 2026-10-29: thêm dùng `INSERT … ON CONFLICT DO UPDATE … WHERE deleted_at IS NOT NULL RETURNING` nên chỉ cộng khi thật sự thêm mới/thêm lại, có test 5 request song song; `favorite_count` không xuống dưới 0; bỏ yêu thích phim không tồn tại vẫn 204; thêm và bỏ dùng chung bộ đếm rate limit, đọc không giới hạn; danh sách trả `SeriesPage` như `/series`, con trỏ loại `favorites`)
  - Việc: bốn endpoint `/me/favorites`, `favorite_count` (service + trang chi tiết phim), rate limit.
  - Hoàn thành khi: test thêm hai lần chỉ một dòng và `favorite_count` +1; bỏ hai lần chỉ -1, không âm, dòng vẫn còn với `deleted_at`; thêm lại sau khi bỏ dùng lại dòng cũ, +1, lên đầu danh sách; thêm song song từ hai request vẫn đúng; phim nháp/xóa/không có → 404; phim bị gỡ sau đó ẩn khỏi danh sách; phân trang con trỏ không trùng/sót; `GET /me/favorites/{id}` đúng cả hai trạng thái; trang chi tiết có `favorite_count`.
- [ ] **Bước 5: Test phân quyền tổng thể**
  - Việc: `test_permissions.py` với bốn phần ở mục Thiết kế.
  - Hoàn thành khi: cả bốn phần xanh; thử tạm bỏ `AdminUser` khỏi một endpoint admin hoặc bỏ `CurrentUser` khỏi một endpoint ghi thì test đỏ (kiểm tra tay, không commit thay đổi đó).
- [ ] **Bước 6: Tài liệu, khép plan**
  - Việc: `docs/api.md`, `CLAUDE.md` (quy ước: quyền xem dùng chung `find_watchable_episode()`; endpoint ghi mới phải qua test kiểm kê route; dữ liệu người dùng tự xóa dùng `DeletedAtMixin`), cập nhật bảng migration ở `plan.md` mục 4, đánh dấu `plan.md`; thêm vào `plan.md` mục 2.5 (pháp lý) ghi chú giữ dữ liệu sau khi người dùng xóa; thêm backlog bảng sự kiện cho phân tích.
  - Hoàn thành khi: ruff, format, pytest xanh.

## Rủi ro

- **Pháp lý dữ liệu cá nhân**: người dùng bấm xóa mà hệ thống vẫn giữ là tiếp tục lưu dữ liệu cá nhân. Quy định bảo vệ dữ liệu cá nhân của Việt Nam có quyền yêu cầu xóa dữ liệu; nên (1) nói rõ trong Chính sách bảo mật rằng lịch sử bị ẩn chứ không xóa hẳn, giữ để làm gì và bao lâu, và (2) có cách xóa thật hoặc ẩn danh hóa khi người dùng yêu cầu xóa tài khoản. Cần luật sư xác nhận (đã có trong `plan.md` mục 2.5). Plan này chỉ làm phần kỹ thuật.

- Báo tiến độ là request nhiều nhất của hệ thống (mỗi người đang xem 2–4 lần/phút). Mỗi lần: kiểm tra phiên + kiểm tra quyền + một upsert. Với quy mô hiện tại (< 100 người/ngày) không đáng kể; khi lớn có thể bỏ bớt kiểm tra quyền ở đây (chỉ cần tập tồn tại) hoặc gom ghi.
- Kiểm kê route dựa vào cách FastAPI khai báo dependency; nếu sau này đổi cách gắn quyền (ví dụ dependency ở cấp router) thì test cần chỉnh theo.
- `favorite_count` là số đếm tóm tắt: phim/user bị xóa mềm không trừ lại. Chỉ dùng để hiển thị.

## Câu hỏi còn mở (đều có đề xuất, duyệt plan là chốt theo đề xuất)

1. Báo tiến độ tập VIP khi đã hết VIP: **403** như `play` (đề xuất) hay vẫn ghi?
2. "Xem tiếp": **mỗi phim một dòng** (tập xem gần nhất)?
3. Yêu thích dùng **id phim** trong đường dẫn thay vì slug?
4. Trang chi tiết phim hiện **`favorite_count`**?
5. Cho user **xóa lịch sử** (từng tập và toàn bộ)? **Đã chốt**: có; người dùng thấy là đã xóa, hệ thống xóa mềm (áp cho cả yêu thích).
