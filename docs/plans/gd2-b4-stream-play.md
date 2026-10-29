# Plan: Giai đoạn 2 / Cloudflare Stream và endpoint `play`

> Trạng thái: **đã duyệt (2026-10-29), đang làm**: xong Bước 1. Bốn câu hỏi mở chốt theo đề xuất. Làm trên branch `feat/stream`, tách từ `feat/catalog` (catalog chưa merge vào `main`).
> Liên quan: `plan.md` mục 1 (Luồng xem video có kiểm soát quyền), mục 5 (Play, Admin upload-url), Giai đoạn 2 task "Service Cloudflare Stream" và "Endpoint `play`"; ma trận phân quyền ở `docs/plans/gd2-b2-auth.md`. Bảng dùng: `episodes` (`stream_video_id`, `stream_status`, `duration_sec`, `thumbnail_url`), `series_stats`.

## Vì sao làm phần này trước xác thực email

- `play` là lõi sản phẩm: frontend trang xem phim (Giai đoạn 3), upload video ở admin (Giai đoạn 4) và kiểm thử "chưa VIP bị chặn" (Giai đoạn 8) đều chờ nó.
- Làm và test được trọn vẹn **khi chưa có tài khoản Cloudflare**: ký token cục bộ bằng khóa RSA sinh trong test, giả lập webhook bằng HMAC, giả lập API Cloudflare bằng `httpx.MockTransport`.
- Xác thực email cần domain + SPF/DKIM (Giai đoạn 0 chưa xong) để thử thật, và chỉ chặn việc mua VIP (Giai đoạn 5), nên làm sau vẫn kịp.

## Mục tiêu và phạm vi

- **Mục tiêu**:
  1. `GET /api/v1/episodes/{id}/play`: kiểm tra quyền theo ma trận đã chốt rồi trả URL phát có signed token ngắn hạn. Đây là **chỗ duy nhất** kiểm tra quyền xem.
  2. Admin xin URL upload thẳng lên Stream cho một tập (backend tạo video ở Cloudflare, trình duyệt upload trực tiếp, file không đi qua VPS).
  3. Webhook Stream báo chuyển mã xong/lỗi → cập nhật `stream_status`, `duration_sec`, `thumbnail_url`. Có thêm cách đồng bộ tay khi webhook bị trượt.
  4. Lệnh CLI cài đặt một lần: tạo signing key, đăng ký webhook.
- **Không làm**:
  - Giao diện upload (tus-js-client), trang theo dõi chuyển mã, bật/tắt xuất bản: Giai đoạn 4.
  - Xóa video cũ trên Cloudflare khi thay video: Giai đoạn 4 (ghi lại id cũ trong `audit_logs` để dọn sau).
  - Lịch sử xem / nhớ tiến độ: task "Watch history" riêng.
  - Giới hạn số thiết bị: Giai đoạn 5.

## Kiến thức về Cloudflare Stream dùng trong plan

Đã đối chiếu tài liệu Cloudflare ngày 2026-10-29 (Bước 1). Điểm cần nhớ khi làm các bước sau:

- `exp` của token **không được quá 24 giờ** kể từ lúc ký: hạn token chặn trần 24 giờ.
- `nbf` có trong danh sách hạn chế hỗ trợ nhưng ví dụ không dùng; ta đặt `nbf` lùi 60 giây để chịu lệch đồng hồ.
- Key tạo qua `POST /stream/keys` trả `id`, `pem`, `jwk`; `pem` và `jwk` mã base64, chỉ hiện một lần.
- `requireSignedURLs` đặt theo từng video, không có mặc định cho cả tài khoản.
- tus: tài liệu chỉ nói URL upload nằm ở header `Location`; header `stream-media-id` (id video) **chưa xác nhận được**. Bước 3 lấy id từ `stream-media-id`, thiếu thì tách từ phần cuối của `Location`, rồi ghi lại cách nào đúng khi thử thật. `Upload-Metadata`: khóa và giá trị base64 cách nhau bằng dấu cách, các cặp nối bằng dấu phẩy; `requiresignedurls` là khóa không có giá trị; `name` không có trong tài liệu nên không gửi (đặt tên bằng `meta` qua API sửa video nếu cần, Giai đoạn 4).
- Webhook: tài liệu không nêu khoảng lệch giờ cho phép, ta tự chọn 5 phút. Tên trường lỗi lúc thì `errorReasonCode`, lúc thì `errReasonCode`: đọc cả hai.

Chi tiết gốc bên dưới (đã sửa theo các điểm trên):

- **Signed token**: JWT RS256, header `kid` = id signing key; claim `sub` = id video, `kid`, `exp`, `nbf`. Ký cục bộ bằng khóa riêng (Cloudflare trả về một lần khi tạo key qua `POST /accounts/{account}/stream/keys`, dạng PEM mã base64). URL phát: `https://customer-<code>.cloudflarestream.com/<token>/manifest/video.m3u8` (HLS), `.../manifest/video.mpd` (DASH), `.../iframe` (Stream player).
- Video phải có `requireSignedURLs: true`, và đặt `allowedOrigins` = domain site.
- **Upload trực tiếp**: phim bộ thường > 200 MB nên dùng **tus**: backend gọi `POST /accounts/{account}/stream?direct_user=true` (header `Tus-Resumable`, `Upload-Length`, `Upload-Metadata` có `requiresignedurls`, `maxDurationSeconds`) → nhận URL upload ở header `Location` (id video: xem ghi chú tus ở trên). Trình duyệt dùng tus-js-client với `uploadUrl` đó.
- **Webhook**: mỗi tài khoản một URL (`PUT /accounts/{account}/stream/webhook`, trả `secret`). Request có header `Webhook-Signature: time=<unix>,sig1=<hex>`, `sig1` = HMAC-SHA256(secret, `"<time>.<body thô>"`). Thân là đối tượng video: `uid`, `readyToStream`, `status.state` (`ready`/`error`, kèm `errorReasonCode`), `duration`, `thumbnail`.

## Thiết kế

### Cấu hình (`core/config.py`, `.env.example`)

| Biến | Ý nghĩa |
|---|---|
| `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN` | Gọi API Cloudflare (chỉ dùng cho upload, đồng bộ, lệnh cài đặt; **không** gọi khi xem) |
| `CF_STREAM_CUSTOMER_CODE` | Phần `customer-<code>` của domain phát |
| `CF_STREAM_SIGNING_KEY_ID`, `CF_STREAM_SIGNING_KEY_PEM` | Ký token (PEM mã base64, đúng dạng Cloudflare trả) |
| `CF_STREAM_WEBHOOK_SECRET` | Xác thực webhook |
| `STREAM_TOKEN_TTL_MINUTES` | Mặc định 180 (plan.md: 2–4 giờ) |

- `ENV=prod` thiếu signing key/customer code/webhook secret → không khởi động (giống `JWT_SECRET`). Dev thiếu thì `play` trả 503 `stream_unavailable`, phần còn lại vẫn chạy.
- Khóa PEM sai định dạng → báo lỗi ngay lúc khởi động, không đợi lượt xem đầu tiên.
- Thêm dependency: `cryptography` (PyJWT cần cho RS256), chuyển `httpx` từ nhóm dev sang dependency chính.

### `GET /api/v1/episodes/{id}/play`

Thứ tự kiểm tra (theo ma trận ở `docs/plans/gd2-b2-auth.md`, khớp `docs/api.md`):

1. Tập không tồn tại / đã xóa / chưa xuất bản / series chưa xuất bản hoặc đã xóa → **404** `not_found` (không tiết lộ tập có tồn tại). Admin được phát tập chưa xuất bản nếu video đã `ready` (xem trước), giống catalog.
2. Khách → **401** `not_authenticated` (cả tập miễn phí: đã chốt để tăng đăng ký).
3. Tập VIP mà user không VIP (`is_vip(user)`) → **403** `vip_required`. Admin xem được mọi tập.
4. Video chưa `ready` (chỉ gặp khi admin xem trước) → **409** `video_not_ready`.
5. Chưa cấu hình Stream → **503** `stream_unavailable`.

Phản hồi 200 (header `Cache-Control: no-store`):

```json
{
  "episode_id": 12,
  "hls_url": "https://customer-xxx.cloudflarestream.com/<token>/manifest/video.m3u8",
  "dash_url": "https://customer-xxx.cloudflarestream.com/<token>/manifest/video.mpd",
  "iframe_url": "https://customer-xxx.cloudflarestream.com/<token>/iframe",
  "expires_at": "2026-10-29T15:00:00Z"
}
```

- Hạn token = max(`STREAM_TOKEN_TTL_MINUTES`, thời lượng tập + 30 phút), chặn trần 24 giờ (giới hạn của Cloudflare), vì segment cũng mang token: hết hạn giữa chừng là đứt phim. Frontend gọi lại `play` khi hết hạn (ghi vào `docs/api.md`).
- Không trả `stream_video_id` riêng (nó vẫn nằm trong `sub` của token, chấp nhận được vì video bắt buộc signed URL).
- **Rate limit** theo user: 60 lần/phút (chống script xin token hàng loạt).
- **Đếm lượt xem**: mỗi lần `play` thành công cộng `series_stats.view_count` (upsert), chống đếm trùng bằng bộ đếm RAM sẵn có: mỗi (user, tập) tối đa 1 lượt mỗi 6 giờ. Admin không được đếm. Chấp nhận mất bộ nhớ chống trùng khi khởi động lại (con số chỉ dùng để xếp "phim hot").

### Upload (admin) `POST /api/v1/admin/episodes/{id}/upload`

- Body: `{ "size_bytes": 734003200, "filename": "tap-01.mp4" }` (tus bắt buộc biết kích thước). Giới hạn kích thước tối đa cấu hình được (mặc định 10 GB).
- Tập đang xuất bản → **409** (thay video sẽ vi phạm CHECK `publish_requires_ready`; admin phải gỡ xuất bản trước).
- Gọi Cloudflare tạo video (tus, `requiresignedurls`, `maxDurationSeconds` 4 giờ). Cloudflare lỗi/hết thời gian → **502** `stream_provider_error`, DB không đổi.
- Lưu `stream_video_id` mới, `stream_status = uploading`, xóa `duration_sec`/`thumbnail_url` cũ; ghi `audit_logs` `episodes.upload_start` (trước/sau có id video cũ để dọn sau). Trả `{ "upload_url": "...", "video_id": "..." }`.

### Webhook `POST /api/v1/webhooks/stream`

- Không cần đăng nhập; đi qua CSRF được vì không có Origin và cookie (đã thiết kế sẵn trong `app/api/csrf.py`).
- Xác thực `Webhook-Signature` trên **thân thô**: so sánh hằng thời gian, lệch giờ quá 5 phút → 401 (chống phát lại). Thân quá 64 KB → 413.
- Tìm tập theo `stream_video_id` (kể cả tập đã xóa mềm). Không thấy (video đã bị thay hoặc của môi trường khác) → 200, ghi log, không làm gì.
- `ready` → `stream_status = ready`, `duration_sec` (làm tròn), `thumbnail_url` (chỉ khi đang trống). `error` → `stream_status = error`. Trạng thái giống hiện tại → 200 không làm gì (Cloudflare gửi lại vẫn an toàn).
- Ghi `audit_logs` `episodes.stream_update` với `Actor.webhook()`, cùng transaction. Trả 2xx nhanh.

### Đồng bộ tay `POST /api/v1/admin/episodes/{id}/stream-sync`

- Webhook có thể trượt (VPS sập, sai secret). Admin bấm nút → backend gọi `GET /stream/{video_id}` rồi áp **cùng hàm** xử lý trạng thái như webhook. Audit `episodes.stream_sync` với `Actor.admin`.

### Mã lỗi mới (`ErrorCode`)

`video_not_ready`, `stream_unavailable`, `stream_provider_error`, `invalid_signature`.

### Lệnh CLI (cài đặt một lần, chạy tay)

- `uv run python -m app.cli stream-create-signing-key`: tạo key, in `CF_STREAM_SIGNING_KEY_ID` và `CF_STREAM_SIGNING_KEY_PEM` để dán vào `.env` (không lưu vào file).
- `uv run python -m app.cli stream-set-webhook <url>`: đăng ký webhook, in `CF_STREAM_WEBHOOK_SECRET`.

## File bị ảnh hưởng

- `pyproject.toml`, `uv.lock` (`cryptography`, `httpx` thành dependency chính)
- `app/core/config.py`, `.env.example`, `app/core/errors.py`, `app/core/rate_limit.py` (ngưỡng mới)
- Mới: `app/services/stream.py` (ký token, gọi API Cloudflare, áp trạng thái video), `app/services/play.py` (kiểm tra quyền, đếm lượt xem), `app/routers/play.py`, `app/routers/admin_stream.py`, `app/routers/webhooks.py`, `app/schemas/stream.py`
- `app/main.py` (gắn router), `app/cli.py` (hai lệnh cài đặt)
- Test mới: `test_stream_signing.py`, `test_play_api.py`, `test_stream_upload_api.py`, `test_stream_webhook.py`
- `docs/api.md` (Play, Upload, Webhook), `plan.md`, `CLAUDE.md`, README (lệnh cài đặt Stream)

**Không cần migration**: các cột đã có từ `0003`.

## Các bước

- [x] **Bước 1: Cấu hình và ký token cục bộ** (xong 2026-10-29: tài liệu Cloudflare khớp, đã ghi các điểm lệch ở mục "Kiến thức"; khóa nhận cả dạng base64 Cloudflare trả lẫn PEM thô, phải là RSA >= 2048 bit; `nbf` lùi 60 giây; helper khóa test ở `app/tests/stream_keys.py`)
  - Việc: đối chiếu tài liệu Cloudflare hiện hành (định dạng token, URL phát, tus, chữ ký webhook), sửa plan nếu lệch; thêm dependency, biến cấu hình + kiểm tra ở prod; `services/stream.py` phần ký token và dựng URL phát.
  - Hoàn thành khi: test ký bằng khóa RSA sinh trong test, giải mã lại bằng khóa công khai ra đúng `sub`, `kid`, `exp`, `nbf`; hạn token tính đúng cả khi tập dài hơn TTL; khóa PEM hỏng báo lỗi lúc tạo Settings; `ENV=prod` thiếu biến Stream không khởi động; dev thiếu biến vẫn khởi động.
- [ ] **Bước 2: Endpoint `play`**
  - Việc: `services/play.py`, `routers/play.py`, mã lỗi, rate limit, đếm lượt xem chống trùng.
  - Hoàn thành khi: test đủ ma trận: khách 401 (cả tập free); user thường xem tập free, tập VIP 403 `vip_required`; VIP còn hạn xem được, VIP vừa hết hạn 403; admin xem mọi tập và xem trước tập chưa xuất bản; tập/series nháp hoặc đã xóa 404 với người thường; video chưa ready 409; thiếu cấu hình 503; có `Cache-Control: no-store`; gọi 2 lần liền chỉ cộng 1 lượt xem, admin không cộng; vượt 60 lần/phút → 429.
- [ ] **Bước 3: Upload trực tiếp cho admin**
  - Việc: client Cloudflare (httpx async, timeout ngắn), `POST /admin/episodes/{id}/upload`, audit.
  - Hoàn thành khi: test với `httpx.MockTransport`: gửi đúng header tus + metadata `requiresignedurls`; lưu id video và trạng thái `uploading`; có dòng `audit_logs` chứa id video cũ; tập đang xuất bản 409; user thường 403, khách 401; Cloudflare trả lỗi hoặc timeout → 502 và DB không đổi; thiếu CSRF Origin → 403.
- [ ] **Bước 4: Webhook và đồng bộ tay**
  - Việc: `POST /webhooks/stream`, `POST /admin/episodes/{id}/stream-sync`, hàm áp trạng thái dùng chung.
  - Hoàn thành khi: test chữ ký đúng → tập `ready` có `duration_sec`, `thumbnail_url`; sai chữ ký, thiếu header, lệch giờ > 5 phút → 401 và DB không đổi; gửi lại cùng sự kiện không ghi thêm audit; id video lạ → 200 không đổi gì; `error` → `stream_status = error`; sau `ready` admin xuất bản được tập (CHECK DB cho qua); đồng bộ tay cho cùng kết quả với webhook.
- [ ] **Bước 5: Lệnh cài đặt, tài liệu, khép plan**
  - Việc: hai lệnh CLI, `docs/api.md`, README, `CLAUDE.md` (quy ước: quyền xem chỉ ở `play`, không gọi API Cloudflare khi xem), đánh dấu `plan.md`.
  - Hoàn thành khi: test lệnh CLI với API giả in đúng biến cần dán; ruff, format, pytest xanh. Nếu đã có tài khoản Cloudflare: thử thật upload một video ngắn, nhận webhook (qua tunnel), phát bằng URL từ `play`, và xác nhận URL không token / token hết hạn bị từ chối.

## Rủi ro

- Thông tin API Cloudflare ở trên có thể đã đổi: đối chiếu ở Bước 1, test giả lập chỉ đúng khi giả lập đúng thực tế. Thử thật ở Bước 5 hoặc khi có tài khoản.
- Token có hạn vài giờ: người có quyền vẫn chia sẻ được link trong thời gian đó (đã nêu ở plan.md, không phải DRM). Giới hạn thiết bị ở Giai đoạn 5 giảm bớt.
- Mỗi tài khoản Cloudflare chỉ một URL webhook: dev và prod dùng chung tài khoản sẽ giành nhau. Đề xuất dev dùng đồng bộ tay, không đăng ký webhook.
- Video cũ bị thay vẫn tính phí lưu trữ cho đến khi dọn (Giai đoạn 4).
- Bộ chống đếm trùng nằm trong RAM: nhiều container thì đếm dư (cùng ghi chú Redis ở Giai đoạn 6).

## Câu hỏi đã chốt (2026-10-29, theo đề xuất)

1. Hạn token mặc định **3 giờ** (kéo dài theo thời lượng tập)?
2. Đếm lượt xem **mỗi (user, tập) 1 lần / 6 giờ**, admin không tính?
3. Thay video của tập đang xuất bản: **bắt gỡ xuất bản trước** (409) thay vì cho thay nóng?
4. Admin xem trước được tập chưa xuất bản qua `play` (đề xuất: có, giống catalog)?
