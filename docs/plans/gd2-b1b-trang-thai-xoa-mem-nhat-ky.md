# Plan: Bổ sung schema — trạng thái rõ ràng, xóa mềm, nhật ký thao tác (audit log), lý do thanh toán thất bại

> Trạng thái: **xong (2026-10-27)**, migration `0007`–`0009`. Làm **trước** plan auth (`gd2-b2-auth.md`), vì auth dựa vào xóa mềm (user bị xóa không đăng nhập được) và nhật ký (đổi quyền admin phải có dấu vết). Migration của auth vì vậy đổi thành `0010`.
> Yêu cầu gốc (2026-10-27): thêm `failure_reason` cho payments; định nghĩa rõ trạng thái subscriptions và kiểm tra VIP theo cả trạng thái lẫn thời hạn; xóa phải là xóa mềm, DB vẫn lưu, có nhật ký rõ ràng để truy vết.

## Mục tiêu và phạm vi

- Không thao tác nào trên web (kể cả admin bấm nhầm) làm mất dữ liệu thật; mọi thứ khôi phục được.
- Mọi thay đổi quan trọng đều có dấu vết: ai, lúc nào, đổi gì (trước/sau), lý do, từ IP nào.
- Trạng thái đơn hàng và gói VIP chỉ đi theo các bước hợp lệ, chặn ngay ở tầng DB.

**Không làm** ở plan này: giao diện "Thùng rác" và màn hình xem nhật ký (Giai đoạn 4, admin); quy trình xóa tài khoản theo yêu cầu của người dùng (ẩn danh hóa dữ liệu cá nhân, xem mục "Xóa user" bên dưới) làm cùng trang tài khoản.

## 1. Trạng thái: định nghĩa rõ, chuyển trạng thái có kiểm soát

### Trong code: dùng `StrEnum` thay cho chuỗi rời rạc

`SubscriptionStatus.ACTIVE`, `PaymentStatus.PAID`, `UserRole.ADMIN`... (tên viết hoa trong code, giá trị lưu DB vẫn viết thường như hiện tại: `active`, `paid`, `admin`). CHECK constraint sinh ra từ enum, nên code và DB không thể lệch. Gõ sai tên trạng thái thì lỗi ngay khi chạy test, không lọt vào DB.

### Sơ đồ chuyển trạng thái (chặn bằng trigger trong DB)

**Subscriptions**

| Từ | Sang | Khi nào |
|---|---|---|
| `active` | `expired` | Job hằng ngày, khi `expires_at` đã qua |
| `active` | `cancelled` | Admin hủy / hoàn tiền (bắt buộc ghi lý do) |
| `expired`, `cancelled` | (không đi đâu nữa) | Trạng thái cuối |

**Payments**

| Từ | Sang | Khi nào |
|---|---|---|
| `pending` | `paid` | Webhook SePay khớp mã đơn và đủ tiền |
| `pending` | `failed` | Lỗi xác định được (ví dụ chuyển thiếu tiền), kèm lý do |
| `pending` | `expired` | Quá hạn đơn mà không nhận được tiền |
| `paid` | `refunded` | Admin hoàn tiền (bắt buộc ghi lý do) |
| `failed`, `expired`, `refunded` | (không đi đâu nữa) | Trạng thái cuối |

Trigger `BEFORE UPDATE` từ chối mọi chuyển trạng thái ngoài bảng trên, kể cả khi ai đó sửa tay bằng SQL. Sau khi đơn rời khỏi `pending`, các trường tiền (`user_id`, `plan_id`, `amount_vnd`, giao dịch đã khớp) không đổi được nữa; subscription cũng không đổi được `user_id`, `plan_id`, `payment_id`.

### Admin không thể tự đánh dấu "đã thanh toán"

Bổ sung 2026-10-27: đơn chỉ được ở trạng thái `paid` khi **gắn với một giao dịch ngân hàng thật** đã được ghi nhận từ SePay:
- Thêm `payments.paid_event_id` → `payment_events` (unique: một giao dịch ngân hàng chỉ trả cho một đơn).
- CHECK ở DB: `paid`/`refunded` bắt buộc có `paid_event_id`. Không có giao dịch thật thì DB từ chối, dù là admin hay ai sửa tay.
- `payment_events` chỉ do webhook SePay hoặc job đối soát (gọi API SePay) ghi; trang admin không có chức năng tạo giao dịch.
- Admin xử lý ca bất thường (ví dụ người dùng ghi sai nội dung chuyển khoản) bằng cách **gắn một giao dịch có thật nhưng chưa khớp** vào đơn, bắt buộc ghi lý do và có nhật ký.
- Muốn cho ai đó VIP mà không có tiền (bồi thường, khuyến mãi) thì dùng chức năng **"tặng VIP"**: tạo subscription không có payment (`payment_id` NULL), bắt buộc ghi lý do, có nhật ký. Không giả làm đơn hàng, nên báo cáo doanh thu luôn chỉ gồm tiền thật. Ngoại lệ đã ghi ở plan thanh toán: tiền về **sau** khi đơn đã `expired` mà đúng mã và đủ tiền thì không "hồi sinh" đơn cũ, mà tạo đơn mới `paid` liên kết với giao dịch đó (giữ nguyên tắc trạng thái cuối không đổi).

### Kiểm tra VIP: cả trạng thái lẫn thời hạn

- `users.vip_expires_at` (thêm ở migration auth) = hạn cuối của các subscription **`active`**. Subscription `cancelled` không bao giờ được tính.
- Mỗi lần một subscription đổi trạng thái hoặc được thêm, `services/vip.py` tính lại `vip_expires_at` **trong cùng transaction**. Kiểm tra quyền xem = `vip_expires_at > now()`, nên một điều kiện đã bao cả trạng thái lẫn thời hạn.
- Trạng thái `expired` do job ghi chỉ là sổ sách; quyền xem đã hết đúng giây hết hạn, không phụ thuộc job chạy lúc nào.
- **Hủy một gói khi đang có gói nối tiếp phía sau**: các gói chưa bắt đầu phía sau được dời lên cho liền mạch (người dùng không mất ngày đã trả tiền, cũng không có "khoảng trống" khiến quyền VIP bị sai). Việc dời được ghi nhật ký.

### Lý do thanh toán thất bại

Thêm vào `payments`:
- `failure_code` (chuỗi ngắn, giá trị cố định trong enum để lọc và thống kê): `amount_mismatch`, `expired_unpaid`, `duplicate_transfer`, `provider_error`, `refunded_by_admin`, `other`.
- `failure_detail` (chữ tự do, cho người xử lý đọc).
- CHECK: chỉ được có lý do khi trạng thái là `failed`, `expired` hoặc `refunded`; `failed` thì bắt buộc có `failure_code`.

Không bắt buộc cho MVP như bạn nói, nhưng chỉ là 2 cột, thêm ngay bây giờ rẻ hơn thêm sau khi đã có dữ liệu thật.

## 2. Xóa mềm

### Bảng nào xóa mềm, bảng nào không bao giờ xóa

| Bảng | Cách "xóa" |
|---|---|
| `users`, `series`, `episodes`, `genres`, `vip_plans` | **Xóa mềm**: thêm `deleted_at` và `deleted_by_id` (admin đã xóa). Khôi phục = đặt lại `NULL`. |
| `payments`, `subscriptions`, `payment_events` | **Không bao giờ xóa**, kể cả xóa mềm. Chỉ đổi trạng thái theo bảng ở mục 1. |
| `audit_logs` | Không bao giờ xóa, không bao giờ sửa (chỉ thêm). |
| `sessions`, `email_tokens`, `watch_history`, `favorites`, `series_genres`, `series_stats` | Dữ liệu phụ thuộc: không xóa khi "cha" bị xóa mềm, chỉ bị ẩn theo. Khôi phục "cha" là mọi thứ quay lại nguyên vẹn. |

### Hành vi khi xóa từng loại

- **Xóa user** (admin khóa/xóa tài khoản): user không đăng nhập được (lỗi như tài khoản bị khóa), mọi phiên đăng nhập bị thu hồi ngay (đặt `revoked_at`, không xóa dòng). Đơn hàng, gói VIP, lịch sử xem giữ nguyên. Email vẫn giữ chỗ (không ai đăng ký trùng được) để khôi phục luôn thành công.
  - Riêng **người dùng yêu cầu xóa dữ liệu cá nhân** (quyền của chủ thể dữ liệu theo quy định bảo vệ dữ liệu cá nhân; cần xác minh lại với luật sư như `plan.md` mục 2.5): không xóa dòng vì còn giao dịch phải đối soát, mà **ẩn danh hóa** email, tên, ảnh, mật khẩu. Việc này có ghi nhật ký. Làm ở task trang tài khoản.
- **Xóa series**: ẩn khỏi danh sách, tìm kiếm, trang chi tiết (trả 404); các tập của nó ẩn theo; lịch sử xem và yêu thích giữ nguyên nhưng không hiện. `slug` vẫn giữ chỗ để khôi phục không bị trùng.
- **Xóa tập**: ẩn tập đó (404), số tập vẫn giữ chỗ. Muốn thay video lỗi thì thay video trên chính tập đó (Giai đoạn 4), không xóa rồi tạo lại.
- **Xóa thể loại**: ẩn thể loại; liên kết phim–thể loại giữ nguyên để khôi phục là đủ như cũ.
- **Xóa gói VIP**: ẩn khỏi trang mua; đơn hàng và gói VIP đã bán theo gói đó không bị ảnh hưởng.

### Tự động lọc dữ liệu đã xóa (chống quên)

Rủi ro lớn nhất của xóa mềm là một truy vấn nào đó quên thêm `WHERE deleted_at IS NULL`. Cách chặn:
- Đăng ký một bộ lọc chung của SQLAlchemy: **mọi truy vấn ORM tự loại dòng đã xóa**, trừ khi ghi rõ `include_deleted=True` (chỉ dùng trong admin/khôi phục).
- Quy ước: truy vấn phục vụ người dùng không viết SQL tay (SQL tay không được lọc tự động).
- Test riêng: series/tập/thể loại/gói đã xóa không xuất hiện ở danh sách, tìm kiếm, theo slug, theo id.

### Chặn xóa thật ở tầng DB

Trigger `BEFORE DELETE` trên `users`, `series`, `episodes`, `genres`, `vip_plans`, `payments`, `subscriptions`, `payment_events`, `audit_logs`: từ chối mọi lệnh `DELETE`, kể cả gõ tay trong công cụ quản trị DB. Muốn xóa thật (ví dụ dọn dữ liệu test, hiếm khi cần) phải bật cờ bảo trì trong đúng phiên đó (`SET LOCAL vdrama.allow_hard_delete = 'on'`), và việc này chỉ làm bằng script bảo trì có ghi nhật ký. Các khóa ngoại CASCADE/RESTRICT hiện có giữ nguyên, chỉ còn tác dụng trong trường hợp bảo trì này.

Các unique (`email`, `slug`, số tập) giữ nguyên trên toàn bộ dòng kể cả dòng đã xóa: đổi lại là không tạo trùng được, nhưng khôi phục luôn thành công. Giao diện admin sẽ báo "slug này đang nằm trong thùng rác, khôi phục?".

## 3. Nhật ký thao tác (`audit_logs`)

### Bảng

| Cột | Ý nghĩa |
|---|---|
| `id` | bigint |
| `occurred_at` | thời điểm (UTC) |
| `actor_type` | `admin`, `user`, `system` (job), `webhook` |
| `actor_user_id` | ai làm (NULL nếu là job/webhook) |
| `action` | tên hành động cố định, ví dụ `series.delete`, `series.restore`, `episode.publish`, `user.role_change`, `subscription.cancel`, `payment.refund`, `payment.mark_paid` |
| `entity_type`, `entity_id` | đối tượng bị tác động |
| `subject_user_id` | user bị ảnh hưởng (nếu có), ví dụ hủy gói VIP thì đối tượng là subscription nhưng user bị ảnh hưởng là chủ gói. Có index để xem "mọi thao tác liên quan tới user X" |
| `changes` | JSON các trường đã đổi: `{"field": [trước, sau]}`. Không bao giờ chứa mật khẩu, token, hash (có danh sách che sẵn) |
| `reason` | lý do do người làm nhập; **bắt buộc** với xóa, khôi phục, đổi quyền, hủy gói, hoàn tiền |
| `ip`, `user_agent`, `request_id` | truy vết request (request_id cũng gắn vào log ứng dụng và Sentry để nối các nguồn với nhau) |

Index: theo đối tượng `(entity_type, entity_id, occurred_at DESC)` để xem lịch sử một phim/user/đơn; theo người làm `(actor_user_id, occurred_at DESC)`; theo thời gian `occurred_at`.

Một bảng chung thay cho `admin_audit_logs` riêng: các cột `admin_user_id`, `action`, `target_user_id`, `details`, `created_at` trong gợi ý tương ứng với `actor_user_id`, `action`, `subject_user_id`, `changes` + `reason`, `occurred_at`. Bảng chung ghi được cả thay đổi do webhook và job (đơn được đánh dấu `paid`, gói hết hạn), nên khi đối soát tiền chỉ cần xem một nơi. Lọc riêng thao tác admin bằng `actor_type = 'admin'`.

### Quy tắc

- **Chỉ thêm, không sửa, không xóa**: trigger chặn `UPDATE`/`DELETE` trên `audit_logs`.
- **Ghi trong cùng transaction với thay đổi**: không thể có thay đổi mà thiếu nhật ký, cũng không có nhật ký cho thay đổi đã bị hủy.
- Một hàm duy nhất ghi nhật ký (`services/audit.py`), tự tính `changes` từ trạng thái trước/sau của đối tượng và tự che trường nhạy cảm.
- **Ghi những gì**: mọi thao tác ghi của admin; thay đổi trạng thái tiền (đơn `paid` qua webhook, hoàn tiền, hủy gói, job đánh dấu hết hạn); thay đổi quyền và trạng thái tài khoản (khóa, xóa, khôi phục, nâng admin, kể cả qua lệnh `create-admin`). Không ghi các thao tác thường của người dùng như xem phim, lưu tiến độ (quá nhiều, không cần truy vết).
- Lưu giữ vĩnh viễn (dung lượng nhỏ). Khi rất lớn (hàng chục triệu dòng) thì chia partition theo tháng.

## Migration (tách theo nội dung)

- `0007`: enum trạng thái, trigger chuyển trạng thái cho `payments` và `subscriptions`, `payments.failure_code` / `failure_detail`
- `0008`: `deleted_at` / `deleted_by_id` cho 5 bảng, trigger chặn xóa thật
- `0009`: bảng `audit_logs` + trigger chỉ-thêm
- `0010`: phần của auth (`sessions.previous_refresh_token_hash`, `sessions.rotated_at`, `users.terms_accepted_at`, `users.vip_expires_at`)

## File bị ảnh hưởng

- `app/models/enums.py` (mới), `app/models/*.py` (dùng enum, cột mới), `app/models/mixins.py` (`SoftDeleteMixin`), `app/models/audit.py` (mới)
- `app/core/db.py` (bộ lọc xóa mềm tự động), `app/core/request_id.py` (middleware request_id)
- `app/services/audit.py`, `app/services/soft_delete.py` (xóa/khôi phục kèm nhật ký)
- `alembic/versions/0007_…`, `0008_…`, `0009_…`
- Test: `test_status_transitions.py`, `test_soft_delete.py`, `test_audit_log.py`; sửa các test cascade/restrict hiện có (giờ phải bật cờ bảo trì mới xóa thật được)
- `plan.md` mục 4, CLAUDE.md (quy ước: dùng enum; không viết SQL tay cho truy vấn người dùng; mọi thao tác admin đi qua service có nhật ký)

## Các bước (mỗi bước xong chạy được, test được, dừng cho bạn xem)

- [x] **Bước 1: Trạng thái, lý do thất bại, chặn "paid" giả (migration 0007)** (xong; enum ở `app/models/enums.py`; trigger `payments_guard`, `subscriptions_guard`; test duyệt mọi cặp trạng thái và đối chiếu CHECK trong DB với enum)
  - Hoàn thành khi: test mọi chuyển trạng thái hợp lệ đi qua, mọi chuyển không hợp lệ (ví dụ `expired → active`, `paid → pending`, `cancelled → active`) bị DB từ chối; trường tiền không sửa được sau khi rời `pending`; `paid` không có giao dịch thật bị từ chối, một giao dịch không trả được hai đơn; CHECK lý do thất bại đúng; code không còn chuỗi trạng thái viết tay; `alembic check` sạch.
- [x] **Bước 2: Xóa mềm (migration 0008)** (xong; `SoftDeleteMixin` + bộ lọc tự động `app/models/soft_delete.py`; service `app/services/soft_delete.py`; trigger `block_hard_delete` chặn cả `DELETE` lẫn `TRUNCATE` trên 8 bảng; test cũ xóa thật qua helper `hard_delete` có cờ bảo trì)
  - Hoàn thành khi: test xóa/khôi phục từng loại; dòng đã xóa không hiện ở mọi truy vấn ORM thường nhưng hiện khi `include_deleted=True`; `DELETE` thật bị từ chối trên 9 bảng và chỉ chạy được khi bật cờ bảo trì; xóa user thu hồi mọi phiên; các test cũ được sửa và vẫn pass.
- [x] **Bước 3: Nhật ký thao tác (migration 0009)** (xong; model `app/models/audit.py`, service `app/services/audit.py` (`record`, `require_reason`, `load_snapshot`, che trường nhạy cảm, bỏ qua `updated_at`/`search_text`), middleware `app/core/request_context.py` (header `X-Request-ID`); xóa/khôi phục giờ bắt buộc `actor` + `reason` và tự ghi nhật ký; DB chặn `UPDATE` nhật ký kể cả khi bảo trì, chặn `DELETE`/`TRUNCATE` như 0008)
  - Hoàn thành khi: test xóa/khôi phục/đổi trạng thái tạo đúng một dòng nhật ký với `changes` trước/sau; trường nhạy cảm bị che; thiếu `reason` ở thao tác bắt buộc thì bị từ chối; transaction bị hủy thì không còn dòng nhật ký; `UPDATE`/`DELETE` trên `audit_logs` bị DB từ chối; request_id có trong nhật ký và header phản hồi.
- [x] **Bước 4: Tài liệu** (xong) — `plan.md` mục 4, CLAUDE.md, cập nhật plan auth; CI xanh.

## Rủi ro

- **Quên lọc dòng đã xóa** → có bộ lọc tự động và test riêng.
- **Trigger làm khó thao tác bảo trì** → có cờ bảo trì rõ ràng, chỉ dùng qua script.
- **Unique giữ chỗ cho dòng đã xóa** → chấp nhận để khôi phục luôn thành công; giao diện admin gợi ý khôi phục.
- **Nhật ký lộ dữ liệu nhạy cảm** → danh sách trường che sẵn, có test.

## Quyết định (đã chốt 2026-10-27)

1. Thao tác xóa, khôi phục, đổi quyền, hủy gói, hoàn tiền, tặng VIP, gắn giao dịch thủ công **bắt buộc nhập lý do**.
2. Unique (email, slug, số tập) **vẫn giữ chỗ** khi đã xóa mềm, để khôi phục luôn thành công.
3. Người dùng yêu cầu xóa dữ liệu cá nhân thì **ẩn danh hóa** thay vì xóa dòng (giữ giao dịch để đối soát); làm ở task trang tài khoản.
4. VIP không cấp qua `role`; VIP xác định từ `subscriptions` (tóm tắt ở `users.vip_expires_at`).
5. Admin **không thể** chuyển đơn sang `paid` nếu không gắn giao dịch ngân hàng thật (`paid_event_id`, chặn ở DB). Cho VIP không qua thanh toán thì dùng "tặng VIP".
6. Một bảng nhật ký chung `audit_logs` (có `subject_user_id`) thay cho `admin_audit_logs` riêng.
