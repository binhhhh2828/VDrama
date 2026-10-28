# Plan: Giai đoạn 2 / Catalog và tìm kiếm

> Trạng thái: **đã duyệt (2026-10-28), đồng ý cả ba đề xuất ở mục Câu hỏi; đang làm.** Làm trên branch `feat/catalog` (tách từ `feat/auth`; PR #1 cần được merge vào `main` trước khi mở PR cho plan này).
> Liên quan: `plan.md` mục 5 (API Catalog), Giai đoạn 2 task "Catalog" và "Tìm kiếm"; ma trận phân quyền ở `docs/plans/gd2-b2-auth.md`. Bảng dùng: `series`, `series_stats`, `genres`, `series_genres`, `episodes` (migration 0003–0004, 0008).

## Mục tiêu và phạm vi

- **Mục tiêu**: API công khai, chỉ đọc, đủ cho các trang Giai đoạn 3: trang chủ (banner, phim mới, phim hot), trang thể loại, trang tìm kiếm, trang chi tiết phim + danh sách tập. Có dữ liệu mẫu để làm frontend khi chưa có phim thật.
- **Không làm** (đã có task riêng):
  - Xem tập (`GET /episodes/{id}/play`, kiểm tra free/VIP, signed token): task "play" + Cloudflare Stream.
  - Thêm/sửa/xóa phim, tập, thể loại, upload ảnh: Giai đoạn 4 (admin).
  - Đếm lượt xem (`series_stats.view_count` tăng khi xem): làm cùng `play`.
  - Lịch sử xem, yêu thích: task riêng của Giai đoạn 2.

## Nối với phần đã có

- **Không cần migration mới.** Index đã sẵn: `ix_series_published` (`published_at DESC, id DESC WHERE is_published`) cho danh sách mới; `ix_series_search_text_trgm` cho tìm không dấu; `ix_series_genres_genre_id` cho lọc thể loại; unique `(series_id, number)` cho danh sách tập.
- **Xóa mềm**: series/tập/thể loại đã xóa tự bị ẩn (bộ lọc ORM). Ẩn "theo cha" phải tự làm: tập của series đã xóa hoặc chưa xuất bản không được lộ ra.
- **Tìm kiếm** luôn qua `series_search_condition()` (`app/services/search.py`) để khớp index trigram.
- **Phân quyền**: dùng `OptionalUser` (khách vẫn xem catalog). Lỗi theo `ApiError` + `ErrorCode`; catalog chỉ có GET nên không bị CSRF ảnh hưởng.

## Thiết kế

### Ai thấy gì

| | Khách / User / VIP | Admin |
|---|---|---|
| Danh sách, tìm kiếm, thể loại | chỉ series đã xuất bản | như người thường (quản lý ở trang admin, Giai đoạn 4) |
| Chi tiết series, danh sách tập | series chưa xuất bản → 404 `not_found`; chỉ thấy tập đã xuất bản | xem trước được series và tập chưa xuất bản (ma trận phân quyền đã chốt) |

- Tập trả về **không bao giờ** có `stream_video_id` (chỉ `play` mới cấp đường phát).
- Mỗi tập có `access`: `"free"` hoặc `"vip"` (từ `episodes.is_free`). **Catalog trả cùng một nội dung cho mọi người** (đề xuất, xem Câu hỏi 2): frontend tự ghép với `/me.is_vip` để hiện ổ khóa. Nhờ vậy sau này cache được ở Cloudflare/Next.js.

### Endpoint (prefix `/api/v1`)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/genres` | Mọi thể loại (ít dòng, không phân trang), sắp theo tên |
| GET | `/series` | Danh sách series đã xuất bản. Tham số: `sort=new\|hot` (mặc định `new`), `genre=<slug>`, `with_banner=true` (chỉ series có banner, cho slider trang chủ), `limit` (mặc định 20, tối đa 50), `cursor` |
| GET | `/series/{slug}` | Chi tiết: thông tin, thể loại, số tập đã xuất bản, tập mới nhất, lượt xem |
| GET | `/series/{slug}/episodes` | Mọi tập đã xuất bản theo `number` tăng dần (một bộ thường dưới 200 tập, không phân trang) |
| GET | `/search?q=` | Tìm theo tên không dấu. `q` 2–100 ký tự; `limit` tối đa 50; sắp theo độ giống (`similarity` của pg_trgm), cùng điểm thì phim mới hơn trước |

### Phân trang

- **Keyset (con trỏ)**, không dùng `OFFSET`: trang sau không trùng/sót khi có phim mới xuất bản giữa chừng, và không chậm dần khi đi sâu.
- `sort=new`: theo `(published_at DESC, id DESC)`, khớp đúng index sẵn có. `sort=hot`: theo `(view_count DESC, id DESC)` (series chưa có dòng `series_stats` tính là 0).
- Phản hồi: `{ "items": [...], "next_cursor": "..." | null }`. Con trỏ là chuỗi mờ (base64 của giá trị sắp xếp + id + loại sort); con trỏ hỏng hoặc dùng sai `sort` → 422 `validation_error`.
- Tìm kiếm không dùng con trỏ (chỉ cần trang đầu, tối đa 50 kết quả).

### Dữ liệu mẫu cho dev

Lệnh `uv run python -m app.cli seed-demo`: tạo vài thể loại, ~12 series (có/không banner, đang chiếu/hoàn thành), mỗi bộ vài tập (tập đầu miễn phí, có tập chưa xuất bản, một series chưa xuất bản, một series đã xóa mềm) để frontend thấy đủ các trường hợp. Tập mẫu đặt `stream_status='ready'` với id video giả. **Từ chối chạy khi `ENV=prod`**; chạy lại không tạo trùng (theo slug).

## File bị ảnh hưởng

- `app/schemas/catalog.py` (Genre, SeriesCard, SeriesDetail, Episode, Page)
- `app/services/catalog.py` (truy vấn danh sách, chi tiết, tập, tìm kiếm; con trỏ keyset)
- `app/routers/catalog.py`, `app/main.py` (gắn router)
- `app/cli.py` (lệnh `seed-demo`), `app/services/demo_seed.py`
- Test: `test_catalog_api.py`, `test_search_api.py`, `test_demo_seed.py`
- `docs/api.md` (phần Catalog), `plan.md`, `CLAUDE.md` (quy ước truy vấn catalog), README (lệnh seed)

## Các bước

- [x] **Bước 1: Thể loại và danh sách phim mới** (test kế hoạch truy vấn bắt được lỗi: `is_published IS true` không khớp điều kiện của index một phần `WHERE is_published`, đã đổi thành `WHERE is_published`; quy ước này sẽ ghi vào CLAUDE.md ở Bước 6)
  - Việc: schema, `services/catalog.py`, `GET /genres`, `GET /series` với `sort=new`, lọc `genre`, `with_banner`, con trỏ keyset.
  - Hoàn thành khi: test chỉ trả series đã xuất bản và chưa xóa; thể loại đã xóa không hiện và lọc theo nó trả rỗng; đi hết các trang bằng con trỏ không trùng, không sót, kể cả khi có phim mới xuất bản giữa chừng; nhiều series cùng `published_at` vẫn đúng thứ tự (nhờ `id`); con trỏ hỏng → 422; `limit` ngoài 1–50 → 422; truy vấn dùng index `ix_series_published` (kiểm tra `EXPLAIN`).
- [ ] **Bước 2: Chi tiết phim và danh sách tập**
  - Việc: `GET /series/{slug}`, `GET /series/{slug}/episodes`, admin xem trước.
  - Hoàn thành khi: test series chưa xuất bản/đã xóa → 404 cho khách và user, admin xem được; chỉ tập đã xuất bản và chưa xóa hiện ra (admin thấy cả tập chưa xuất bản, có cờ `is_published`); tập sắp theo số; response không có `stream_video_id`; `access` đúng `free`/`vip`; số tập và tập mới nhất chỉ đếm tập đã xuất bản.
- [ ] **Bước 3: Phim hot**
  - Việc: `sort=hot` (join trái `series_stats`), con trỏ theo lượt xem.
  - Hoàn thành khi: test thứ tự theo lượt xem, series không có `series_stats` tính 0 và vẫn có mặt; phân trang hot không trùng/sót; con trỏ của `new` dùng cho `hot` → 422.
- [ ] **Bước 4: Tìm kiếm**
  - Việc: `GET /search?q=` qua `series_search_condition()`, sắp theo độ giống.
  - Hoàn thành khi: test "nang tho" ra "Nàng Thơ", tìm có dấu/không dấu/hoa thường như nhau; ký tự `%` `_` `\` được hiểu theo nghĩa đen; series chưa xuất bản/đã xóa không ra; `q` ngắn hơn 2 hoặc dài hơn 100 → 422; kết quả khớp tên gần hơn đứng trước.
- [ ] **Bước 5: Dữ liệu mẫu**
  - Việc: lệnh `seed-demo`.
  - Hoàn thành khi: test chạy hai lần không tạo trùng; `ENV=prod` bị từ chối; sau khi seed, `GET /series` và `/series/{slug}/episodes` trả dữ liệu đủ các trường hợp đã liệt kê.
- [ ] **Bước 6: Tài liệu và kiểm tra cuối**
  - Việc: `docs/api.md` (Catalog: endpoint, tham số, ví dụ response, cách dùng con trỏ, cách hiện ổ khóa từ `access` + `/me.is_vip`), `plan.md`, CLAUDE.md, README; chạy compose + seed + curl các endpoint.

## Rủi ro

- **"Hot" chưa có ý nghĩa** cho đến khi làm `play` (lượt xem đều 0, thứ tự rơi về `id`). Chấp nhận: API và giao diện làm trước, số liệu đến sau.
- **Lọc theo thể loại + sắp theo ngày** không có index ghép: với vài trăm series vẫn nhanh; ghi lại để thêm index khi catalog lớn.
- **Admin xem trước qua API công khai**: phải chắc chắn danh sách và tìm kiếm không lộ phim chưa xuất bản kể cả với admin (có test).

## Câu hỏi còn mở (cần bạn chốt)

1. **Banner trang chủ**: đề xuất lấy các series mới nhất **có `banner_url`** (`/series?with_banner=true&limit=5`), không thêm cột mới. Muốn admin tự chọn phim lên banner thì thêm cột (ví dụ `featured_rank`) bằng migration ở Giai đoạn 4.
2. **Ổ khóa trên từng tập**: đề xuất catalog trả cùng nội dung cho mọi người (`access: free|vip`), frontend ghép với `/me.is_vip`. Cách khác: API trả sẵn `locked` theo người xem (tiện cho frontend nhưng không cache được).
3. **Độ dài từ khóa tìm kiếm**: đề xuất tối thiểu 2 ký tự (tên phim tiếng Việt có từ 2 chữ cái). Từ khóa dưới 3 ký tự không dùng được index trigram nên quét cả bảng; với vài trăm series không đáng kể.
