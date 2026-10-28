# Plan: Giai đoạn 2 / Auth — đăng ký, đăng nhập, refresh, đăng xuất, /me, phân quyền admin

> Trạng thái: **đã duyệt (2026-10-28), đang làm trên branch `feat/auth`.** Xong Bước 1–4. Làm **sau** plan bổ sung schema (`gd2-b1b-trang-thai-xoa-mem-nhat-ky.md`: trạng thái, xóa mềm, nhật ký thao tác); vì vậy migration của auth là `0010`. User bị xóa mềm hoặc bị khóa đều không đăng nhập được; đổi quyền admin và lệnh `create-admin` đều ghi nhật ký.
>
> Đã chốt: đăng ký trùng email thì báo rõ "Email đã được sử dụng"; đăng nhập 30 ngày tự gia hạn. Nhắc hạn và gia hạn VIP thuộc Giai đoạn 5 (đã ghi vào `plan.md`), không thuộc plan này.
> Liên quan: `plan.md` mục 5 (API), mục 6 (bảo mật), Giai đoạn 2 task "Auth", Giai đoạn 5 (giới hạn thiết bị). Bảng dùng: `users`, `sessions` (migration 0002), `audit_logs` (0009).

## Nối với phần bổ sung schema đã làm (0007–0009)

Plan bổ sung schema đã xong; auth dùng lại như sau, không làm lại:
- **User bị xóa mềm**: bộ lọc tự động ẩn user đã xóa ở mọi truy vấn ORM, nên đăng nhập tìm theo email không thấy → trả cùng lỗi `invalid_credentials` (không lộ là tài khoản từng tồn tại). `CurrentUser` nạp user qua ORM nên phiên của user đã xóa cũng tự 401; ngoài ra service xóa user đã thu hồi mọi phiên. User bị khóa (`is_active = false`, chưa xóa) thì trả `account_disabled`.
- **Đăng ký với email của user đã xóa mềm** → `email_taken` (email vẫn giữ chỗ để khôi phục được, đã chốt). Kiểm tra trùng email phải truy vấn với `include_deleted=True`, nếu không sẽ lọt qua bước kiểm tra rồi mới vấp unique index của DB.
- **Nhật ký**: đổi role (`users.role_change`) và lệnh `create-admin` ghi `audit_logs` qua `app/services/audit.py`, bắt buộc lý do; lệnh CLI dùng `Actor.system()`. Khóa/mở tài khoản (`users.disable` / `users.enable`) cũng ghi nhật ký. Đăng nhập/đăng xuất thường **không** ghi vào `audit_logs` (quá nhiều, đã có `sessions` để truy vết).
- **Enum**: role dùng `UserRole.USER` / `UserRole.ADMIN`.
- **IP thật**: thay phần lấy IP trong `app/core/request_context.py` bằng hàm đọc `CF-Connecting-IP` (chỉ khi `TRUST_CLOUDFLARE_IP=true`), để rate limit, `sessions.ip` và `audit_logs.ip` dùng chung một nguồn.

## Mục tiêu và phạm vi

Backend có luồng tài khoản hoàn chỉnh, an toàn để chạy production: đăng ký, đăng nhập, làm mới phiên, đăng xuất, lấy thông tin người dùng hiện tại, và chặn endpoint admin. Mọi thứ có test tự động trên Postgres thật.

**Không làm** trong plan này (đã có task riêng trong `plan.md`):
- Xác thực email, quên/đặt lại mật khẩu (task kế tiếp của Giai đoạn 2; bảng `email_tokens` đã sẵn).
- Giới hạn số thiết bị đồng thời, danh sách/đăng xuất từng thiết bị (Giai đoạn 5). Thiết kế dưới đây để việc đó chỉ cần thêm vài dòng.
- Giao diện đăng nhập/đăng ký (Giai đoạn 3), đăng nhập Google (Giai đoạn 9).

## Phân quyền tổng thể

### Role và VIP là hai thứ khác nhau

- **Role** (`users.role`) chỉ có `user` và `admin`. Role là quyền quản trị, không tự hết hạn, chỉ đổi bằng lệnh trên server.
- **VIP không phải là role, cũng không phải cờ `is_vip`.** VIP là trạng thái có thời hạn. Lưu thành role hoặc cờ true/false thì phải có job "tắt VIP" chạy đúng giờ; job trễ hoặc lỗi là người hết hạn vẫn xem được, hoặc người vừa gia hạn bị chặn.
- **Thiết kế chốt (2026-10-27): thêm cột `users.vip_expires_at` (timestamptz, NULL = chưa từng mua).** Đang là VIP khi `vip_expires_at > now()`. So với giờ hiện tại nên **tự hết hạn đúng từng giây, không cần job**.
  - `subscriptions` vẫn là **nguồn sự thật** (lịch sử từng lần mua, đối soát, hoàn tiền). `users.vip_expires_at` là bản tóm tắt để kiểm tra nhanh.
  - Nhanh: `CurrentUser` đã đọc dòng `users` ở mọi request, nên kiểm tra VIP khi bấm xem tập **không tốn thêm truy vấn nào**.
  - Chỉ **một hàm** được ghi cột này (`services/vip.py`), luôn trong **cùng transaction** với việc thêm/hủy subscription: `vip_expires_at = max(expires_at)` của các subscription `active` của user đó. Có test đối chiếu cột này với `subscriptions` để bắt lệch.
  - Index một phần `users(vip_expires_at) WHERE vip_expires_at IS NOT NULL` cho job nhắc hạn ("ai hết hạn trong 5 ngày tới").
- Hàm dùng chung `is_vip(user)` đọc cột trên. `/me` trả thêm `vip_expires_at`.

### Quyền VIP đặt ở từng tập, không ở cả phim

Sơ đồ gợi ý cờ `is_vip` ở cấp phim. Schema hiện tại đặt `episodes.is_free` ở cấp **tập**, vì phim bộ thường cho xem miễn phí vài tập đầu để câu khách rồi khóa phần còn lại. Cấp tập bao được cả hai kiểu: cả phim miễn phí (mọi tập `is_free`) hoặc cả phim VIP (không tập nào `is_free`). Trang quản trị (Giai đoạn 4) sẽ có nút "đặt miễn phí N tập đầu" để thao tác nhanh theo cả phim.

### Ma trận quyền

| Hành động | Khách (chưa đăng nhập) | User | User có VIP còn hạn | Admin |
|---|---|---|---|---|
| Xem danh sách, chi tiết phim, tìm kiếm | được | được | được | được |
| Xem tập miễn phí | 401 `not_authenticated` (mời đăng nhập) | được | được | được |
| Xem tập VIP | 401 `not_authenticated` | 403 `vip_required` (mời mua VIP) | được | được |
| Xem tập/phim chưa xuất bản | 404 | 404 | 404 | được (xem trước) |
| Mua / gia hạn VIP | 401 | được **nếu đã xác thực email** | được (cộng nối tiếp vào hạn hiện tại) | được |
| Trang và API admin | 401 | 403 `forbidden` | 403 `forbidden` | được |

Ghi chú:
- Phân biệt 401 và 403 để frontend biết nên mời **đăng nhập** hay mời **mua VIP**.
- Tập chưa xuất bản trả 404 (không phải 403) để không lộ là tập đó tồn tại.
- Plan này làm phần nền: `CurrentUser`, `OptionalUser` (cho trang công khai), `require_admin`. Phần kiểm tra quyền xem tập (cột "Xem tập…") làm ở task endpoint `play`, phần mua VIP làm ở Giai đoạn 5, đều dựa trên ma trận trên.

## Luồng tài khoản (người dùng thấy gì)

1. **Đăng ký**: nhập email, mật khẩu, tên hiển thị, tick đồng ý điều khoản → tài khoản được tạo và **đăng nhập luôn** (không phải đăng nhập lại). Email trùng (kể cả khác hoa/thường) → báo "Email đã được sử dụng".
2. **Xác thực email** (task kế tiếp, không thuộc plan này): hệ thống gửi email có link xác thực. Chưa xác thực vẫn xem được tập miễn phí; phải xác thực trước khi mua VIP.
3. **Đăng nhập**: email + mật khẩu → giữ đăng nhập 30 ngày, tự gia hạn mỗi lần dùng. Sai thì báo chung "Email hoặc mật khẩu không đúng"; sai nhiều lần liên tiếp bị chặn tạm (rate limit).
4. **Trong lúc dùng**: access token 15 phút tự làm mới ở nền, người dùng không thấy gì.
5. **Đăng xuất**: thu hồi phiên trên thiết bị đó ngay lập tức.
6. **Admin**: không đăng ký được trên web. Người vận hành chạy lệnh `create-admin` trên server để tạo mới hoặc nâng quyền một tài khoản có sẵn; sau đó đăng nhập như user thường.

## Thiết kế

### Hai loại token, đều nằm trong cookie httpOnly

| | Access token | Refresh token |
|---|---|---|
| Dạng | JWT ký HS256 (PyJWT), claim: `sub` (user id), `sid` (session id), `iat`, `exp` | Chuỗi ngẫu nhiên 256 bit (không phải JWT) |
| Thời hạn | 15 phút | 30 ngày, **trượt**: mỗi lần refresh gia hạn thêm 30 ngày từ lúc đó |
| Lưu ở server | Không | Chỉ lưu **SHA-256** trong `sessions.refresh_token_hash` |
| Cookie | `vd_access`, `Path=/` | `vd_refresh`, `Path=/api/v1/auth` (trình duyệt chỉ gửi kèm khi gọi auth) |

Cờ cookie: `HttpOnly`, `SameSite=Lax`, `Secure` (bật ở prod; tắt được ở dev vì `http://localhost`). Ở prod dùng tiền tố `__Host-` cho cookie access để trình duyệt cấm ghi đè từ subdomain. JavaScript phía trình duyệt không đọc được token, nên lỗi XSS không lấy cắp được phiên.

**Mỗi request có đăng nhập vẫn kiểm tra session trong DB** (JWT hợp lệ + `sessions` chưa bị thu hồi/hết hạn + user `is_active`, gộp một truy vấn theo khóa chính). Đổi lại một truy vấn rất rẻ, ta được: đăng xuất/khóa tài khoản/đá thiết bị có hiệu lực **ngay lập tức** thay vì chờ JWT hết hạn. Đây cũng là nền cho giới hạn thiết bị ở Giai đoạn 5. Khi tải lớn có thể cache kết quả vài giây mà không đổi API.

### Xoay vòng refresh token (rotation) và phát hiện token bị đánh cắp

Mỗi lần gọi `/auth/refresh`: cấp refresh token mới, token cũ hết hiệu lực.
- Vấn đề thực tế: hai tab cùng refresh một lúc thì tab chậm hơn dùng token vừa bị xoay, nếu từ chối thẳng thì người dùng bị đăng xuất vô lý.
- Giải pháp: lưu thêm hash token **liền trước** và thời điểm xoay. Token liền trước vẫn được chấp nhận trong **60 giây**: cấp access token mới nhưng **không xoay tiếp** refresh token (giữ cookie tab kia vừa nhận; xoay tiếp thì phản hồi đến sau có thể ghi đè cookie bằng token đã cũ và người dùng bị đăng xuất oan).
- Token cũ bị dùng lại **sau** 60 giây → coi là bị đánh cắp → **thu hồi cả session** (cả kẻ trộm lẫn chủ đều phải đăng nhập lại).
- Cần migration `0010`: thêm `sessions.previous_refresh_token_hash` (unique, nullable) và `sessions.rotated_at` (cùng `users.terms_accepted_at`, `users.vip_expires_at` ở dưới).

### Mật khẩu

- Hash bằng **argon2id** (`argon2-cffi`, tham số mặc định của thư viện). Nếu sau này đổi tham số, tự hash lại khi người dùng đăng nhập thành công.
- Quy tắc: 8–128 ký tự (giới hạn trên chống làm nghẽn CPU bằng mật khẩu cực dài), không trùng email. Chưa bắt buộc chữ hoa/số; độ dài quan trọng hơn.
- Đăng nhập sai email hay sai mật khẩu đều trả **cùng một lỗi**, và khi email không tồn tại vẫn chạy một lần verify giả để thời gian phản hồi như nhau (không dò được email nào đã đăng ký qua đăng nhập).

### Chống CSRF

Cookie `SameSite=Lax` đã chặn phần lớn. Thêm một lớp: với mọi request thay đổi dữ liệu (`POST/PUT/PATCH/DELETE`) **có kèm cookie đăng nhập**, header `Origin` phải đúng domain của site (`PUBLIC_ORIGIN`), nếu không thì trả 403. Không cần CSRF token riêng vì web và API cùng một domain. Webhook thanh toán (không dùng cookie) không bị ảnh hưởng.

### Giới hạn tần suất (rate limit)

- Đăng nhập: 10 lần/phút theo IP và 5 lần/phút theo (IP + email). Đăng ký: 5 lần/giờ theo IP. Refresh: 30 lần/phút theo IP. Vượt thì trả 429 kèm `Retry-After`.
- Dùng `slowapi`, lưu đếm trong RAM của process: đủ cho 1 container API. Khi chạy nhiều container cần chuyển sang kho chung (Redis) hoặc rate limit ở Cloudflare; ghi vào `plan.md` Giai đoạn 6.
- IP thật: chỉ đọc `CF-Connecting-IP` khi bật `TRUST_CLOUDFLARE_IP=true` (production sau Cloudflare, firewall chỉ mở cho dải IP Cloudflare); dev/test dùng IP kết nối.

### Định dạng lỗi thống nhất

Đây là các endpoint nghiệp vụ đầu tiên nên chốt luôn cho cả dự án:

```json
{ "error": { "code": "invalid_credentials", "message": "Email hoặc mật khẩu không đúng." } }
```

`code` cố định để frontend xử lý; `message` tiếng Việt để hiển thị. Lỗi validate (422) cũng đổi về dạng này, kèm `fields` chỉ ra trường sai.

### Admin

- Phân quyền theo `users.role` đọc từ DB mỗi request (không tin role trong token), dependency `require_admin`.
- **Không có đường nào trên web để tự thành admin.** Tạo/nâng quyền admin bằng lệnh chạy trên server: `uv run python -m app.cli create-admin --email ...` (hỏi mật khẩu, không nhận qua tham số dòng lệnh để không lọt vào lịch sử shell).

### Đồng ý điều khoản

`plan.md` yêu cầu ô đồng ý khi đăng ký. Đăng ký bắt buộc `accept_terms: true`, lưu thời điểm vào cột mới `users.terms_accepted_at` (migration `0010`) làm bằng chứng đồng ý.

## API (prefix `/api/v1`)

| Method | Đường dẫn | Mô tả | Thành công | Lỗi chính |
|---|---|---|---|---|
| POST | `/auth/register` | `email`, `password`, `display_name`, `accept_terms` → tạo user + session, đặt cookie | 201 + user | 409 `email_taken`, 422 |
| POST | `/auth/login` | `email`, `password` → tạo session, đặt cookie, cập nhật `last_login_at` | 200 + user | 401 `invalid_credentials`, 403 `account_disabled`, 429 |
| POST | `/auth/refresh` | đọc cookie `vd_refresh` → xoay token, cấp access mới | 204 | 401 `session_expired` (xóa cookie) |
| POST | `/auth/logout` | thu hồi session hiện tại, xóa cookie | 204 | (luôn 204) |
| GET | `/me` | user hiện tại | 200 + user | 401 `not_authenticated` |

User trả về: `id`, `email`, `display_name`, `avatar_url`, `role`, `email_verified`, `created_at`, `vip_expires_at`, `is_vip`. Không bao giờ trả `password_hash`.

## Cấu hình mới (`.env`)

`JWT_SECRET` (bắt buộc ở prod, ≥ 32 byte ngẫu nhiên; app từ chối khởi động nếu thiếu), `ACCESS_TOKEN_TTL_MINUTES=15`, `REFRESH_TOKEN_TTL_DAYS=30`, `PUBLIC_ORIGIN` (ví dụ `https://vdrama.vn`), `COOKIE_SECURE` (mặc định true; dev đặt false), `TRUST_CLOUDFLARE_IP=false`.

## File bị ảnh hưởng

- `pyproject.toml`: thêm `argon2-cffi`, `pyjwt`, `slowapi`, `email-validator`
- `app/core/config.py` (cấu hình trên), `app/core/security.py` (hash mật khẩu, JWT, sinh/hash refresh token), `app/core/errors.py` (định dạng lỗi), `app/core/client_ip.py`, `app/core/csrf.py` (middleware Origin), `app/core/rate_limit.py`
- `app/models/user.py`, `app/models/user_session.py` + `alembic/versions/0010_auth_session_rotation.py`
- `app/services/auth.py` (đăng ký, đăng nhập, tạo/xoay/thu hồi session — một chỗ duy nhất tạo session để Giai đoạn 5 thêm giới hạn thiết bị)
- `app/api/deps.py` (`CurrentUser`, `require_admin`), `app/routers/auth.py`, `app/routers/me.py`, `app/schemas/auth.py`, `app/main.py` (gắn router `/api/v1`, middleware, handler lỗi)
- `app/cli.py` (`create-admin`)
- Test: `test_security.py`, `test_auth_api.py`, `test_auth_refresh.py`, `test_me_admin.py`, `test_csrf_rate_limit.py`; fixture client API trên DB tạm đã migrate trong `conftest.py`
- `.env.example`, `docker-compose.dev.yml` (biến dev), `docs/api.md` (mới, phần auth), CLAUDE.md, README

## Các bước (mỗi bước xong chạy được, test được, dừng cho bạn xem)

- [x] **Bước 1: Nền bảo mật + migration 0010** (`slowapi` thêm ở Bước 5 khi dùng đến; mã lỗi API là `ErrorCode` trong `app/core/errors.py`)
  - Việc: dependency mới; cấu hình; `security.py` (argon2id, JWT, refresh token + SHA-256); migration `0010` (`sessions.previous_refresh_token_hash`, `sessions.rotated_at`, `users.terms_accepted_at`, `users.vip_expires_at` + index một phần); `app/core/errors.py` + handler cho 422/HTTPException.
  - Hoàn thành khi: test đơn vị cho hash/verify/rehash, JWT hết hạn/sai chữ ký/sai loại bị từ chối, token sinh ra không trùng; app không khởi động ở `ENV=prod` nếu thiếu `JWT_SECRET`; migration lên/xuống sạch, `alembic check` sạch.
- [x] **Bước 2: Đăng ký, đăng nhập, đăng xuất** (cookie helper ở `app/api/cookies.py`; đăng xuất tìm phiên theo cookie refresh, thiếu thì theo id phiên trong access token)
  - Việc: `services/auth.py`, `routers/auth.py`, schema, đặt/xóa cookie; fixture client API trên DB tạm.
  - Hoàn thành khi: test đăng ký (thành công, trùng email khác hoa/thường, thiếu `accept_terms`, mật khẩu ngắn/dài, email sai định dạng); đăng nhập (đúng, sai mật khẩu, email không tồn tại cùng lỗi, tài khoản bị khóa); cookie có đủ cờ; đăng xuất thu hồi session; response không bao giờ chứa `password_hash`.
- [x] **Bước 3: Refresh có xoay vòng** (trong 60 giây ân hạn, token liền trước chỉ nhận access mới, không xoay tiếp, để phản hồi đến sau không ghi đè cookie bằng token cũ; user bị khóa/xóa thì thu hồi phiên)
  - Việc: `/auth/refresh` theo thiết kế trên.
  - Hoàn thành khi: test refresh thành công đổi cả hai cookie; token cũ dùng lại trong 60 giây vẫn được; dùng lại sau 60 giây thì thu hồi cả session; session hết hạn/đã thu hồi → 401 và xóa cookie; hạn session trượt thêm 30 ngày.
- [x] **Bước 4: `/me`, `CurrentUser`, `OptionalUser`, `require_admin`, VIP (`services/vip.py`), lệnh `create-admin` (ghi nhật ký)**
  - Việc: thêm `services/vip.py` với hai hàm duy nhất chạm vào VIP: `grant_vip(...)` (thêm subscription nối tiếp + cập nhật `users.vip_expires_at` trong cùng transaction) và `cancel_subscription(...)` (hủy + tính lại `vip_expires_at`); `is_vip(user)`. Giai đoạn 5 (thanh toán SePay, admin tặng VIP) gọi lại các hàm này.
  - Hoàn thành khi: test `/me` có/không cookie, access hết hạn, session bị thu hồi thì 401 ngay; user bị khóa thì 401; `OptionalUser` trả `None` cho khách thay vì lỗi; endpoint admin thử nghiệm trả 403 cho user thường, 200 cho admin; VIP đúng với các trường hợp chưa từng mua, còn hạn, vừa quá hạn một giây, mua lại sau khi quá hạn (tính từ lúc mua), gia hạn khi còn hạn (cộng nối tiếp), subscription bị hủy (hạn tính lại); `vip_expires_at` luôn khớp với `subscriptions`; lệnh `create-admin` tạo mới và nâng quyền user có sẵn.
  - Ghi chú khi làm: hủy gói thì các gói sau chưa bắt đầu được dời lên liền mạch (theo plan bổ sung schema), mỗi lần dời ghi `subscriptions.reschedule`. Hành động nhật ký: `subscriptions.grant_vip` (tặng, bắt buộc lý do), `subscriptions.create` (có payment), `subscriptions.cancel`, `users.create_admin` và `users.role_change` (đều bắt buộc lý do). Service tạo admin ở `app/services/admin_accounts.py`.
- [ ] **Bước 5: CSRF, rate limit, IP thật (dùng chung cho request_context)**
  - Hoàn thành khi: test POST có cookie mà `Origin` lạ → 403, đúng `Origin` → qua, request không cookie không bị chặn; login quá ngưỡng → 429 có `Retry-After`; `CF-Connecting-IP` chỉ được tin khi bật cấu hình.
- [ ] **Bước 6: Tài liệu và kiểm tra cuối**
  - Việc: `docs/api.md` (auth), `.env.example`, compose dev, CLAUDE.md, README; chạy thử bằng compose với curl (đăng ký → `/me` → refresh → đăng xuất); CI xanh.

## Rủi ro

- **Sai sót bảo mật khó thấy bằng mắt**: mỗi quy tắc trên đều có test; cuối plan chạy `/review` riêng cho phần auth trước khi coi là xong.
- **Cookie `Secure` trên `http://localhost`**: dev đặt `COOKIE_SECURE=false`; prod bắt buộc true (kiểm tra lúc khởi động).
- **Rate limit trong RAM** không chia sẻ giữa nhiều container: chấp nhận ở quy mô hiện tại, đã ghi điểm nâng cấp.
- **Kiểm tra session mỗi request** thêm một truy vấn: chỉ theo khóa chính, rất rẻ; có đường cache nếu cần.

## Quyết định

1. Đăng ký bằng email đã có: **báo rõ** "Email đã được sử dụng" (đã chốt).
2. Thời hạn đăng nhập **30 ngày, tự gia hạn khi còn dùng** (đã chốt).
3. Chưa xác thực email: được đăng nhập và xem tập miễn phí, **phải xác thực trước khi mua VIP** (đề xuất, áp dụng ở task xác thực email và Giai đoạn 5).
4. Tập miễn phí **cần đăng nhập** mới xem được (theo sơ đồ phân quyền: user, VIP, admin đều xem được; khách thì mời đăng nhập). Đề xuất giữ như vậy để tăng số tài khoản đăng ký.
5. Quyền VIP đặt ở **cấp tập** (`episodes.is_free`) (đã chốt).
6. VIP lưu bằng cột `users.vip_expires_at` (tóm tắt, tự hết hạn theo giờ) + `subscriptions` (nguồn sự thật, lịch sử); không dùng role `vip` hay cờ `is_vip` (đề xuất, xem mục "Phân quyền tổng thể").
7. Không tự động trừ tiền gia hạn. Quá hạn thì gói hết hiệu lực; người dùng tự thanh toán lại, gói mới tính từ lúc thanh toán (đã chốt).
