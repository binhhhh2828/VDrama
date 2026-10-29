# Plan: Giao diện web mobile-first giống NetShort (bản chuẩn theo ảnh chụp iPhone)

> Trạng thái: **đã duyệt, đang làm** (2026-10-29, bản 3: thêm 4 ảnh, chốt tiếng Anh và cách làm poster). Thay bản nháp trước (làm từ khung trình duyệt máy tính, nhiều điểm sai: poster là 3:4 và nhỏ chứ không phải 2:3 lớn).
> Nhánh làm việc: `feat/netshort-ui` (cắt từ `main` sau khi PR #5 đã merge).
> Nguồn: 23 ảnh chụp Safari trên iPhone của netshort.com, đã đặt tên và cất ở `docs/reference/netshort/mobile/` (xem mục "Ảnh tham chiếu"). Số đo bên dưới lấy từ chính các ảnh đó.
> Liên quan: `docs/design.md`, `docs/plans/gd3-frontend.md` (Bước 1–13), `docs/plans/gd3-netlify-demo.md` (demo Netlify).

## Mục tiêu

Làm **web ưu tiên điện thoại** có bố cục, nhịp điệu, màu và cách thao tác **giống NetShort mobile web**, nhưng **thương hiệu, nội dung, chữ là của VDrama** (logo, tên phim, poster, câu chữ, mã nguồn của họ không dùng lại). Làm frontend trước, chạy trên bản demo Netlify; chưa đụng backend.

Cách kiểm tra "giống": mỗi bước dừng lại, chụp VDrama ở khung 430×932 (iPhone Pro Max, cỡ của ảnh tham chiếu), 390×844 và 360×740, đặt cạnh ảnh tham chiếu tương ứng và đối chiếu bảng số đo ở dưới. Không có sai lệch so với bảng thì bước đó mới xong.

## Ảnh tham chiếu (đã đặt tên)

Thư mục: `docs/reference/netshort/mobile/`. Ảnh rộng 869 px (riêng ảnh 01 rộng 995 px) tương ứng khoảng **430 px CSS** (gấp ~2,02 lần; ảnh 01 gấp ~2,31). Các số "CSS px" bên dưới đã chia sẵn, sai số ±2 px.

| Ảnh | Màn hình | Nội dung chính |
|---|---|---|
| 01 | Trang chủ, đầu trang | Header trong suốt đè lên hero; hero 4:5 tràn khung; tên phim + nhãn HOT; nút "Phát ngay"; chấm báo trang; tiêu đề hàng đầu tiên |
| 02 | Trang chủ, giữa trang | Hàng "Phim ngắn hot", "Mới ra mắt"; thanh mời tải app dính đáy; nút lên đầu trang |
| 03 | Trang chủ, giữa trang | Hàng "Đoán bạn thích", "Độc quyền" (nhãn ĐỘC QUYỀN trên poster) |
| 04 | Trang chủ, cuối trang | Hết hàng cuối; chân trang (accordion Về / Liên hệ / Tập, nút tải app, mạng xã hội, bản quyền) |
| 05 | Ngăn kéo menu | Panel trái 82% bề rộng, 4 mục + chọn ngôn ngữ, màn phủ tối |
| 06, 19 | Tài khoản (khách) | Avatar + "Visitor" + UID; thẻ VIP vàng; thẻ Ví; "Liên hệ chúng tôi" (19 là lần chụp thứ hai, gần như trùng 06) |
| 07 | Tài khoản (khách), cuối | Nút "Đăng nhập" hồng to; chân trang |
| 08 | Bảng nạp (bottom sheet) | Hai gói VIP (tuần/năm), 4 gói xu, nút Apple Pay / thẻ |
| 09 | Bảng nạp, phần dưới | Quyền lợi VIP, hướng dẫn nạp |
| 10 | Trang xem | Breadcrumb; player **dọc 9:16**; thanh điều khiển; dải "Toàn tập" |
| 11 | Trang xem, dưới player | Tên tập, lượt thích/lưu, chip thể loại, tóm tắt, chia sẻ, hàng "Đề xuất cho bạn" |
| 12 | Trang xem, dưới nữa | "Đề xuất mới nhất", "Xem trước phim mới lên sóng", mở đầu "Đánh giá tập này" |
| 13, 14 | Trang xem, cuối | Các thẻ "Đánh giá tập này" (bài đánh giá có tiêu đề + đoạn văn), chân trang |
| 15 | Trang giới thiệu phim | Khung tím: tên phim, "Tổng N tập", nút chọn ngôn ngữ, nút "Xem ngay", poster trong khung điện thoại |
| 16 | Tin tức ("Thông tin") | Thẻ bài viết: ảnh bìa, nhãn, ngày • tác giả, tiêu đề, trích đoạn |
| 17 | Trang tải app | Trang quảng bá app (4.7★, 100M+, ...) |
| 20 | Tài khoản (đã đăng nhập) | Tên thật thay "Visitor"; vẫn thẻ VIP + Ví; thêm hàng "Xóa tài khoản"; nút "Đăng xuất" ở đáy |
| 21 | Đăng nhập | Toàn màn hình tối: nút quay lại, logo + câu giới thiệu, nút Google (xám), nút Apple (trắng) có nhãn "đăng nhập gần đây", ô đồng ý điều khoản + 2 liên kết ở đáy |
| 22 | Kết quả tìm kiếm | Danh sách dọc: poster 3:4 lớn bên trái; bên phải tên phim (từ khớp tô màu nhấn), mô tả 3 dòng, chip thể loại, nút "Phát ngay" |
| 23 | Danh sách tập (bottom sheet) | Sheet đen bo trên, tab khoảng tập (1–30, 31–35), nút X, "Toàn tập", lưới 6 cột số tập; tập đang xem tô `accent` có biểu tượng thanh nhạc; tập khóa có ổ khóa góc |
| 18 | Phim bộ (duyệt) | Tiêu đề lớn, nhóm chip thể loại có nút mở rộng, lưới 3 cột |

## Bảng số đo và token (lấy từ ảnh)

**Màu** (lấy mẫu pixel):

| Token | Giá trị | Dùng cho |
|---|---|---|
| `canvas` | `#141414` | nền trang chính (ảnh 02, 18) |
| `canvas-black` | `#000000` | nền trang xem (ảnh 11) |
| `surface` | `#252525` | ngăn kéo, thẻ đánh giá, panel (05, 13) |
| `surface-2` | `#272727` – `#2A2A2A` | chip, ô tìm kiếm (02, 18) |
| `divider` | `#383838` | đường kẻ ngăn kéo (05) |
| `accent` | `#F4305E` | nút chính, chip đang chọn, mục đang chọn, nút lên đầu trang (≈`#F23D60`) |
| `text` / `text-muted` | `#F3F3F3` / `#7D7D7D` | tiêu đề / dòng thể loại, breadcrumb |
| `vip-gold` | `#FCDEA0` → `#F6C781` (chuyển sắc) | thẻ VIP (06) |
| `vip-ink` | `#4B3625` | nút "Kích hoạt" trên thẻ VIP |
| `wallet` | `#2B262C` | thẻ Ví (06) |
| `hero-plum` | `#2F111D` → đen (trang tài khoản), `#4C1623` (đỉnh bảng nạp), `#381624` (khung giới thiệu phim) | nền nhấn tím mận |
| `cta-orange` | `#FF8225` (+ tím `#CE6A9E` ở đầu trái) | nút "Xem ngay" chuyển sắc tím → cam (15) |
| `badge-hot` | đỏ gạch, chữ trắng nghiêng, có "ngọn lửa" | nhãn HOT cạnh tên phim ở hero (01) |

**Chữ**: họ hình học kiểu **Poppins** (nạp qua `next/font`, giấy phép OFL, miễn phí). Tiêu đề hàng ≈ 24 px, đậm vừa (600); tên phim trong thẻ ≈ 15 px/17 px, 600, tối đa 2 dòng có dấu ba chấm; dòng thể loại ≈ 12 px/13 px, xám, ngăn bằng " • ", tối đa 2 dòng; tiêu đề trang "Khám phá thể loại & phim ngắn" ≈ 28 px đậm.

**Khung và khoảng cách** (CSS px, màn 430):

| Thành phần | Số đo |
|---|---|
| Header | cao ≈ 58; hamburger trái (x≈15); logo (biểu tượng ≈20×20 + chữ); **ô tìm kiếm viên thuốc** cao 36, rộng ≈183, nền `surface-2`; avatar tròn ≈28 sát phải (cách mép ≈17). **Không có nền riêng**: nội dung cuộn qua phía sau (ảnh 04 thấy poster chạy dưới header) |
| Hero (01) | ảnh **4:5 tràn hai mép**, cao ≈ 528; dưới ảnh: tên phim (đậm ≈15, giữa) + nhãn HOT; nút "Phát ngay" viên thuốc `accent`, rộng ≈56% khung, cao ≈30 (vùng bấm thực phải ≥ 44); chấm báo trang: đang chọn là thanh trắng dài, còn lại là chấm xám |
| Hàng cuộn ngang | lề trái 22; **thẻ rộng ≈117, tỉ lệ poster 3:4 (cao ≈155)**, bo ≈10; khoảng cách giữa thẻ 10; **hiện 3 thẻ + thò thẻ thứ 4**; tiêu đề hàng thụt vào ≈43 (sâu hơn thẻ); khoảng cách tiêu đề → thẻ ≈ 50; giữa hai hàng ≈ 84 |
| Thanh mời app (02) | dính đáy, cách mép 7, cao ≈ 52, bo ≈12, nền xám sáng `#CECECE` chữ tối; biểu tượng app 28; nút "Get" `accent` cao ≈28 rộng ≈59, bo 4; trang xem (10) dùng **bản tối** (viền, chữ "Quét mã để tải APP", nút "Tải APP") và có nút **X tròn** để tắt |
| Nút lên đầu trang (02) | tròn ≈40, `accent`, mũi tên trắng, cách mép phải 17, nổi **ngay trên** thanh mời app |
| Ngăn kéo (05) | rộng ≈82% màn (≈355), nền `surface`, đầu: logo + nút X; mỗi mục **cao ≈81**, biểu tượng đường nét 24, chữ ≈20, mục đang chọn màu `accent`; đường kẻ `divider` thụt hai bên ≈14; mục cuối: chọn ngôn ngữ (mở xuống); nền sau phủ tối |
| Tài khoản (06) | header riêng: nút quay lại + logo ở giữa; nền chuyển sắc `hero-plum` → đen; avatar tròn ≈72 + "Visitor" ≈28 đậm + "UID:…" xám có nút sao chép; thẻ VIP bo lớn, "Netshort VIP / Đặc quyền riêng", nút "Kích hoạt" tối bo tròn, 4 quyền lợi xếp 2×2 có biểu tượng; thẻ Ví `wallet`, nút "Nạp tiền" chuyển sắc hồng → cam, hai số lớn màu hổ phách ("Xu", "Xu Tặng"); hàng "Liên hệ chúng tôi" có biểu tượng tai nghe + mũi tên |
| Bảng nạp (08, 09) | trượt từ đáy, bo trên lớn, đỉnh chuyển sắc `#4C1623`; hàng đầu: "Số dư" + biểu tượng hỗ trợ + X; 2 thẻ gói chữ vàng, thẻ chọn có viền vàng; dòng nhỏ "Tự động gia hạn, có thể hủy bất cứ lúc nào"; lưới 2×2 gói xu có nhãn góc phải (+56%, +100%) nền `accent`; danh sách quyền lợi; hướng dẫn nạp (4 ý); hai nút trắng (Apple Pay, thẻ) |
| Trang xem (10, 11) | breadcrumb "Trang chủ > Phim bộ > tên phim (chữ thường)"; **player dọc 9:16 ở giữa, hai bên nền đen** (ảnh: rộng ≈315, cao ≈560); trên player: nút X tròn góc trái, hai nút chevron lên/xuống tròn ở mép phải (tập trước/sau), nút phát tròn ở giữa; hàng điều khiển dưới: phát, "00:08", thanh tua mảnh có núm, "02:56", PiP, âm lượng, toàn màn hình; **dải "Toàn tập • tên phim >"** (biểu tượng lớp, mở danh sách tập); panel bo trên ≈24, nền `#242424`: "Tên … Tập 1", ♥ lượt thích + 🔖 lượt lưu (viết gọn 2.1K, 6.0K), chip thể loại (nền `#343434`, bo ≈16), "Tóm tắt nội dung" (cắt 2 dòng + mũi tên mở rộng), hàng nút chia sẻ (Facebook, X, Instagram, nút sao chép liên kết màu hồng) |
| Đề xuất (11, 12) | tiêu đề hàng nhỏ hơn trang chủ (≈16 đậm, thụt ≈13); thẻ rộng ≈122 (to hơn một chút), cùng kiểu thẻ |
| "Đánh giá tập này" (12–13) | tiêu đề lớn ≈26 đậm + "Xem thêm" bên phải; mỗi thẻ nền `surface`, bo ≈14, có **tiêu đề bài** (≈16) + đoạn văn ≈14, xám sáng |
| Chân trang (04, 14) | đường kẻ; ba hàng accordion "Về", "Liên hệ chúng tôi", "Tập" (chữ ≈18, mũi tên xuống); "Tải APP" + hai nút trắng (App Store, Google Play); hàng 4 biểu tượng mạng xã hội tròn; dòng bản quyền xám |
| Duyệt Phim bộ (18) | breadcrumb; tiêu đề 28 đậm; tiêu đề phụ "Tất cả các tập" 24; **chip hình chữ nhật bo ≈10** (không phải viên thuốc), cao ≈33, nền `surface-2`, chip đang chọn nền `accent`; chip xếp nhiều dòng, dòng thứ 3 có **nút tròn mũi tên** mở rộng; **lưới 3 cột**, thẻ 3:4, khoảng cách ≈10; tên phim **chữ thường (400)** 2 dòng, thể loại xám |
| Kết quả tìm kiếm (22) | ô tìm kiếm giữ nguyên ở header, chứa từ khóa; mỗi kết quả là một hàng: **poster 3:4 rộng ≈171** (bo ≈10) bên trái, cột phải: tên phim ≈20 đậm, **phần khớp từ khóa tô `accent`**; mô tả ≈15 xám, cắt **3 dòng**; chip thể loại hình chữ nhật bo ≈16 nền `#2E2E2E`, chữ xám nhỏ, các thể loại nối bằng dấu phẩy; nút "Phát ngay" cuối cột, rộng ≈180, cao ≈30, nền chuyển sắc `#F4305E` → `#FE4F32`, biểu tượng ▶; hàng cách nhau ≈26; nhãn ĐỘC QUYỀN nhỏ ở đáy poster nếu có |
| Danh sách tập (23) | bottom sheet nền **đen `#000`**, bo trên ≈24, dưới player (player vẫn thấy ở trên); tiêu đề "Danh sách tập" ≈16; hàng tab: "1 - 30" (đang chọn: chữ và **gạch chân `accent`**) và "31 - 35", nút X, bên phải "Toàn tập ›"; đường kẻ; **lưới 6 cột**, ô **cao ≈33, bo ≈6**, nền `#272727`, số ≈14 đậm giữa ô, khoảng cách ≈7; **tập đang xem: nền `accent` + biểu tượng 3 thanh nhạc thay cho số**; **tập khóa: ổ khóa nhỏ ở góc trên phải ô**, nền hơi tối hơn `#232323`; mở/đóng bằng nút X, chạm nền, vuốt xuống |
| Đăng nhập (21) | **toàn màn hình** nền `#141414` bo trên; chỉ có nút quay lại (trái trên); khối giữa (cách đỉnh ≈175): biểu tượng app ≈48 bo lớn + tên + câu giới thiệu xám nhỏ "Sau khi đăng nhập, mở ra hành trình dành riêng cho bạn"; 2 nút **viên thuốc cao ≈46, rộng ≈325**: "Đăng nhập bằng Google" nền `#303030`, "Đăng nhập bằng Apple" nền trắng chữ đen; nhãn nhỏ nền hồng góc phải trên nút Apple ("Đăng nhập gần đây"); đáy: ô tròn đồng ý + câu "Nếu bạn tiếp tục đăng nhập, tức là bạn đồng ý Thỏa thuận Người dùng và Chính sách Quyền riêng tư" (hai liên kết gạch chân) |
| Tài khoản đã đăng nhập (20) | như khách (06) nhưng: tên thật thay "Visitor"; sau "Liên hệ chúng tôi" có thêm **hàng "Xóa tài khoản"** (biểu tượng người + dấu cấm, mũi tên); nút **"Đăng xuất"** viền, bo tròn, nằm sát đáy (trên thanh mời app); thanh mời app vẫn dính đáy |
| Trang giới thiệu phim (15) | khung bo ≈36 nền `hero-plum`; tên, "Tổng 35 tập, Đã cập nhật hết", chip ngôn ngữ, nút "Xem ngay" tím → cam bo lớn, poster trong khung điện thoại (khung là trang trí của họ, không bắt chước) |

## NetShort khác bản nháp cũ ở đâu (đã chỉnh trong plan này)

1. Thẻ poster **nhỏ và 3:4** (3 thẻ/màn), không phải poster to 2:3 chiếm 68% khung.
2. Header **trong suốt**, nội dung cuộn dưới nó; chỉ ô tìm kiếm có nền.
3. Có **thanh mời app dính đáy** và **nút lên đầu trang** ở hầu hết trang.
4. Trang xem: player dọc **không tràn mép**; hai bên đen. Nút tập trước/sau là chevron tròn ở mép phải player.
5. Có **bài "Đánh giá tập này"** (nội dung biên tập), tài khoản có **Ví/xu**, trang tin tức, trang tải app: ngoài phạm vi hoặc làm bản tĩnh (xem dưới).
6. Giao diện của họ hiển thị **tiếng Việt** theo ngôn ngữ máy của bạn; VDrama dùng **tiếng Anh** (đã chốt, đa ngôn ngữ làm sau).

## Đã chốt và mặc định còn lại

**Bạn đã chốt (2026-10-29):**

1. **Ngôn ngữ: tiếng Anh** (web làm cho thị trường nước ngoài). Mọi chữ giao diện người xem dùng tiếng Anh, viết thẳng như hiện tại; **đa ngôn ngữ làm sau**. Chuỗi hiển thị mới vẫn gom vào một chỗ (`src/lib/copy.ts`) để sau này dịch được, nhưng không làm chọn ngôn ngữ ở bước nào của plan này. Ngăn kéo menu **không có** mục chọn ngôn ngữ (ảnh 05 có, mình bỏ).
2. **Poster: không cần ảnh AI ngay, gọi dịch vụ ảnh của bên thứ ba.** Cách làm: poster 3:4 và banner 4:5 lấy từ `picsum.photos` (đã được phép trong `next.config.ts`), mỗi phim một `seed` cố định để ảnh không đổi giữa các lần tải; **tên phim in đè bằng chữ của VDrama** (font tiêu đề, bóng đổ, nằm ở 1/3 dưới poster, như poster có chữ nghệ thuật của NetShort) cộng lớp tối chuyển sắc để chữ đọc được. Khi có poster AI thật chỉ thay URL trong dữ liệu, không đổi code.
3. **Quy trình**: bạn xem từng bước; chỗ nào **khung giao diện bạn thấy ưng**, bạn gửi thêm ảnh để mình làm demo sát hơn.

**Mặc định còn lại (không trả lời thì làm như vậy):**

4. **Video dọc 9:16**. Video mẫu hiện là ngang nên trong khung dọc sẽ bị cắt giữa (`object-cover`) đến khi có video dọc thật.
5. **Ví/xu**: chỉ làm **VIP** theo bố cục bảng nạp (ảnh 08, 09): ba gói (1, 3, 12 tháng), quyền lợi, hướng dẫn, nút thanh toán (Preview); **không làm xu**. Thẻ "Ví" ở trang tài khoản đổi thành thẻ "My VIP / History / My List".
6. **Trang giới thiệu phim (ảnh 15)** làm cho `/series/[slug]`; trang xem tập là `/series/[slug]/episode/[n]`.
7. **Thanh mời app**: VDrama chưa có app nên thanh dính đáy mời **"Get VIP"** (có nút X tắt); giữ nút lên đầu trang.
8. **Đăng nhập (ảnh 21)**: giữ đúng bố cục, nhưng VDrama đang đăng nhập bằng **email + mật khẩu** (API thật), nên màn hình có thêm nút **"Continue with email"** mở biểu mẫu email/mật khẩu; hai nút **Google** và **Apple** vẫn vẽ đúng như ảnh nhưng là **Preview** (chưa có API), có nhãn rõ, bấm không gửi gì. Ô đồng ý điều khoản bắt buộc tick trước khi đăng nhập/đăng ký.
9. **Bài "Đánh giá tập này"** (ảnh 12–14): bản **tĩnh (Preview)**, văn bản mẫu cho vài phim. **Tin tức** (ảnh 16): bản tĩnh ở bước cuối. **Trang tải app** (ảnh 17): bỏ.
10. **Lượt thích ♥**: API chưa có (chỉ có lưu vào My List = 🔖). Hiện 🔖 thật; ♥ chỉ hiện ở bản demo (số mẫu cố định) và **ẩn ở bản chạy API thật**.
11. **"Xóa tài khoản"** (ảnh 20): giao diện làm đủ (hỏi xác nhận, bắt nhập mật khẩu) nhưng là **Preview**, chưa có API.

## Các bước (mỗi bước một commit, mobile-first: viết CSS cho 360–430 px trước rồi mới mở rộng; làm xong dừng cho bạn xem)

Mỗi bước dùng cùng quy tắc kiểm tra: lint, type-check, format, test, build xanh; quét không tràn ngang ở 320/360/390/430/440 px; chụp ở 430×932 đặt cạnh ảnh tham chiếu và đối chiếu bảng số đo; vùng bấm thực ≥ 44 px dù hình nhìn nhỏ hơn (nút "Phát ngay" 30 px nhìn thấy, 44 px bấm được).

- [x] **R0: Tài sản demo (poster 3:4, banner 4:5, nhãn, dữ liệu phụ)** — xong 2026-10-29: `src/lib/demo/art.ts` (URL), `src/lib/demo/extras.ts` (nhãn, ♥, reviews), `src/components/ui/PosterArt.tsx`, `data.json` trỏ URL mới (mọi phim có banner), test `art.test.ts`, xem ở `/dev/ui` mục "Demo posters". `PosterArt` chưa gắn vào trang nào (R3, R4 gắn).
  - Việc: bộ dựng URL ảnh `picsum.photos/seed/<slug>/600/800` (poster 3:4) và `/seed/<slug>-hero/800/1000` (hero 4:5) cho mọi phim ở bản demo; thành phần `PosterArt` in tên phim lên poster (chữ trắng, bóng đổ, lớp tối chuyển sắc ở dưới); nhãn "HOT" và "Original"; số ♥ mẫu và vài bài "Reviews" mẫu (chỉ trong dữ liệu demo); `data.json` trỏ sang các URL đó.
  - Hoàn thành khi: mọi phim ở bản demo có poster 3:4 và banner 4:5 có chữ, nhìn như poster; ảnh không đổi giữa các lần tải; bản chạy API thật không đổi.
- [x] **R1: Nền thiết kế mới (token, font, thành phần cơ bản)** — xong 2026-10-29: token mới trong `globals.css` (đổi giá trị token cũ nên cả site đổi tông; `pink` đổi tên thành `accent`; thêm `on-accent`, `surface-3`, `plum*`, `wallet`, nền `bg-cta`, `bg-vip-gold`, `bg-hot`, `bg-plum-fade`, tiện ích `hit-44`), Poppins, `Button` thêm `gradient`/`cta`/cỡ `xs`, `Chip` chữ nhật, `Badge` `hot`/`original` mới, `src/lib/copy.ts`, `docs/design.md`, `/dev/ui`. `muted` nâng từ `#7D7D7D` lên `#828282` để đạt 4.5:1; chữ trắng trên `accent` chỉ 3.9:1 nên chỉ dùng chữ đậm.
  - Việc: đổi token theo bảng màu; nạp Poppins; thêm `Chip` chữ nhật bo 10, nút chính viên thuốc, nút chuyển sắc, nhãn HOT / Original; cập nhật `docs/design.md` và `/dev/ui`; tạo `src/lib/copy.ts` cho chuỗi mới (tiếng Anh).
  - Hoàn thành khi: toàn site đổi tông, chưa vỡ bố cục; bảng token trong `docs/design.md` khớp bảng ở trên.
- [x] **R2: Khung trang (header trong suốt, ngăn kéo, thanh mời, nút lên đầu trang, chân trang)** — ảnh 01, 02, 04, 05 — xong 2026-10-29: `SiteHeader` + `HeaderBar` (58px, sticky, trong suốt, lớp tối khi cuộn; ô tìm kiếm 183×36 đúng ảnh), `MenuDrawer` (`<dialog>` gốc: 82%, mục 81px, đóng bằng X/Esc/nền phủ/vuốt trái/đổi trang, khóa cuộn, có mục Admin cho admin), `AccountArea` thành avatar 28px mở `/account` (bỏ menu thả xuống; Sign out nằm ở trang tài khoản), `FloatingDock` (thanh Get VIP sáng có X, nhớ đến khi đóng tab, ẩn với VIP và ở `/vip`; nút lên đầu trang 40px cách phải 17px), `SiteFooter` accordion `<details>`; bỏ `BottomNav`. Chân trang không có phần tải app và mạng xã hội (VDrama chưa có). Hàng accordion cao 44px (ảnh ≈36) để đủ vùng bấm.
  - Làm sớm phần hero của R4 theo yêu cầu (2026-10-29): `HeroCarousel` tràn hai mép, 4:5, kéo lên nằm dưới header trong suốt (`-mt-[58px]`), vuốt bằng `scroll-snap` (mỗi lần một phim), tự chuyển 6 giây, tên phim + HOT (demo), nút "Play now" 240×30, chấm báo trang thanh trắng; desktop là các thẻ 4:5 rộng 400px xếp ngang. Phần còn lại của R4 (các hàng phim) vẫn chưa làm.
  - Việc: header 58 px không nền (nội dung cuộn dưới, chỉ ô tìm kiếm có nền; thêm lớp tối nhẹ khi cuộn để chữ đọc được); ngăn kéo 82% (Home, Browse, My List, VIP, Account (không có chọn ngôn ngữ); đóng bằng X, vuốt, phím Esc, chạm nền; khóa cuộn; `aria`); thanh mời Get VIP dính đáy (có X); nút lên đầu trang; chân trang accordion; bỏ `BottomNav`.
  - Hoàn thành khi: khớp số đo ảnh 05 (rộng ≈82%, mục cao ≈81, bỏ mục ngôn ngữ); ngăn kéo thao tác được bằng bàn phím và cảm ứng; chân trang đúng ảnh 04.
- [x] **R3: Thẻ phim, hàng cuộn ngang, lưới 3 cột** — ảnh 02, 03, 18 — xong 2026-10-29: `PosterCard` 3:4 (đổi prop `meta` thành `genres`, thêm `original`, `variant`), `PosterRow` mới, `PosterGrid` 3 cột, `PosterRowSkeleton`; trang chủ tạm dùng `PosterRow` cho "Trending now" và "New releases" (R4 làm tiếp tiêu đề và các hàng còn lại), MyList và `/dev/ui` đổi theo. Đo ở 430px: thẻ 118×157, gap 10, lề 22, thò 24px thẻ thứ 4.
  - Việc: `PosterCard` mới (3:4, bo 10, tên 2 dòng, thể loại ngăn " • "), `PosterRow` cuộn ngang `scroll-snap`, lề trái 22, thò thẻ thứ 4; `PosterGrid` 3 cột; nhãn góc.
  - Hoàn thành khi: ở 430 px thấy đúng 3 thẻ + phần thẻ thứ 4 thò ra; chữ cắt 2 dòng; vuốt mượt.
- [ ] **R4: Trang chủ** — ảnh 01–04
  - Việc: hero 4:5 tràn khung dưới header trong suốt, tên phim + HOT, "Phát ngay", chấm báo trang kiểu thanh dài; các hàng "Phim ngắn hot", "Mới ra mắt", "Đoán bạn thích", "Độc quyền" (và "Tiếp tục xem" khi có lịch sử) từ catalog thật.
  - Hoàn thành khi: trang chủ đúng ảnh 01–04 ở 430 px; hero vuốt được; dữ liệu vẫn thật (hoặc demo).
- [ ] **R5: Trang xem (player dọc) và các hàng đề xuất** — ảnh 10–14, 23
  - Việc: breadcrumb; player 9:16 ở giữa, hai bên đen; điều khiển (phát, thời gian, thanh tua, PiP, âm lượng, toàn màn hình), nút chevron tập trước/sau, nút X; dải "All episodes" mở **bảng danh sách tập** theo ảnh 23 (bottom sheet đen, tab khoảng 1–30 / 31–60..., lưới 6 cột, tập đang xem `accent` có biểu tượng thanh nhạc, tập VIP có ổ khóa, đóng bằng X / chạm nền / vuốt xuống); panel bo trên: tên + EP, ♥/🔖, chip thể loại, tóm tắt mở rộng được, nút chia sẻ; hàng "Đề xuất cho bạn / mới nhất / xem trước"; "Đánh giá tập này" (tĩnh); giữ nguyên nhớ tiến độ, màn hình VIP/đăng nhập, "Up next".
  - Hoàn thành khi: xem được tập free, tập VIP mời mua, tiến độ lưu đúng; đúng ảnh 10–11 ở 430 px; 3 lỗi của review (VIP gate cũ, tiến độ cũ, lưu khi rời tập) **được sửa trong bước này** vì đụng đúng các file này.
- [ ] **R6: Duyệt phim (Phim bộ), tìm kiếm, trang giới thiệu phim** — ảnh 18, 15, 22
  - Việc: `/browse` theo ảnh 18 (chip chữ nhật, nút mở rộng, lưới 3 cột); tìm kiếm: ô viên thuốc ở header và **trang kết quả dạng danh sách theo ảnh 22** (poster 3:4 lớn bên trái; tên phim có phần khớp tô `accent`; mô tả cắt 3 dòng; chip thể loại; nút "Play now" chuyển sắc); `/series/[slug]` theo ảnh 15 (khung tím mận, tổng tập, trạng thái, "Xem ngay", poster lớn, hàng đề xuất).
  - Hoàn thành khi: lọc thể loại, tìm kiếm, mở phim chạy trên điện thoại; khớp ảnh 15 và 18.
- [ ] **R7: Tài khoản và VIP** — ảnh 06–09, 20
  - Việc: `/account` theo ảnh 06 (header quay lại + logo, nền mận, avatar, thẻ VIP vàng "Activate", thẻ thay cho Ví, "Contact us"; **khách**: nút "Sign in" hồng to ở đáy; **đã đăng nhập (ảnh 20)**: tên thật, hàng "Delete account" (Preview), nút "Sign out" viền ở đáy); bảng VIP (bottom sheet) theo ảnh 08–09 thay trang `/vip` trên điện thoại (trang `/vip` vẫn có cho SEO/liên kết); My List và lịch sử đổi theo thẻ mới.
  - Hoàn thành khi: luồng khách → đăng nhập → mua VIP giả → xem tập VIP chạy đủ ở bản demo; khớp ảnh 06 và 08.
- [ ] **R8: Đăng nhập theo ảnh 21, tin tức (tĩnh), quét toàn site, deploy** — ảnh 21, 16
  - Việc: màn đăng nhập/đăng ký toàn màn hình theo ảnh 21 (nút Google/Apple là Preview, "Continue with email" mở biểu mẫu thật, ô đồng ý điều khoản); quên mật khẩu, đặt lại mật khẩu đổi theo token; trang News tĩnh (ảnh 16); admin chỉ đổi theo token; quét toàn site 320–440 px và 1440 px; deploy bản demo mới lên Netlify; cập nhật README.
  - Hoàn thành khi: mọi kiểm tra xanh; luồng người xem + admin chạy đủ; bản Netlify mới chạy; bạn duyệt đặt cạnh ảnh NetShort.

## Ảnh còn thiếu (không có thì làm theo mặc định)

Đã có đủ 4 ảnh quan trọng (danh sách tập, tìm kiếm, đăng nhập, tài khoản đã đăng nhập). Nếu tiện, các ảnh sau giúp sát hơn, không bắt buộc:

1. **Tìm kiếm khi vừa bấm vào ô** (chưa gõ: gợi ý/lịch sử) và **không có kết quả**.
2. **Tập bị khóa / mở khóa**: màn hình khi bấm vào tập có ổ khóa; và **cuối tập / chuyển tập**.
3. **Player khi chạm vào video**: nút điều khiển và nút lên/xuống chuyển tập.
4. **Hero ở slide thứ hai** (đang vuốt) và **chip thể loại ở trang Phim bộ khi mở rộng**.
5. **Chân trang khi mở từng accordion** (Về / Liên hệ / Tập).

## Ngoài phạm vi (lần này)

- Backend: chưa thêm "thích", ví/xu, đánh giá biên tập; chưa đổi API.
- Admin: không thiết kế lại (chỉ đổi theo token).
- Ứng dụng di động, trang tải app, blog thật, mã QR, đa ngôn ngữ ngoài Việt/Anh.
- Video dọc thật và poster AI thật: khi bạn có thì thay vào, không nằm trong code.

## Ghi chú về ảnh tham chiếu và bản quyền

Ảnh NetShort chứa poster, logo và nội dung có bản quyền của bên thứ ba. Chúng chỉ để **đối chiếu nội bộ** nên được cất ở `docs/reference/netshort/` và **đã thêm vào `.gitignore`** (không commit, không đưa lên GitHub hay Netlify). Plan và code chỉ mô tả bố cục và số đo, không dùng lại hình, chữ, logo, tên phim của họ.
