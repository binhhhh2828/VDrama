# API VDrama

Mọi route nằm dưới `/api` (Caddy chuyển `/api/*` sang FastAPI). API nghiệp vụ có phiên bản: `/api/v1/...`. Web và API dùng chung một domain nên không có CORS; đăng nhập bằng cookie httpOnly, frontend không tự cầm token.

Ở dev có Swagger tại `http://localhost:8000/api/docs` (đọc tài liệu được; các lệnh POST thử từ Swagger bị middleware CSRF chặn vì Origin là cổng 8000, hãy thử qua web ở cổng 3000 hoặc curl).

## Quy ước chung

### Định dạng lỗi

Mọi lỗi có cùng dạng (`app/core/errors.py`):

```json
{ "error": { "code": "invalid_credentials", "message": "Email hoặc mật khẩu không đúng." } }
```

- `code` cố định, frontend xử lý theo `code`; `message` tiếng Việt để hiển thị.
- Lỗi validate (422, `validation_error`) có thêm `fields`: `[{ "field": "password", "type": "string_too_short", "message": "..." }]`. Giá trị đã gửi không bao giờ được trả lại.
- Mỗi phản hồi có header `X-Request-ID` (gửi kèm khi báo lỗi để tra log và nhật ký).

| code | HTTP | Ý nghĩa |
|---|---|---|
| `bad_request` | 400 | Yêu cầu không hợp lệ (ví dụ thân webhook không đọc được) |
| `validation_error` | 422 | Dữ liệu gửi lên sai (xem `fields`) |
| `not_authenticated` | 401 | Chưa đăng nhập hoặc access token hết hạn/không hợp lệ → gọi `/auth/refresh` rồi thử lại |
| `session_expired` | 401 | Phiên hết hạn, đã đăng xuất hoặc bị thu hồi → mời đăng nhập lại |
| `invalid_credentials` | 401 | Sai email hoặc mật khẩu (không phân biệt hai trường hợp) |
| `forbidden` | 403 | Không đủ quyền, hoặc request bị chặn vì không đến từ trang VDrama (CSRF) |
| `account_disabled` | 403 | Tài khoản bị khóa (chỉ báo khi đã nhập đúng mật khẩu) |
| `vip_required` | 403 | Cần gói VIP còn hạn (dùng ở endpoint xem tập) |
| `not_found` | 404 | Không tìm thấy |
| `method_not_allowed` | 405 | Sai phương thức HTTP cho đường dẫn này |
| `email_taken` | 409 | Email đã được dùng (không phân biệt hoa/thường, kể cả tài khoản đã xóa) |
| `video_not_ready` | 409 | Video của tập chưa chuyển mã xong (chỉ gặp khi admin xem trước) |
| `conflict` | 409 | Thao tác không hợp với trạng thái hiện tại (ví dụ thay video của tập đang xuất bản) |
| `payload_too_large` | 413 | Dữ liệu gửi lên quá lớn |
| `invalid_signature` | 401 | Chữ ký webhook sai, thiếu, hoặc quá hạn |
| `stream_provider_error` | 502 | Cloudflare Stream lỗi hoặc không trả lời (thử lại sau) |
| `stream_unavailable` | 503 | Chưa cấu hình Cloudflare Stream (thường gặp ở dev) |
| `rate_limited` | 429 | Thao tác quá nhiều lần; header `Retry-After` cho biết số giây cần chờ |
| `internal_error` | 500 | Lỗi phía server (chi tiết chỉ có trong log) |

### Cookie đăng nhập

| Cookie | Nội dung | Path | Thời hạn |
|---|---|---|---|
| `__Host-vd_access` (dev: `vd_access`) | Access token (JWT, 15 phút) | `/` | 15 phút |
| `vd_refresh` | Refresh token ngẫu nhiên (server chỉ lưu SHA-256) | `/api/v1/auth` | 30 ngày, đặt lại mỗi lần refresh |

Cờ: `HttpOnly`, `SameSite=Lax`, `Secure` (dev tắt bằng `COOKIE_SECURE=false` vì chạy `http://localhost`). Tiền tố `__Host-` chỉ dùng khi `Secure` bật.

### Phiên và làm mới

- Mỗi lần đăng ký/đăng nhập là một phiên (một thiết bị). Mỗi request có đăng nhập đều kiểm tra phiên trong DB, nên đăng xuất, khóa hoặc xóa tài khoản có hiệu lực ngay.
- Gặp 401 `not_authenticated` thì gọi `POST /api/v1/auth/refresh` một lần rồi thử lại request; refresh trả 401 `session_expired` thì mời đăng nhập lại.
- Refresh xoay vòng token: token cũ còn dùng được 60 giây (hai tab refresh cùng lúc không bị đăng xuất); dùng lại token cũ sau đó bị coi là bị đánh cắp và **cả phiên bị thu hồi**.

### Chống CSRF

Request `POST/PUT/PATCH/DELETE` có header `Origin` (hoặc `Referer`) khác `PUBLIC_ORIGIN` bị 403. Thiếu cả hai mà có cookie đăng nhập cũng bị 403. Trình duyệt tự gửi `Origin`, frontend không cần làm gì. Gọi bằng curl có cookie thì thêm `-H "Origin: http://localhost:3000"`.

### Giới hạn tần suất

| Endpoint | Ngưỡng |
|---|---|
| `POST /auth/login` | 10 lần/phút theo IP và 5 lần/phút theo IP + email |
| `POST /auth/register` | 5 lần/giờ theo IP |
| `POST /auth/refresh` | 30 lần/phút theo IP |
| `GET /episodes/{id}/play` | 60 lần/phút theo user |
| `PUT /me/history/{episode_id}` | 30 lần/phút theo user |
| `PUT/DELETE /me/favorites/{series_id}` | 60 lần/phút theo user (thêm và bỏ chung bộ đếm) |

IP thật lấy từ `CF-Connecting-IP` khi `TRUST_CLOUDFLARE_IP=true` (bắt buộc ở prod, vì API nằm sau Cloudflare và Caddy). Request không xác định được IP thì không bị đếm.

## Auth

### Đối tượng User

```json
{
  "id": 1,
  "email": "binh@example.com",
  "display_name": "Bình",
  "avatar_url": null,
  "role": "user",
  "email_verified": false,
  "created_at": "2026-10-28T08:00:00Z",
  "vip_expires_at": null,
  "is_vip": false
}
```

`role` là `user` hoặc `admin`. VIP không phải role: `is_vip` đúng khi `vip_expires_at` còn ở tương lai (tính tại lúc server trả lời). Không bao giờ có `password_hash`.

### `POST /api/v1/auth/register`

Tạo tài khoản và đăng nhập luôn (đặt cả hai cookie).

```json
{ "email": "binh@example.com", "password": "it-nhat-8-ky-tu", "display_name": "Bình", "accept_terms": true }
```

- `password`: 8–128 ký tự, không trùng email. `display_name`: 1–100 ký tự. `accept_terms` phải là `true` (lưu thời điểm đồng ý). Trường lạ (ví dụ `role`) bị từ chối.
- **201** + User. Lỗi: 409 `email_taken`, 422 `validation_error`, 429.

### `POST /api/v1/auth/login`

```json
{ "email": "binh@example.com", "password": "..." }
```

- **200** + User, đặt cả hai cookie (tạo phiên mới).
- Lỗi: 401 `invalid_credentials`, 403 `account_disabled`, 429.

### `POST /api/v1/auth/refresh`

Không có body; đọc cookie `vd_refresh`.

- **204**, đặt cookie access mới (và cookie refresh mới, trừ khi đang trong 60 giây ân hạn).
- Lỗi: 401 `session_expired` (đồng thời xóa cả hai cookie), 429.

### `POST /api/v1/auth/logout`

Thu hồi phiên của thiết bị này và xóa cookie. Luôn **204**, kể cả khi chưa đăng nhập.

### `GET /api/v1/me`

- **200** + User hiện tại.
- Lỗi: 401 `not_authenticated`.

## Catalog

Chỉ đọc, khách cũng gọi được. **Cùng một nội dung cho mọi người xem** (không có dữ liệu riêng của người dùng), nên sau này cache được. Chỉ có phim/tập đã xuất bản; phim/tập đã xóa không bao giờ hiện ra.

### Đối tượng SeriesCard (thẻ phim trong danh sách)

```json
{
  "id": 1,
  "slug": "hen-uoc-mua-thu",
  "title": "Hẹn Ước Mùa Thu",
  "poster_url": "https://...",
  "banner_url": null,
  "year": 2026,
  "country": "Việt Nam",
  "status": "ongoing",
  "total_episodes": 16,
  "published_at": "2026-10-27T08:00:00Z",
  "genres": [{ "slug": "tinh-cam", "name": "Tình cảm" }]
}
```

`status`: `ongoing` (đang chiếu) hoặc `completed`. `total_episodes` là số tập dự kiến (có thể null), khác với số tập đã có (`episode_count` ở trang chi tiết).

### `GET /api/v1/genres`

Mọi thể loại, sắp theo tên: `[{ "slug": "hai", "name": "Hài" }, ...]`.

### `GET /api/v1/series`

Danh sách phim, phân trang bằng con trỏ.

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `sort` | `new` | `new`: mới xuất bản trước. `hot`: nhiều lượt xem trước (lượt xem đếm ở `GET /episodes/{id}/play`) |
| `genre` | | Lọc theo slug thể loại; slug không có thì trả rỗng |
| `with_banner` | `false` | `true`: chỉ phim có ảnh banner (slider trang chủ: `?with_banner=true&limit=5`) |
| `limit` | `20` | 1–50 |
| `cursor` | | Lấy trang sau: truyền `next_cursor` của trang trước, **giữ nguyên** các tham số khác |

Phản hồi: `{ "items": [SeriesCard, ...], "next_cursor": "..." | null }`. `next_cursor` là null khi đã hết. Con trỏ là chuỗi mờ, không tự tạo; con trỏ hỏng hoặc dùng cho `sort` khác → 422 `validation_error` (`fields[].field = "cursor"`).

Phân trang bằng con trỏ nên khi có phim mới xuất bản giữa chừng, trang sau không bị trùng hay sót; không có "nhảy tới trang N".

### `GET /api/v1/series/{slug}`

SeriesCard cộng thêm:

```json
{
  "description": "...",
  "episode_count": 11,
  "latest_episode_number": 11,
  "view_count": 5200,
  "favorite_count": 87,
  "is_published": true
}
```

`episode_count`, `latest_episode_number` chỉ tính tập đã xuất bản. Trang này giống nhau cho mọi người (không có "tôi đã yêu thích chưa"): hỏi `GET /api/v1/me/favorites/{series_id}` để tô nút yêu thích. Phim không có, chưa xuất bản hoặc đã xóa → 404 `not_found`. Admin (đã đăng nhập) xem trước được phim chưa xuất bản, khi đó `is_published` là `false`.

### `GET /api/v1/series/{slug}/episodes`

Mọi tập đã xuất bản, theo số tập tăng dần (không phân trang):

```json
[
  {
    "id": 10,
    "number": 1,
    "title": "Tập 1",
    "duration_sec": 1297,
    "thumbnail_url": "https://...",
    "access": "free",
    "published_at": "2026-10-27T09:00:00Z",
    "is_published": true
  }
]
```

- `access`: `free` (đăng nhập là xem được) hoặc `vip` (cần VIP còn hạn). Không có id video: đường phát chỉ lấy qua `GET /api/v1/episodes/{id}/play`.
- **Hiện ổ khóa**: catalog không biết ai đang xem, frontend tự ghép với `GET /me`:

| | Khách | User | `is_vip: true` |
|---|---|---|---|
| `access: free` | mời đăng nhập | xem được | xem được |
| `access: vip` | mời đăng nhập | ổ khóa, mời mua VIP | xem được |

- Phim không xem được → 404 như trang chi tiết. Admin thấy thêm tập chưa xuất bản (`is_published: false`).

### `GET /api/v1/search?q=`

Tìm phim theo tên, không dấu, không phân biệt hoa thường: `nang tho` ra "Nàng Thơ". Tìm được một phần tên.

| Tham số | Ý nghĩa |
|---|---|
| `q` | 2–100 ký tự (sau khi bỏ khoảng trắng hai đầu); sai → 422 |
| `limit` | 1–50, mặc định 20 |

Phản hồi: `{ "items": [SeriesCard, ...] }` (chỉ trang đầu, không có con trỏ). Tên sát từ khóa hơn đứng trước; cùng mức thì phim mới hơn trước. Ký tự `%`, `_` được hiểu đúng nghĩa đen.

### Dữ liệu mẫu (dev)

`uv run python -m app.cli seed-demo` (hoặc `docker compose -f docker-compose.dev.yml exec api python -m app.cli seed-demo`) thêm 12 phim mẫu đủ các trường hợp trên. Ảnh là ảnh giữ chỗ từ `picsum.photos` (cần cho phép domain này trong cấu hình ảnh của Next.js), id video giả nên chưa phát được. Không chạy ở `ENV=prod`; chạy lại không tạo trùng.

## Xem tập

### `GET /api/v1/episodes/{id}/play`

**Chỗ duy nhất kiểm tra quyền xem.** Trả URL phát có token ngắn hạn (Cloudflare Stream signed URL):

```json
{
  "episode_id": 10,
  "hls_url": "https://customer-xxx.cloudflarestream.com/<token>/manifest/video.m3u8",
  "dash_url": "https://customer-xxx.cloudflarestream.com/<token>/manifest/video.mpd",
  "iframe_url": "https://customer-xxx.cloudflarestream.com/<token>/iframe",
  "expires_at": "2026-10-29T15:00:00Z"
}
```

- Dùng `iframe_url` cho Stream player có sẵn, hoặc `hls_url` với hls.js (Safari phát HLS trực tiếp).
- `expires_at`: hạn của token, mặc định 3 giờ, tự dài hơn nếu tập dài (tối đa 24 giờ). Đủ xem hết tập; hết hạn (người xem để tab mở lâu) thì gọi lại `play` lấy URL mới. Không lưu URL lâu dài.
- Phản hồi có `Cache-Control: no-store`.
- Mỗi lượt `play` thành công tính một lượt xem cho phim (mỗi người mỗi tập tối đa một lượt trong 6 giờ; admin không tính).

| Tình huống | Kết quả |
|---|---|
| Tập/phim không có, đã xóa, chưa xuất bản | 404 `not_found` (kể cả với khách: không dò được tập ẩn) |
| Khách | 401 `not_authenticated` (kể cả tập miễn phí) |
| Tập VIP, chưa có VIP hoặc VIP hết hạn | 403 `vip_required` → mời mua VIP |
| Admin | xem mọi tập, xem trước tập/phim chưa xuất bản |
| Admin xem trước tập chưa chuyển mã xong | 409 `video_not_ready` |
| Chưa cấu hình Stream | 503 `stream_unavailable` |
| Quá 60 lần/phút | 429 `rate_limited` |

## Lịch sử xem

Cần đăng nhập. **Xóa là xóa mềm**: người dùng không thấy nữa ở mọi API, hệ thống vẫn giữ dữ liệu (xem Chính sách bảo mật). Xem lại tập đã xóa thì tập đó hiện lại trong lịch sử.

### `PUT /api/v1/me/history/{episode_id}`

Player báo tiến độ mỗi 15–30 giây và khi tạm dừng/đóng trang. Body `{ "progress_sec": 754 }` (0–86400; lớn hơn thời lượng tập thì được cắt bằng thời lượng). Trả 204. Quyền giống hệt `play`: tập ẩn → 404, tập VIP khi không có/hết VIP → 403 `vip_required`.

### `GET /api/v1/me/history`

"Xem tiếp": mỗi phim **một dòng** là tập xem gần nhất, phim xem gần nhất trước. `limit` 1–50 (mặc định 20), không phân trang.

```json
{
  "items": [
    {
      "series": { "...": "SeriesCard" },
      "episode": { "id": 12, "number": 3, "title": "Tập 3", "duration_sec": 1500, "thumbnail_url": "...", "access": "vip", "published_at": "...", "is_published": true },
      "progress_sec": 754,
      "updated_at": "2026-10-29T12:00:00Z"
    }
  ]
}
```

Tập/phim bị gỡ hoặc xóa thì ẩn (tập gần nhất bị gỡ thì phim đó lùi về tập còn xem được gần nhất); xuất bản lại thì hiện lại. Tự tính "đã xem xong" bằng `progress_sec / episode.duration_sec`.

### `GET /api/v1/me/history/series/{slug}`

Tiến độ các tập đã xem của một phim, theo số tập (thanh tiến độ trong danh sách tập, nút "Xem tiếp tập N"):

```json
{ "items": [ { "episode_id": 10, "number": 1, "progress_sec": 1500, "updated_at": "..." } ] }
```

Phim không xem được → 404. Admin xem trước được như catalog.

### `DELETE /api/v1/me/history/{episode_id}` và `DELETE /api/v1/me/history`

Xóa một tập / toàn bộ lịch sử xem của chính mình. Luôn 204 (gọi lại, hoặc tập chưa từng xem, vẫn 204).

## Yêu thích

Cần đăng nhập. Dùng **id phim** (`SeriesCard.id`), không dùng slug. Bỏ yêu thích cũng là xóa mềm.

| Method | Đường dẫn | Kết quả |
|---|---|---|
| PUT | `/api/v1/me/favorites/{series_id}` | Thêm. 204; bấm lại vẫn 204, không đếm thêm. Phim không có/chưa xuất bản/đã xóa → 404 |
| DELETE | `/api/v1/me/favorites/{series_id}` | Bỏ. 204; chưa yêu thích vẫn 204 |
| GET | `/api/v1/me/favorites/{series_id}` | `{ "favorited": true }` |
| GET | `/api/v1/me/favorites` | `{ "items": [SeriesCard, ...], "next_cursor": ... }`, mới yêu thích trước; `limit` 1–50, `cursor` như `GET /series` |

Thêm lại phim đã bỏ thì phim lên đầu danh sách. Phim bị gỡ sau khi đã yêu thích thì ẩn khỏi danh sách (và `favorited: false`), xuất bản lại thì hiện lại. `favorite_count` ở trang chi tiết phim chỉ đổi khi trạng thái thật sự đổi.

## Phân quyền

| Hành động | Khách | User | VIP còn hạn | Admin |
|---|---|---|---|---|
| Xem danh sách, chi tiết phim, tìm kiếm | được | được | được | được |
| Xem tập miễn phí | 401 `not_authenticated` | được | được | được |
| Xem tập VIP | 401 `not_authenticated` | 403 `vip_required` | được | được |
| Tập/phim chưa xuất bản | 404 | 404 | 404 | được |
| Lịch sử xem, yêu thích (của chính mình) | 401 `not_authenticated` | được | được | được |
| Báo tiến độ tập VIP | 401 `not_authenticated` | 403 `vip_required` | được | được |
| API admin | 401 | 403 `forbidden` | 403 `forbidden` | được |

Trong code: `CurrentUser`, `OptionalUser`, `AdminUser` ở `app/api/deps.py`. Bảng này có test tương ứng (`app/tests/test_permissions.py`, ma trận quyền); test đó cũng tự quét mọi route để bắt endpoint admin/ghi dữ liệu quên bảo vệ.

## Admin

Không đăng ký admin được trên web. Người vận hành chạy trên server (hỏi mật khẩu, không nhận qua tham số; bắt buộc lý do, có ghi nhật ký):

```bash
uv run python -m app.cli create-admin --email admin@vdrama.vn --reason "Admin đầu tiên"
```

Email chưa có tài khoản thì tạo mới; đã có thì nâng quyền (không đổi mật khẩu).

### Video tập phim (Cloudflare Stream)

File video đi thẳng từ trình duyệt lên Cloudflare (tus), không qua VPS. Luồng:

1. Tập phải **chưa xuất bản**. Gọi `POST /api/v1/admin/episodes/{id}/upload` với `{ "size_bytes": 734003200 }` → 201 `{ "upload_url": "...", "video_id": "..." }`. Tập chuyển sang `stream_status: uploading`.
2. Upload bằng tus-js-client với `uploadUrl: upload_url` (không đặt `endpoint`), `chunkSize` khoảng 50–150 MB.
3. Cloudflare chuyển mã xong thì báo webhook → tập thành `ready` (có `duration_sec`, `thumbnail_url`) hoặc `error`. Chỉ tập `ready` mới xuất bản được.
4. Không thấy cập nhật (webhook trượt, hoặc ở dev): `POST /api/v1/admin/episodes/{id}/stream-sync` hỏi Cloudflare rồi cập nhật như webhook, trả `{ episode_id, video_id, stream_status, duration_sec, thumbnail_url, result }` với `result`: `updated` | `unchanged` | `skipped_published`.

| Tình huống | Kết quả |
|---|---|
| Tập đang xuất bản (upload) | 409 `conflict`: gỡ xuất bản trước khi thay video |
| Tập chưa có video (stream-sync) | 409 `conflict` |
| File quá `STREAM_MAX_UPLOAD_BYTES` (mặc định 10 GB), `size_bytes` < 1 | 422 |
| Cloudflare lỗi / không trả lời | 502 `stream_provider_error`, dữ liệu không đổi |
| Thiếu `CF_ACCOUNT_ID`/`CF_STREAM_API_TOKEN` | 503 `stream_unavailable` |

Thay video: video cũ vẫn nằm trên Cloudflare (tính phí lưu trữ); id của nó ghi trong nhật ký `episodes.upload_start` để dọn sau. Video nào báo xong mà không bật chế độ chỉ phát bằng token sẽ bị đánh dấu `error`.

## Webhook

### `POST /api/v1/webhooks/stream`

Cloudflare Stream gọi khi video chuyển mã xong hoặc lỗi. Frontend không dùng. Xác thực bằng header `Webhook-Signature: time=<unix>,sig1=<hex>` (HMAC-SHA256 của `"<time>.<thân thô>"` với `CF_STREAM_WEBHOOK_SECRET`); sai, thiếu, hoặc lệch giờ quá 5 phút → 401 `invalid_signature`. Thân tối đa 64 KB. Trả `{ "result": "updated" | "unchanged" | "unknown_video" | "skipped_published" }`; Cloudflare gửi lại cùng sự kiện không gây ghi thêm.
