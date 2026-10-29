# Plan: Bản demo tĩnh trên Netlify (không cần API, không cần database)

> Trạng thái: **đã duyệt 2026-10-29**; video mẫu chỉ cần một luồng có sẵn dùng chung cho mọi tập. Branch `feat/frontend`. Làm sau Bước 13 của `docs/plans/gd3-frontend.md`; Bước 14, 15 của plan đó dời lại sau buổi demo.
> Mục tiêu: sếp mở `vdramademo.netlify.app` (ghi đè bản cũ) là xem được cả giao diện người xem lẫn admin, đăng nhập được bằng tài khoản demo, "mua VIP" giả được, không cần máy bạn bật.

## Cách làm

Netlify chỉ host phần giao diện, nên **API được thay bằng một API giả chạy ngay trong trình duyệt**. Client API (`src/lib/api/client.ts`) đã nhận được hàm `fetch` tùy chọn, nên chỉ cần cắm một `fetch` giả vào. Code backend và bản chạy thật không đổi: bật bằng biến build `NEXT_PUBLIC_DEMO=true`, không bật thì web chạy như cũ.

- **Dữ liệu**: chụp từ chính DB demo (12 phim, thể loại, tập, ảnh) thành một file JSON trong code, để bản Netlify giống hệt bản chạy thật.
- **Trạng thái người dùng** (tài khoản, phiên, lịch sử, My List, VIP) lưu trong `localStorage` của từng trình duyệt: mỗi người xem một bản riêng, xóa dữ liệu trình duyệt là về ban đầu. Không có gì gửi đi đâu.
- **Tài khoản demo** (mật khẩu giả, in công khai ngay trên trang đăng nhập kèm nút điền sẵn): `viewer@example.com`, `vip@example.com`, `admin@example.com`. Đăng ký tài khoản mới cũng chạy (lưu trong trình duyệt).
- **Mua VIP giả**: ở bản demo, nút "I've paid" ở trang thanh toán bật lên, bấm thì tài khoản có VIP theo gói đã chọn (30 / 90 / 365 ngày), tập VIP mở khóa. Có chữ "Demo: no real payment" rõ ràng.
- **Video**: dùng một luồng HLS mẫu công khai, góc trình phát ghi "SAMPLE VIDEO". Phân quyền vẫn đúng: tập VIP với tài khoản thường vẫn bị khóa.
- **Admin**: phần thật (danh sách phim, tập) đọc từ dữ liệu mẫu; upload video báo "chưa cấu hình Cloudflare Stream" như bản thật; các trang Preview giữ nguyên.
- **Nhãn**: một dải mỏng "Demo site · sample data · nothing is real" ở đầu trang (chỉ bản demo), để không ai nhầm với web thật.
- **Host**: Netlify chạy Next.js bằng runtime của nó (không cần xuất tĩnh), nên mọi route và `cacheComponents` giữ nguyên. Bản demo bỏ `output: "standalone"` (chỉ Docker cần).

## Các bước (mỗi bước một commit, làm xong dừng)

- [x] **Bước N1: API giả trong trình duyệt** (xong 2026-10-29; 20 test mới, tổng 39. Dữ liệu chụp: 11 phim (gồm 1 nháp `the-one-in-my-dream`), 85 tập (gồm 2 tập nháp ở `parallel-secrets`, `behind-the-lights`); phim đã xóa mềm không đưa vào. Có thêm đường `POST /demo/vip` chỉ ở bản demo để "mua VIP" giả. Chụp lại bằng `node scripts/capture-demo-data.mjs`. Mật khẩu demo `Demo1234!` (giả, công khai))
  - Việc:
    - Script chụp dữ liệu từ API đang chạy ra `src/lib/demo/data.json` (phim, thể loại, tập, ảnh).
    - `src/lib/demo/store.ts` (đọc/ghi `localStorage`, an toàn khi không có), `src/lib/demo/api.ts` (bộ định tuyến `fetch` giả theo `docs/api.md`: auth, me, series, search, genres, play, history, favorites, admin episodes, upload, stream-sync; trả đúng mã lỗi và JSON như thật, gồm `vip_required`, `not_authenticated`, `conflict`, `stream_unavailable`).
    - Vitest cho bộ giả: đăng nhập sai / đúng, tập VIP bị khóa với tài khoản thường, lưu tiến độ, My List, quyền admin.
  - Hoàn thành khi: test xanh; không file nào ngoài `lib/demo` bị đổi.
- [x] **Bước N2: Cắm vào web, bật VIP giả** (xong 2026-10-29; đã chạy `NEXT_PUBLIC_DEMO=true pnpm dev` với API trỏ vào cổng chết: trang chủ có dữ liệu, đăng nhập một chạm bằng 3 tài khoản demo, tập VIP bị khóa với viewer, "I've paid (demo)" cấp VIP và mở khóa tập, admin thấy tập nháp và Sync status báo "chưa cấu hình", "Reset demo" xóa sạch trạng thái. Lưu ý: bản build thường vẫn chứa một chunk dữ liệu demo tải lười (không bao giờ được tải khi không bật demo), trình biên dịch không loại hẳn được; vô hại. Admin vào bằng menu tài khoản → Admin)
  - Việc: `client.ts` dùng `fetch` giả khi `NEXT_PUBLIC_DEMO`; `lib/api/catalog.ts` đọc thẳng dữ liệu mẫu ở demo; `SeriesForm` thôi gọi `fetch` trực tiếp; trình phát dùng HLS mẫu ở demo; trang đăng nhập có khung "Demo accounts" + nút điền sẵn; checkout bật "I've paid" ở demo; dải "Demo site" ở đầu trang; `robots` chặn công cụ tìm kiếm.
  - Hoàn thành khi: `NEXT_PUBLIC_DEMO=true pnpm dev` chạy đủ luồng người xem và admin **khi API và DB tắt hẳn**; build thường (không demo) không đổi hành vi, mọi kiểm tra xanh.
- [x] **Bước N3: Cấu hình Netlify và build thử** (xong 2026-10-29; `apps/web/netlify.toml` (chạy CLI từ `apps/web`; đặt ở gốc với `base` thì CLI đi tìm `.next` sai chỗ, lỗi gặp lúc deploy; Node 24, `NEXT_PUBLIC_DEMO=true`, `PUBLIC_ORIGIN=https://vdramademo.netlify.app`); `next.config.ts` bỏ `standalone` khi demo. Đã `next build` + `next start` với API trỏ vào cổng chết: 11 route chính trả 200, `robots.txt` chặn tất cả, có `noindex`; quét 21 trang ở 360 và 440px (đã đăng nhập admin): không tràn ngang, dải DEMO có ở mọi trang. **Chưa thử trên Netlify thật**: runtime Next của Netlify với Next 16.4 + `cacheComponents` chỉ biết được khi deploy; N4 deploy bản nháp (không `--prod`) trước)
  - Việc: `apps/web/netlify.toml` (lệnh build, biến môi trường demo), bỏ `standalone` khi demo, mục "Đưa lên Netlify" trong README; `pnpm build` bản demo chạy được; thử bằng `pnpm start` với API tắt, quét 360–440px.
  - Hoàn thành khi: bản build demo chạy đúng khi không có API.
- [x] **Bước N4: Deploy lên `vdramademo.netlify.app`** (xong 2026-10-29; deploy từ máy bằng `netlify deploy --build --prod` trong `apps/web`, đã kiểm tra bản nháp rồi mới ghi đè bản cũ. Trên Windows cần Developer Mode và `nodeLinker: hoisted`, xem mục "Ghi chú khi deploy từ Windows")
  - Việc: bạn đăng nhập Netlify (`netlify login`, tôi không giữ mật khẩu hay token của bạn), tôi chạy deploy bản build đó vào site hiện có (ghi đè bản cũ theo bạn chọn), mở link kiểm tra lại các luồng trên bản online.
  - Hoàn thành khi: link công khai chạy đủ luồng viewer, VIP giả, admin, trên điện thoại.

## Rủi ro và điều cần biết

- **Bản demo không phải backend thật**: logic phân quyền chỉ mô phỏng ở phía trình duyệt. Chỉ để xem giao diện, không dùng cho dữ liệu thật.
- **Mật khẩu demo công khai** trên trang là chủ ý (để sếp tự đăng nhập), vì tài khoản chỉ tồn tại trong trình duyệt của người xem.
- **Video mẫu** là luồng công khai của bên thứ ba (Mux test stream); nếu bên đó đổi hoặc gỡ thì tập phim báo lỗi phát. Có thể thay bằng một file video của bạn đặt trong `public/`.
- **Ghi đè site cũ**: bản cũ (giao diện tiếng Việt, deploy qua Netlify Drop) sẽ mất. Netlify giữ lịch sử deploy nên khôi phục được trong trang quản lý site.
- Nếu sau này muốn bản chạy API thật trên Netlify thì cần host API và DB riêng (Render, Fly.io...), việc đó nằm ngoài plan này.

## Ghi chú khi deploy từ Windows

- Cần bật **Developer Mode** (plugin Netlify tạo symlink; thiếu thì lỗi `EPERM ... symlink`).
- Cần `nodeLinker: hoisted` trong `apps/web/pnpm-workspace.yaml`, rồi `pnpm install` lại. Bố cục `.pnpm` mặc định (kể cả khi thêm `publicHoistPattern`) làm plugin tạo symlink `react` hai lần và lỗi `EEXIST`. Kiểm tra không cần đăng nhập: `npx netlify-cli build --offline` trong `apps/web` (phải báo "Netlify Build Complete").
- Nếu một lần deploy bị ngắt, xóa các thư mục sinh ra trong `apps/web/.netlify` (giữ `state.json`) trước khi chạy lại; đường dẫn dài nên dùng `robocopy <thư mục rỗng> <thư mục cần xóa> /MIR`.
