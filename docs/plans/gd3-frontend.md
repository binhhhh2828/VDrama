# Plan: Giai đoạn 3 / Frontend (web người xem)

> Trạng thái: **đã duyệt 2026-10-29**, ưu tiên bản demo bàn giao cho sếp. Branch `feat/frontend`, tách từ `main` (đã có auth, catalog, stream, activity).
> Liên quan: `plan.md` Giai đoạn 3 (và task "Chuyển thông báo của API sang tiếng Anh" ở Giai đoạn 2); thiết kế: canvas [VDrama Web Design](https://claude.ai/artifact/Kto2QDvHNF4qtuLEAXUja2); tài liệu API: `docs/api.md`.

## Mục tiêu và phạm vi

- **Mục tiêu**: web **đủ mọi chức năng cho cả người xem lẫn admin** (chốt 2026-10-29), **tiếng Anh**, đúng thiết kế đã duyệt, dùng tốt trên điện thoại, để sếp xem và hiểu sản phẩm:
  - Người xem: trang chủ, duyệt theo thể loại, tìm kiếm; chi tiết phim, xem phim (player, nhớ tiến độ, tập kế tiếp); đăng ký / đăng nhập, tài khoản, My List, lịch sử; trang VIP, thanh toán, quên mật khẩu, SEO, các trang tĩnh.
  - Admin: tổng quan, quản lý phim và tập, upload video, người dùng, thanh toán, gói VIP, nhật ký thao tác.
- **Dữ liệu mẫu tiếng Anh** (chốt 2026-10-29): `seed-demo` đổi sang tên phim, thể loại, mô tả, tên tập tiếng Anh cho đồng bộ với giao diện; thêm 3 tài khoản demo (người xem thường, VIP, admin) để demo đủ các vai trò.
- **Chức năng chưa có API thì làm giao diện tĩnh** (chốt 2026-10-29). Ai xem cũng phải biết đó là bản xem trước:
  - Mỗi màn hình tĩnh có nhãn "Preview" và một dòng giải thích ngắn (ví dụ "Payments are not live yet").
  - Màn hình tĩnh không gửi dữ liệu đi đâu, không giả vờ thành công (không báo "đã thanh toán", "đã gửi email").
  - Dữ liệu mẫu nằm trong một file riêng (`src/lib/preview-data.ts`) để khi có API thì xóa một chỗ.
  - Danh sách màn hình tĩnh hiện tại:
    - Trang VIP: bảng giá mẫu.
    - Trang thanh toán: VietQR mẫu, đếm ngược hạn đơn (chờ Giai đoạn 5).
    - Quên mật khẩu, đặt lại mật khẩu, xác thực email (chờ backend email).
    - Admin: tổng quan số liệu, tạo / sửa / xóa / xuất bản phim và tập, người dùng, thanh toán, gói VIP, nhật ký (chờ API admin ở Giai đoạn 4).
  - Phần admin dùng dữ liệu thật: danh sách phim và tập (qua API catalog, admin thấy cả tập chưa xuất bản), upload video và đồng bộ trạng thái video (API đã có).
- **Không làm**:
  - API admin còn thiếu (CRUD phim/tập/gói, danh sách user/thanh toán, thống kê): Giai đoạn 4. Giao diện làm sẵn để nối vào.
  - Đa ngôn ngữ (i18n): chỉ tiếng Anh, viết thẳng trong component.
  - Nội dung pháp lý thật: trang tĩnh chỉ có khung và chỗ trống.

## Thiết kế đã chốt (tóm tắt, bản đầy đủ ở `docs/design.md`, Bước 1)

- **Font 100% sans-serif: Inter** (chốt 2026-10-29), nạp bằng `next/font`. Tiêu đề 800–900, menu và phụ đề 400–500. Geist là phương án dự phòng.
- **Nền tối** `#0B0709`, bề mặt `#150E12` / `#1F1419`, viền `#36252D`, chữ `#F7EFF2` / chữ phụ `#B5A2AA`.
- **Gradient thương hiệu** `#FF2E7E → #FF7A3D`, **chữ tối `#16060D` trên nút gradient** (độ tương phản khoảng 5.7:1). Vàng `#FFC247` chỉ dành cho VIP.
- **Hình khối**: poster 2:3, thumbnail tập và player 16:9. Nút và chip bo tròn hẳn (pill). Vùng bấm tối thiểu 44px.
- **Logo**: đã tách nền đen thành PNG nền trong suốt (2026-10-29) từ 2 file JPG gốc:
  - Bản ngang, bản đứng, icon vuông, favicon.
  - Bản chữ tối cho nền sáng (email, tài liệu).
  - Không còn cần `mix-blend-mode`. Khi team gửi file vector (SVG) thì thay vào.

## Kiến trúc frontend

Next.js 16.4 (App Router, `cacheComponents` đang bật). Đọc tài liệu trong `node_modules/next/dist/docs/` trước khi viết từng phần (theo `AGENTS.md`).

### Lấy dữ liệu: công khai trên server, theo người dùng trên trình duyệt

- **Dữ liệu công khai** (danh sách phim, chi tiết, danh sách tập, tìm kiếm, thể loại) lấy **trên server**:
  - Gọi API qua mạng nội bộ (`API_INTERNAL_URL`: `http://api:8000` trong Docker, `http://localhost:8000` khi dev), dùng `'use cache'` + `cacheLife` (vài phút) + `cacheTag`.
  - HTML có sẵn nội dung cho SEO, và trang nằm trong khung tĩnh nên tải nhanh.
  - Catalog trả cùng nội dung cho mọi người, nên cache an toàn (đã thiết kế như vậy ở backend).
- **Dữ liệu theo người dùng** (`/me`, ổ khóa VIP, lịch sử, yêu thích, `play`) lấy **trên trình duyệt**:
  - Gọi `/api/v1/...` cùng domain, cookie httpOnly tự đi kèm.
  - Bọc phần đó trong component client có trạng thái chờ (skeleton).
  - Lý do không lấy trên server:
    - Access token chỉ sống 15 phút và làm mới bằng cách xoay vòng refresh cookie. Server component **không ghi được cookie**, nên làm mới ở server sẽ hỏng phiên.
    - Phần riêng của từng người không được lẫn vào HTML đã cache.
- **Client gọi API** (`src/lib/api/client.ts`): gặp 401 `not_authenticated` thì gọi `POST /auth/refresh` **một lần** rồi gửi lại request. Nhiều request cùng gặp 401 thì dùng chung một lần refresh. Refresh trả `session_expired` thì coi như đã đăng xuất.
- **Câu hiển thị lỗi lấy theo `code`** (bảng ánh xạ ở frontend), không hiện thẳng `message` của API. Nhờ vậy giao diện tiếng Anh ngay cả khi API còn trả câu tiếng Việt.
- **Kiểu dữ liệu** cho response và mã lỗi viết tay theo `docs/api.md`, có test.
- **Build trên CI không có API**: trang catalog đọc lúc request (sau `<Suspense>`), khung trang vẫn tĩnh; build trên CI phải xanh khi API không chạy.

### Đường dẫn

| URL | Trang | Nguồn dữ liệu |
|---|---|---|
| `/` | Trang chủ | API |
| `/browse?genre=&sort=` | Duyệt phim (thể loại, mới / hot), nút "Load more" theo con trỏ | API |
| `/search?q=` | Tìm kiếm | API |
| `/series/[slug]` | Chi tiết phim | API |
| `/series/[slug]/episode/[number]` | Xem tập (URL dễ đọc; lấy id tập từ danh sách tập) | API |
| `/signin`, `/signup` | Đăng nhập, đăng ký (`?next=` để quay lại trang trước) | API |
| `/forgot-password`, `/reset-password`, `/verify-email` | Quên / đặt lại mật khẩu, xác thực email | Tĩnh (Preview) |
| `/account`, `/account/list`, `/account/history` | Tài khoản, My List, lịch sử | API |
| `/vip` | Gói VIP | Tĩnh (Preview, giá mẫu) |
| `/vip/checkout?plan=` | Thanh toán VietQR | Tĩnh (Preview) |
| `/terms`, `/privacy`, `/refunds`, `/contact` | Trang tĩnh | Tĩnh |
| `/admin` | Tổng quan (số liệu) | Tĩnh (Preview) |
| `/admin/series`, `/admin/series/new`, `/admin/series/[slug]` | Danh sách phim, tạo phim, chi tiết phim + tập | Danh sách và tập: API; form tạo / sửa: Preview |
| `/admin/series/[slug]/episodes/[number]` | Tập: upload video, đồng bộ trạng thái | API (`upload`, `stream-sync`); sửa thông tin tập: Preview |
| `/admin/users`, `/admin/payments`, `/admin/plans`, `/admin/audit` | Người dùng, thanh toán, gói VIP, nhật ký | Tĩnh (Preview) |

### Player

- Dùng **`<video>` + hls.js** (Safari phát HLS sẵn, không cần hls.js), thanh điều khiển tự vẽ theo thiết kế. Không dùng iframe Stream player, vì cần sự kiện thời gian để lưu tiến độ và cần giao diện riêng.
- **Lưu tiến độ**: `PUT /me/history/{id}` mỗi 20 giây khi đang phát, và khi tạm dừng, chuyển tập hoặc đóng tab (`fetch` với `keepalive`). Mở lại thì tua tới tiến độ cũ, trừ khi đã gần hết tập.
- **Token video hết hạn** (mở tab lâu): gọi lại `play` lấy URL mới rồi phát tiếp từ chỗ cũ.
- **Các trạng thái** đều có màn hình riêng: khách (mời đăng nhập), cần VIP (mời VIP), video chưa sẵn sàng, Stream chưa cấu hình (503).
- **Dev chưa có Cloudflare Stream**: `play` trả 503. Biến `NEXT_PUBLIC_DEV_SAMPLE_HLS` trỏ tới một luồng HLS mẫu công khai để làm và demo player, **chỉ có tác dụng khi build dev**.

### Admin

- Khung riêng (`/admin/*`): thanh bên trái (điện thoại: menu trên cùng), cùng hệ màu, không có header người xem.
- Chặn ở giao diện theo `/me.role`: khách → trang đăng nhập; user thường → màn hình "Admins only". Đây chỉ là trải nghiệm; quyền thật do API kiểm tra (`AdminUser`), giao diện không bao giờ là lớp bảo vệ duy nhất.
- Thao tác cần lý do (xóa, tặng VIP, hoàn tiền, khóa tài khoản) luôn có ô "Reason" bắt buộc, đúng quy tắc `audit_logs` của backend, để khi nối API không phải đổi giao diện.
- Upload video dùng `tus-js-client` theo luồng trong `docs/api.md`; ở dev không có Stream thì hiện rõ lỗi 503 "Video service is not configured".

### Kiểm thử frontend

- Mỗi bước: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (CI đã chạy sẵn).
- **Vitest** cho phần logic không cần trình duyệt: client API (refresh một lần, gom request), định dạng thời lượng và tiến độ, ánh xạ mã lỗi. Thêm vào CI.
- **Playwright** chạy thử luồng chính trên bộ dev thật (`docker compose` + `seed-demo`), cả khung desktop lẫn điện thoại 390px. Chạy local; đưa vào CI sau khi ổn định.
- Mỗi trang xong thì mở bằng trình duyệt ở cả hai khung để so với canvas.

## Các bước

Mỗi bước là một commit, xong thì dừng cho bạn xem. **Bước 1–13 là bản demo bàn giao** (người xem + admin); Bước 14–15 làm khi còn thời gian.

- [x] **Bước 1: Nền thiết kế** (xong 2026-10-29; đã xem `/dev/ui` ở 1440px và 375px; bản build production trả 404 cho `/dev/ui`)
  - Việc:
    - `docs/design.md` (màu, font, cỡ chữ, bo góc, khoảng cách, thành phần, cách dùng logo).
    - Logo nền trong suốt vào `apps/web/public/brand/`; favicon, icon Apple, icon 512 từ logo.
    - Token màu bằng `@theme` của Tailwind v4 trong `globals.css`; Inter qua `next/font`; `<html lang="en">`; metadata gốc.
    - Các thành phần dùng chung: `Button` (gradient, phụ, VIP), `Badge` (TOP, VIP, FREE, NEW, PREVIEW), `Chip`, `PosterCard`, `EpisodeThumb`, `ProgressBar`, `Skeleton`, `Field` (ô nhập có lỗi), icon SVG.
    - Trang `/dev/ui` chỉ có khi dev để xem các thành phần.
  - Hoàn thành khi:
    - lint, typecheck, format, build xanh.
    - `/dev/ui` khớp style guide trên canvas (xem bằng trình duyệt ở 1440px và 390px).
    - Build production không có `/dev/ui`.
- [x] **Bước 2: Dữ liệu mẫu tiếng Anh và tài khoản demo** (backend; xong 2026-10-29, thêm 3 gói VIP mẫu để cấp VIP cho tài khoản demo; 640 test API xanh)
  - Việc:
    - `app/services/demo_seed.py`: tên phim, slug, thể loại, mô tả, tên tập ("Episode 1"), quốc gia, lý do trong nhật ký sang tiếng Anh. Giữ đủ các trường hợp cũ (banner, hot, tập nháp, phim nháp, phim đã xóa).
    - Thêm 3 tài khoản demo `viewer@example.com`, `vip@example.com`, `admin@example.com` (domain dành riêng cho ví dụ, không nhận email thật; `.test` bị kiểm tra email của API từ chối). Mật khẩu đọc từ biến `DEMO_PASSWORD` (không ghi cứng trong code); VIP cấp qua `services/vip.grant_vip` (có lý do, có nhật ký); admin qua cùng service với lệnh `create-admin`. Vẫn từ chối chạy khi `ENV=prod`.
    - README: cách làm mới DB dev (seed chỉ thêm phần thiếu theo slug, nên DB đã có phim tiếng Việt cũ phải xóa volume rồi seed lại).
  - Hoàn thành khi:
    - `test_demo_seed.py` cập nhật và xanh; thêm test: 3 tài khoản đúng vai trò, tài khoản VIP có `is_vip`, chạy lại không trùng, thiếu `DEMO_PASSWORD` thì bỏ qua tài khoản và báo rõ.
    - Tìm `city` ra đúng phim mẫu; ruff, pytest xanh.
- [x] **Bước 3: Tầng dữ liệu** (xong 2026-10-29; 16 test Vitest, thêm `pnpm test` vào CI; build xanh khi API tắt, đã thử bằng trang tạm đọc catalog trong `<Suspense>`. Sửa thêm: compose dev truyền `API_PROXY_TARGET` lúc build image web, trước đó trình duyệt gọi `/api` trong Docker bị 404)
  - Việc:
    - `src/lib/api/`: kiểu dữ liệu, hàm gọi catalog phía server (cache), client phía trình duyệt (refresh một lần, gom request), ánh xạ mã lỗi sang câu tiếng Anh.
    - `src/lib/preview-data.ts`: dữ liệu mẫu cho màn hình tĩnh (gói VIP, thông tin chuyển khoản mẫu, số liệu và bảng của admin).
    - `API_INTERNAL_URL` trong `.env.example` và compose dev.
    - Thêm Vitest.
  - Hoàn thành khi:
    - Vitest: 401 → refresh → gửi lại đúng một lần; 5 request cùng 401 chỉ refresh một lần; refresh thất bại thì báo đăng xuất; mọi mã lỗi trong `docs/api.md` có câu tiếng Anh.
    - `pnpm build` xanh khi API không chạy.
- [x] **Bước 4: Khung trang người xem** (xong 2026-10-29; đã xem ở 1440px và 375px với khách và admin trên DB demo riêng `vdrama_demo`; trạng thái đăng nhập dùng chung qua `SessionProvider`; trang người xem nằm trong nhóm route `(site)`)
  - Việc:
    - Header: logo, menu, ô tìm kiếm, khu vực tài khoản đọc `/me` trên trình duyệt (Sign in / Get VIP, hoặc avatar có menu; admin có thêm link "Admin").
    - Footer có link trang tĩnh. Thanh điều hướng dưới đáy trên điện thoại.
    - Trang `not-found` và `error` theo thiết kế.
  - Hoàn thành khi:
    - Xem bằng trình duyệt ở 1440px và 390px khớp canvas; menu xuống dòng gọn ở màn hẹp.
    - Phím Tab đi qua được mọi link; build xanh.
- [x] **Bước 5: Trang chủ** (xong 2026-10-29; banner tự chuyển 5 phim, Trending, thể loại, New releases, dải VIP; Continue watching thử với `viewer@` có 2 tập xem dở; HTML trả về có tên phim, khách không thấy Continue watching; xem ở 1440px và 375px. Mô tả phim mẫu giờ chỉ là câu giới thiệu, bỏ đuôi "(Demo series...)")
  - Việc:
    - Banner (`/series?with_banner=true`), Trending (`sort=hot`), New releases, thể loại: lấy trên server.
    - Continue watching: chỉ hiện khi đã đăng nhập, lấy trên trình duyệt.
    - Skeleton khi chờ.
  - Hoàn thành khi:
    - Với dữ liệu `seed-demo`, trang chủ hiện đủ các mục; khách không thấy Continue watching.
    - HTML trả về đã có tên phim (kiểm bằng `curl`).
    - Đúng thiết kế ở cả hai khung.
- [x] **Bước 6: Duyệt phim và tìm kiếm** (xong 2026-10-29; Load more thử với trang 4 phim: 3 trang, 10 phim không trùng, đổi thể loại về trang đầu; tìm `city`, `virtual c`, `SKY` ra đúng phim, từ khóa 1 ký tự không gọi API; xem ở 1440px và 375px)
  - Việc: `/browse` (lọc thể loại, mới / hot, "Load more" theo con trỏ), `/search?q=` (gõ xong mới tìm, có trạng thái không thấy kết quả).
  - Hoàn thành khi:
    - Load more đi hết danh sách không trùng; đổi thể loại thì về trang đầu.
    - Từ khóa một phần tên (ví dụ `city`) tìm ra phim mẫu; từ khóa dưới 2 ký tự không gọi API.
- [x] **Bước 7: Chi tiết phim** (xong 2026-10-29; thử với khách, `viewer@` và `vip@`: khách không ổ khóa và thấy Play Episode 1, viewer có ổ khóa ở tập VIP và Continue Episode 2, VIP không ổ khóa; My List thêm, giữ sau khi tải lại, bỏ đúng. Phim không có hiện trang 404 kèm `noindex`, nhưng mã HTTP là 200 vì trang stream (giới hạn của Next khi `notFound()` nằm trong Suspense))
  - Việc:
    - `/series/[slug]`: thông tin, poster cạnh chữ, danh sách tập lấy trên server.
    - Phần riêng lấy trên trình duyệt: ổ khóa VIP theo `/me.is_vip`, tiến độ từng tập, nút "Continue Episode N", nút My List (yêu thích).
    - Metadata và Open Graph theo từng phim; phim không có thì trang 404.
  - Hoàn thành khi:
    - Khách thấy nhãn FREE / VIP; user thường thấy ổ khóa ở tập VIP; VIP không thấy ổ khóa.
    - Thêm / bỏ My List cập nhật ngay; Continue đúng tập đang xem dở.
- [x] **Bước 8: Xem phim** (xong 2026-10-29; trang xem nằm ở nhóm route `(watch)` có header gọn; đã thử trên luồng HLS mẫu: phát, tua bằng phím, lưu khi dừng, mở lại tua đúng 200 giây, hết tập đếm ngược 5 giây rồi sang tập sau; viewer ở tập VIP thấy màn mời VIP, khách thấy mời đăng nhập và không gọi `play`; bản build prod không chứa URL mẫu. **Chưa thử được**: xin URL mới khi token hết hạn, phát HLS sẵn có của Safari/iPhone, URL thật của Cloudflare Stream)
  - Việc:
    - `/series/[slug]/episode/[number]`: player hls.js, điều khiển tự vẽ, lưu tiến độ, tua tới chỗ cũ, tập kế tiếp.
    - Màn hình cho các trường hợp 401 / 403 / 409 / 503; lấy URL mới khi token hết hạn; danh sách tập bên cạnh.
  - Hoàn thành khi:
    - Phát được luồng HLS mẫu ở dev.
    - Tiến độ lưu và khôi phục đúng (xem trên `/account/history`).
    - Khách bị mời đăng nhập; tập VIP mời mua VIP; bàn phím điều khiển được (space, mũi tên).
- [x] **Bước 9: Đăng ký, đăng nhập, đăng xuất, quên mật khẩu** (xong 2026-10-29; nhóm route `(auth)` có khung riêng theo canvas; `?next=` chỉ nhận đường dẫn trong site (`safeNext`, có test); đã thử: sai mật khẩu, đúng mật khẩu quay về tập đang xem, đăng ký báo lỗi từng trường và email trùng, đăng ký mới tự đăng nhập, đăng xuất qua menu, lần thứ 6 sai mật khẩu báo chờ 54 giây; trang Preview không có `<form>` nên không gửi gì. Phần "vào /account sau khi đăng xuất bị chuyển về đăng nhập" kiểm ở Bước 10 khi có trang /account)
  - Việc:
    - Đăng ký, đăng nhập theo API (display name, email, mật khẩu, đồng ý điều khoản); lỗi từng trường từ `fields`; quay về `?next=`; đăng xuất ở menu tài khoản.
    - Tĩnh (Preview): `/forgot-password`, `/reset-password`, `/verify-email` theo cùng thiết kế; nút gửi bị tắt, ghi "Email sign-in help is coming soon".
  - Hoàn thành khi:
    - Đăng ký → đã đăng nhập; sai mật khẩu báo `invalid_credentials`; email trùng báo ngay ở trường email.
    - Bấm quá nhiều bị 429 thì báo thời gian chờ.
    - Đăng xuất xong vào trang `/account` thì bị chuyển về trang đăng nhập.
    - Màn hình Preview có nhãn rõ, không gửi request nào (kiểm bằng tab Network).
- [x] **Bước 10: Tài khoản, My List, lịch sử** (xong 2026-10-29; khách vào /account/* bị chuyển sang đăng nhập kèm ?next=; đã thử: xóa một dòng lịch sử, Clear all có hỏi lại và Cancel, bỏ phim khỏi My List cập nhật ngay và đúng API, VIP thấy "VIP until Nov 28, 2026"; tự bấm Sign out ở /account về trang chủ, vào lại /account/list thì bị mời đăng nhập. Các trang /account đặt `instant = false` vì nội dung chỉ có trên trình duyệt)
  - Việc:
    - `/account`: thông tin, trạng thái VIP "VIP until …" hoặc mời VIP.
    - `/account/list`: yêu thích, Load more.
    - `/account/history`: Xem tiếp, xóa một tập, xóa tất cả có hỏi lại.
  - Hoàn thành khi: xóa / bỏ thì giao diện cập nhật ngay; khách vào đây bị chuyển sang đăng nhập.
- [ ] **Bước 11: VIP, thanh toán, trang tĩnh, SEO**
  - Việc:
    - `/vip` theo canvas với giá mẫu từ `preview-data.ts`, nhãn Preview.
    - `/vip/checkout?plan=`: VietQR mẫu (ảnh QR giữ chỗ, không phải tài khoản thật), thông tin chuyển khoản mẫu, đếm ngược hạn đơn; nút "I've paid" bị tắt, ghi "Payments are not live yet".
    - `/terms`, `/privacy`, `/refunds`, `/contact` có khung và chỗ trống chờ nội dung pháp lý.
    - `sitemap.xml` (phim lấy từ API), `robots.txt`, Open Graph mặc định.
  - Hoàn thành khi:
  - Hoàn thành khi: `sitemap.xml` liệt kê phim đã xuất bản (không có `/admin`); `robots.txt` chặn `/admin`, `/account`; build xanh.
- [ ] **Bước 12: Admin: khung, phim, tập, upload video**
  - Việc:
    - Khung `/admin` (thanh bên, chặn theo vai trò), tổng quan `/admin` với số liệu mẫu (Preview).
    - `/admin/series`: danh sách thật từ catalog, tìm theo tên; nút New / Edit / Publish / Delete mở form Preview (lưu bị tắt; xóa có ô Reason).
    - `/admin/series/[slug]`: thông tin + bảng tập thật (kể cả tập chưa xuất bản, trạng thái video).
    - `/admin/series/[slug]/episodes/[number]`: upload video thật (`upload` + tus, thanh tiến độ), nút "Sync status" gọi `stream-sync`; báo đúng 409 / 503 / 502.
  - Hoàn thành khi:
    - Đăng nhập `admin@` vào được; `viewer@` thấy "Admins only"; khách bị chuyển sang đăng nhập.
    - Bảng tập hiện tập nháp của phim mẫu; upload ở dev không có Stream báo 503 rõ ràng; tập đang xuất bản báo 409.
    - Xem ở 1440px và 390px.
- [ ] **Bước 13: Admin: người dùng, thanh toán, gói VIP, nhật ký. Mốc bàn giao demo**
  - Việc:
    - `/admin/users`, `/admin/payments`, `/admin/plans`, `/admin/audit`: bảng dữ liệu mẫu (Preview), lọc, xem chi tiết; tặng VIP / hoàn tiền / khóa tài khoản có ô Reason, nút lưu bị tắt.
    - Một lượt rà cả site (người xem + admin) ở 1440px và 390px.
    - README: chạy web, dữ liệu mẫu, 3 tài khoản demo, phần nào thật / phần nào Preview, để sếp tự mở được.
  - Hoàn thành khi:
    - Đi hết luồng người xem: trang chủ → phim → đăng ký → xem tập free → tập VIP mời mua → VIP → thanh toán (Preview) → My List → lịch sử.
    - Đi hết luồng admin: tổng quan → phim → tập → upload → người dùng → thanh toán → gói → nhật ký.
    - Mọi kiểm tra web xanh.
- [ ] **Bước 14: Kiểm thử luồng chính, khép plan** (sau demo)
  - Việc:
    - Playwright cho luồng ở Bước 13 (người xem và admin), khung desktop và điện thoại.
    - Rà khả năng truy cập (Tab, nhãn, độ tương phản).
    - `CLAUDE.md` (quy ước frontend), đánh dấu `plan.md`.
  - Hoàn thành khi: Playwright xanh trên bộ dev; mọi kiểm tra của web và API xanh.
- [ ] **Bước 15: Thông báo API sang tiếng Anh** (task Giai đoạn 2, dời ra sau demo vì frontend hiện câu theo `code`)
  - Việc:
    - Mọi `message` của `ApiError`, các lỗi chung trong `app/core/errors.py`, lỗi validate tự viết (con trỏ, từ khóa tìm kiếm) chuyển sang tiếng Anh.
    - `docs/api.md`: các ví dụ JSON lỗi.
    - Ví dụ domain trong code, tài liệu, `.env.example` đổi sang `vdrama.com`.
    - Docstring, chú thích và lệnh CLI cho người vận hành giữ tiếng Việt.
  - Hoàn thành khi:
    - Có test quét mã nguồn: không chuỗi `message` nào của `ApiError` còn ký tự tiếng Việt.
    - Test cũ so sánh câu thông báo được cập nhật.
    - ruff, pytest xanh.

## Rủi ro

- **Next 16 + `cacheComponents` còn mới**, khác nhiều so với các bản trước: mỗi bước đọc tài liệu đi kèm trước khi code; build có thể báo lỗi về chỗ đọc dữ liệu nằm ngoài `<Suspense>`.
- **Chưa thử Cloudflare Stream thật**: player làm trên luồng HLS mẫu. Khi có tài khoản phải thử lại với URL có token: cùng định dạng HLS nên ít rủi ro, nhưng vẫn cần thử.
- **Ảnh poster hiện là ảnh giữ chỗ** (`picsum.photos` trong `seed-demo`): `next/image` cần khai báo domain ảnh; khi chuyển sang R2 (Giai đoạn 4) thì đổi.
- **Màn hình Preview bị hiểu nhầm là đã chạy thật**: luôn có nhãn Preview; QR mẫu không chứa số tài khoản thật.
- **Admin phần lớn là Preview**: sếp có thể tưởng admin đã quản lý được phim, user, thanh toán. Nhãn Preview đặt ở đầu từng trang admin tĩnh, README ghi rõ phần nào thật, phần nào chờ Giai đoạn 4.
- **Tài khoản demo**: chỉ tạo khi `ENV` khác `prod`, mật khẩu lấy từ biến môi trường, domain `example.com` không nhận email thật.
- **Logo tách từ JPG**: viền có thể hơi mềm ở cỡ rất lớn. Đủ dùng cho web; khi in ấn hoặc làm banner lớn thì cần bản vector.

## Quyết định đã chốt khi duyệt (2026-10-29)

1. Trang VIP và thanh toán: giao diện tĩnh có nhãn Preview, giá mẫu; chưa thêm `GET /plans` (làm ở Giai đoạn 5).
2. Dev chưa có Stream: dùng `NEXT_PUBLIC_DEV_SAMPLE_HLS` (chỉ bản dev).
3. Playwright: chạy local ở Bước 11, đưa vào CI sau.
4. Kiểu dữ liệu API: viết tay theo `docs/api.md`.
5. Logo: đã tách nền trong suốt từ JPG; vẫn nên xin team bản SVG.
6. Thứ tự: demo trước, thông báo API tiếng Anh dời xuống cuối (Bước 15).
7. Demo gồm cả admin (đủ trang; phần chưa có API là Preview) và dữ liệu mẫu tiếng Anh có 3 tài khoản demo (bổ sung 2026-10-29).
