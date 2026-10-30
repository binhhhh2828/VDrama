# Plan: Khách vãng lai xem phim, mua VIP không cần đăng nhập, sau đó nhận tài khoản

> Trạng thái: **tạm hoãn** (2026-10-30): sếp đồng ý web không cần khách vãng lai mua VIP; xem lại khi làm app. Giữ plan để dùng lại.
> Liên quan: `plan.md` Giai đoạn 5 (thanh toán), `docs/plans/gd2-b2-auth.md` (auth), `docs/plans/gd2-b4-stream-play.md` (play).

## Mục tiêu và phạm vi

Luồng cần có:

1. **Khách xem phim không cần đăng nhập** (hiện `play` đòi đăng nhập, kể cả tập miễn phí).
2. **Khách mua VIP không cần đăng nhập** và xem tập VIP ngay trên thiết bị đó, miễn đã thanh toán.
3. Vì "danh tính" của khách chỉ là cookie trên máy, **đổi điện thoại / xóa cookie là mất VIP**. Do đó hệ thống phải liên tục **khuyến khích đăng ký / đăng nhập** để "mang VIP đi", và khi họ làm vậy thì VIP, lịch sử, yêu thích đã có chuyển sang tài khoản.

### Ý tưởng cốt lõi: "tài khoản khách" (guest user)

Khách là một dòng `users` thật với cờ `is_guest = true`, không có email/mật khẩu, và có phiên (cookie) như người đăng nhập. Nhờ vậy **mọi thứ hiện có dùng lại nguyên**: `payments`, `subscriptions`, `vip_expires_at`, `watch_history`, `favorites`, `play`, giới hạn thiết bị, nhật ký. Đăng ký/đăng nhập sau đó chỉ là **"nhận" (claim)** tài khoản khách:

- **Đăng ký mới** → biến chính dòng khách thành tài khoản thường (đặt email + mật khẩu, `is_guest = false`). Giữ nguyên id nên VIP, lịch sử, đơn hàng đi theo, không cần di chuyển dữ liệu.
- **Đăng nhập vào tài khoản đã có** → **gộp** khách vào tài khoản đó (chuyển VIP, lịch sử, yêu thích, đơn hàng), rồi khóa khách.

Không dùng cách "khách chỉ là cookie + bảng đơn hàng riêng": phải viết lại quyền xem, lịch sử, thanh toán cho hai loại danh tính, và việc gộp về sau khó hơn.

### Quyết định đề xuất (cần sếp/anh xác nhận ở "Câu hỏi còn mở")

| Việc | Đề xuất |
|---|---|
| Khi nào tạo tài khoản khách | **Lười**: chỉ khi khách tạo đơn VIP (và báo tiến độ xem nếu muốn đồng bộ). Xem tập miễn phí không tạo dòng nào, tránh rác DB và bot |
| Lịch sử xem của khách chưa mua | Chỉ lưu trong trình duyệt (localStorage) (đã chốt 2026-10-30); khi có tài khoản thì đẩy lên server một lần |
| Thời hạn phiên khách | 1 năm, trượt (mỗi lần refresh gia hạn lại); cookie này **chính là chìa khóa VIP** nên phải bền |
| Khôi phục khi mất cookie | **UID** hiển thị cho khách (như NetShort, để hỗ trợ tra cứu) + **mã khôi phục** bí mật hiện một lần sau khi mua, nhập ở thiết bị mới để lấy lại VIP. Chỉ tạo cho khách đã mua VIP. Xem Bước 4 |
| Giới hạn thiết bị | Khách chỉ 1 phiên; muốn dùng nhiều thiết bị phải có tài khoản |

### Không làm (ngoài phạm vi plan này)

- Cổng thanh toán thật (SePay/PayPal) và job đối soát: thuộc Giai đoạn 5 của `plan.md`. Plan này chỉ làm phần **gắn đơn hàng vào khách** và dùng đúng khung đã có; bước thanh toán thật dùng bản giả lập (webhook giả trong test, `POST /demo/vip` trong bản demo).
- Xác thực email / quên mật khẩu (việc riêng ở Giai đoạn 2).
- Khôi phục VIP bằng mã đơn hàng / email biên nhận (xem câu hỏi mở).
- Deploy/Netlify.

## File/module bị ảnh hưởng

API:
- `app/models/user.py` (cột `is_guest`, `email`/`password_hash` cho phép NULL khi là khách, CHECK), migration `0012_guest_users`.
- `app/services/guest.py` (mới): tạo khách, nhận (claim), gộp (merge).
- `app/services/auth.py`, `app/routers/auth.py`: `POST /auth/guest`, `register`/`login` biết có phiên khách đang mở.
- `app/services/play.py` + `app/routers/me.py`: khách xem được tập miễn phí; báo tiến độ.
- `app/services/vip.py`: thêm chuyển gói khi gộp.
- `app/routers/` mới cho tạo đơn VIP (`POST /vip/orders`, `GET /vip/orders/{id}`), dùng được cho khách.
- `app/api/deps.py`, `docs/api.md`, `app/tests/test_permissions.py` (ma trận quyền mới).

Web:
- `lib/api/types.ts`, `lib/demo/api.ts` + `store.ts` (demo cũng phải có khách), `components/vip/*` (checkout không đòi đăng nhập), `components/watch/*` (bỏ cổng đăng nhập cho tập miễn phí), `components/account/*` (trang "Lưu VIP của bạn"), banner nhắc, từ điển `en.ts`/`vi.ts`.

## Các bước

Mỗi bước xong là chạy được và test được; làm một bước rồi dừng cho duyệt.

- [ ] **Bước 1: Khách xem tập miễn phí không cần đăng nhập**
  - Việc cần làm: `find_watchable_episode` / `play_episode`: khách (user = None) xem được tập `is_free`; tập VIP vẫn trả `login_required`/`vip_required` tùy ngữ cảnh (xem Bước 2). Lượt xem của khách vẫn đếm (chống trùng theo IP + tập thay vì user id). Báo tiến độ xem của khách: bỏ qua phía server (lưu local, Bước 7). Web: bỏ màn "đăng nhập để xem" ở tập miễn phí; demo giống vậy.
  - Tiêu chí: test `play` khách + tập free = 200, khách + tập VIP = 401/403 đúng mã; test ma trận quyền cập nhật; xem tập 1 ở `/vi` khi chưa đăng nhập được.

- [ ] **Bước 2: Tài khoản khách ở tầng dữ liệu và phiên**
  - Việc cần làm: migration `0012`: `users.is_guest bool default false`; `email`, `password_hash` cho phép NULL **chỉ khi** `is_guest` (CHECK: khách không có email/mật khẩu, người thường phải có cả hai); `display_name` mặc định "Guest". `services/guest.create_guest()` + `POST /api/v1/auth/guest` (cần `Origin` đúng, rate limit theo IP) trả cookie phiên 1 năm, giới hạn 1 phiên. `/me` trả thêm `is_guest`. Khách không đăng nhập được bằng email (không có email), không vào admin.
  - Tiêu chí: test tạo khách, refresh xoay vòng, `/me` đúng, hạn phiên 1 năm, rate limit; test CHECK DB (khách có email → lỗi); test migration lên/xuống.

- [ ] **Bước 3: Mua VIP bằng tài khoản khách**
  - Việc cần làm: `POST /vip/orders {plan_id}`: nếu chưa có phiên thì tự tạo khách rồi tạo `payments` pending (dùng khung `payments` hiện có, `provider` giả lập cho đến khi có SePay); `GET /vip/orders/{id}` để trang hỏi lại trạng thái (chỉ chủ đơn xem được). Khi đơn `paid`, `grant_vip` cộng VIP cho user của đơn (khách hay không không quan trọng). Webhook không cần phiên người dùng. `play` cho khách đã có VIP xem tập VIP.
  - Tiêu chí: test đầu-cuối: khách tạo đơn → webhook giả → `is_vip` đúng → `play` tập VIP = 200; người khác (khách khác) không đọc được đơn; đơn trùng/rate limit.

- [ ] **Bước 3b: UID và mã khôi phục cho khách đã mua VIP** (chốt hướng 2026-10-30, không thu email)
  - Việc cần làm: migration thêm `users.public_uid` (chuỗi ngắn dạng `VD-<số>`, duy nhất, không đoán ra user id) và `recovery_code_hash` (băm, như mật khẩu). Khi đơn đầu tiên của khách thành `paid`, sinh mã khôi phục (~80 bit, dễ gõ, không có chữ dễ nhầm), trả **một lần** qua `GET /vip/orders/{id}` ngay sau khi trả tiền; có nút "Tạo mã mới" (mã cũ vô hiệu) trong trang tài khoản. `POST /auth/recover {uid, code}`: đúng thì tạo phiên khách mới cho tài khoản đó và thu hồi phiên cũ; sai thì rate limit chặt theo IP và theo UID, báo lỗi chung chung. Ghi `audit_logs`. `/me` trả `public_uid`.
  - Tiêu chí: test khôi phục thành công (VIP, đơn, lịch sử còn), sai mã, vượt giới hạn thử, mã cũ hết hiệu lực sau khi tạo mã mới, khách chưa mua không có mã.

- [ ] **Bước 4: Nhận tài khoản khi đăng ký (khách → tài khoản thường)**
  - Việc cần làm: `register` khi có phiên khách: **cập nhật chính dòng khách** (email, mật khẩu, `terms_accepted_at`, `is_guest = false`), giữ id và phiên, không tạo user mới. Email đã dùng → `email_taken` và khách vẫn nguyên. Ghi nhật ký `users.claim`.
  - Tiêu chí: test khách có VIP đăng ký → vẫn VIP, cùng id, đơn/lịch sử còn nguyên; đăng ký email trùng không làm mất khách.

- [ ] **Bước 5: Gộp khi đăng nhập vào tài khoản đã có**
  - Việc cần làm: `login` khi có phiên khách: trong **một transaction**, khóa cả hai user (theo thứ tự id để tránh deadlock), rồi `services/guest.merge(guest, target)`: (a) chuyển `payments.user_id`; (b) chuyển `subscriptions` và dựng lại chuỗi để không mất ngày (gói của khách nối tiếp sau hạn hiện tại của tài khoản đích; thêm trạng thái/cách đánh dấu gói đã chuyển nếu cần, vì `SUBSCRIPTION_TRANSITIONS` hiện không có "chuyển"); (c) chuyển lịch sử xem, yêu thích (trùng thì giữ bản mới hơn); (d) xóa mềm khách + thu hồi phiên khách; (e) ghi `audit_logs` (`users.merge`). Từ chối gộp khi khách còn đơn `pending` (báo chờ vài phút) để không mất tiền đang trên đường.
  - Tiêu chí: test cả hai bên có VIP → tổng ngày đúng; lịch sử/yêu thích không trùng; khách bị khóa; đơn pending chặn gộp; gộp hai lần song song không nhân đôi (idempotent).

- [ ] **Bước 6: Giao diện luồng khách + lời mời lưu VIP**
  - Việc cần làm: trang tài khoản của khách giống NetShort: "Visitor", UID có nút copy, thẻ VIP, ví; màn "Khôi phục VIP" (nhập UID + mã) ở trang đăng nhập; màn hiện mã khôi phục sau khi mua. trang VIP/checkout bỏ bắt buộc đăng nhập (chỉ mời đăng nhập, không chặn). Sau khi thanh toán xong: màn "VIP đã bật, hãy lưu để không mất khi đổi điện thoại" + nút Đăng ký / Đăng nhập. Banner nhắc ở trang tài khoản, header (huy hiệu "VIP chưa lưu") và trên player, mạnh hơn khi VIP sắp hết hạn hoặc lần thứ N mở app. Trang đăng ký/đăng nhập hiện ghi chú "VIP, lịch sử của bạn sẽ được giữ lại". Tất cả qua từ điển EN/VI.
  - Tiêu chí: duyệt tay trên `/` và `/vi` ở mobile 375px; test từ điển; không có chữ cứng trong JSX.

- [ ] **Bước 7: Lịch sử xem local của khách + đồng bộ khi nhận tài khoản**
  - Việc cần làm: player ghi tiến độ vào localStorage khi chưa có tài khoản; sau khi khách tạo tài khoản/đăng nhập, đẩy lịch sử local lên server một lần (`POST /me/history/import`, giới hạn số dòng, kiểm tra quyền xem từng tập như `play`).
  - Tiêu chí: test import (tập ẩn bị bỏ qua, trùng bị gộp); demo: xem tập khi chưa đăng nhập rồi đăng ký thì "Xem tiếp" còn.

- [ ] **Bước 8: Bản demo + tài liệu + rà soát**
  - Việc cần làm: demo API/kho có khách, mua VIP giả lập không đăng nhập, claim và gộp; cập nhật `docs/api.md` (mã lỗi, bảng quyền khách/khách-VIP/user/VIP/admin), `docs/plans/gd2-b2-auth.md` ma trận, `CLAUDE.md` (mục auth: khái niệm khách), `plan.md` Giai đoạn 5. Quét toàn bộ test + build.
  - Tiêu chí: `ruff`, `pytest` (cả test DB), `pnpm lint/typecheck/test/build` xanh; xem luồng đủ ở cả hai ngôn ngữ.

## Rủi ro

- **Cookie là chìa khóa VIP**: người dùng xóa cookie, dùng chế độ riêng tư, hoặc Safari ITP dọn dữ liệu là mất VIP. Giảm bằng nhắc đăng ký mạnh sau khi mua và phiên 1 năm; cân nhắc khôi phục (câu hỏi 2).
- **Lạm dụng**: tạo khách hàng loạt (rate limit IP, chỉ tạo khi mua); khách chia sẻ VIP: không chia sẻ được vì gắn cookie, nhưng người khác dùng chung máy thì dùng chung; chấp nhận.
- **Gộp tài khoản** là phần nhạy cảm (tiền, quyền VIP): chạy trong một transaction có khóa, có nhật ký, có test song song; đơn pending chặn gộp.
- **Kẻ xấu đăng nhập tài khoản người khác khi đang có khách**: gộp chỉ chạy sau khi đăng nhập đúng mật khẩu của tài khoản đích, và chỉ chuyển dữ liệu **từ khách sang tài khoản đó**, không bao giờ ngược lại.
- Thanh toán thật chưa có: chưa kiểm chứng với tiền thật, chỉ webhook giả.
- Thị trường quốc tế nhưng SePay chỉ là chuyển khoản ngân hàng Việt Nam; khách nước ngoài cần PayPal (Giai đoạn 9). Luồng khách phải không phụ thuộc cổng cụ thể.

## Đã chốt (2026-10-30)

1. Khách chưa mua chỉ lưu lịch sử xem trên máy (localStorage).
2. Khôi phục VIP: UID + mã khôi phục (Bước 3b); trên web VIP của khách dễ mất khi đổi trình duyệt/thiết bị, kho cookie của web-app iPhone tách riêng, chế độ riêng tư, xóa dữ liệu.
3. Không thu email lúc mua (đối chiếu qua giao dịch ngân hàng).
4. Khách đã có VIP mua tiếp = gia hạn nối tiếp.
5. Phiên khách 1 năm, trượt.

## Câu hỏi còn mở

- Mã khôi phục có cần cho cả khách chưa mua VIP không? (Đề xuất: không, họ không có gì để mất.)
