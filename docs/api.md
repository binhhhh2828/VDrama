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
| `validation_error` | 422 | Dữ liệu gửi lên sai (xem `fields`) |
| `not_authenticated` | 401 | Chưa đăng nhập hoặc access token hết hạn/không hợp lệ → gọi `/auth/refresh` rồi thử lại |
| `session_expired` | 401 | Phiên hết hạn, đã đăng xuất hoặc bị thu hồi → mời đăng nhập lại |
| `invalid_credentials` | 401 | Sai email hoặc mật khẩu (không phân biệt hai trường hợp) |
| `forbidden` | 403 | Không đủ quyền, hoặc request bị chặn vì không đến từ trang VDrama (CSRF) |
| `account_disabled` | 403 | Tài khoản bị khóa (chỉ báo khi đã nhập đúng mật khẩu) |
| `vip_required` | 403 | Cần gói VIP còn hạn (dùng ở endpoint xem tập) |
| `not_found` | 404 | Không tìm thấy |
| `email_taken` | 409 | Email đã được dùng (không phân biệt hoa/thường, kể cả tài khoản đã xóa) |
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

## Phân quyền

| Hành động | Khách | User | VIP còn hạn | Admin |
|---|---|---|---|---|
| Xem danh sách, chi tiết phim, tìm kiếm | được | được | được | được |
| Xem tập miễn phí | 401 `not_authenticated` | được | được | được |
| Xem tập VIP | 401 `not_authenticated` | 403 `vip_required` | được | được |
| Tập/phim chưa xuất bản | 404 | 404 | 404 | được |
| API admin | 401 | 403 `forbidden` | 403 `forbidden` | được |

Trong code: `CurrentUser`, `OptionalUser`, `AdminUser` ở `app/api/deps.py`.

## Admin

Không đăng ký admin được trên web. Người vận hành chạy trên server (hỏi mật khẩu, không nhận qua tham số; bắt buộc lý do, có ghi nhật ký):

```bash
uv run python -m app.cli create-admin --email admin@vdrama.vn --reason "Admin đầu tiên"
```

Email chưa có tài khoản thì tạo mới; đã có thì nâng quyền (không đổi mật khẩu).
