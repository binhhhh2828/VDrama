# Plan: Giao diện web mobile-first theo phong cách NetShort

> Trạng thái: **chờ duyệt** (2026-10-29). Làm trên nhánh mới `feat/netshort-ui` (cắt từ `feat/frontend` sau khi PR của nhánh đó được xử lý, xem mục "Nhánh và PR").
> Liên quan: `docs/design.md` (hệ thiết kế hiện tại, sẽ được cập nhật), `docs/plans/gd3-frontend.md` (Bước 1–13 đã xong), `docs/plans/gd3-netlify-demo.md` (bản demo Netlify).
> Nguồn tham khảo: web NetShort (netshort.com), xem ngày 2026-10-29 ở khung 390px và 1440px.

## Mục tiêu

Sếp thích giao diện NetShort. Làm **web ưu tiên điện thoại** có cấu trúc, bố cục và cảm giác dùng giống NetShort, nhưng **thương hiệu, nội dung, màu sắc là của VDrama**. Làm frontend trước (chạy được trên bản demo Netlify), chưa đụng backend.

**Chỉ lấy ý tưởng bố cục và cách dùng**, không sao chép: logo, hình ảnh, tên phim, câu chữ, mã nguồn của NetShort. Màu, logo, font, nhãn đều của VDrama (ví dụ nhãn "Exclusive" của họ thành "VDrama Original").

## NetShort đang làm gì (quan sát được)

**Điện thoại (390px)**
- Thanh trên cùng gọn: nút menu (hamburger), logo, ô tìm kiếm dạng viên thuốc, ảnh đại diện. Không có thanh điều hướng dưới đáy.
- Trang chủ: ảnh hero **tràn khung, rất cao** (gần hết màn hình), tên phim + nút "Play Now" ở dưới, chấm báo trang.
- Dưới hero là **các hàng poster cuộn ngang**: Trending Now, New Releases, Highly Recommended, Exclusive Originals, Dramas to Watch. Mỗi thẻ: poster **dọc 2:3** bo góc lớn (rộng ~68% khung, thẻ kế bên thò ra để mời vuốt), dưới là tên phim in đậm (tối đa 2 dòng), dòng nhỏ xám là thể loại ngăn bằng dấu chấm tròn. Tiêu đề hàng cỡ lớn, đậm.
- Nền xám rất tối, gần đen, phẳng; điểm nhấn đỏ hồng; chữ Poppins.
- **Trang phim = trang xem** (không có trang chi tiết riêng): breadcrumb Home / Genres / tên phim; trình phát **dọc 9:16** sát hai mép; dưới là "Tên EP 1", số lượt thích và lưu, hàng chip thể loại, Synopsis cắt ngắn, hàng "Recommended for you", "For You". Thanh "Download App" dính đáy.

**Máy tính (1440px)**
- Thanh trên: logo, Home, Genres, Download, Blog, ô tìm kiếm, chọn ngôn ngữ, tài khoản.
- Hero là băng chuyền kiểu coverflow (poster giữa lớn, hai bên nhỏ dần), nút trái/phải, chấm bên dưới.
- Các hàng poster có mũi tên trái/phải ở mép.
- Trang xem: trình phát dọc ở giữa (nền đen hai bên, nút đóng, nút tập trước/sau), **cột bên phải**: tên tập, lượt thích/lưu, chip thể loại, synopsis, "Episode list" chia theo khoảng (1–30, 31–60...) với lưới nút số tập.

## VDrama hiện tại so với NetShort

| Phần | VDrama hôm nay | Cần đổi |
|---|---|---|
| Header + điều hướng điện thoại | Logo + tìm kiếm + nút, **thanh dưới đáy** 4 mục | Hamburger + logo + ô tìm kiếm + avatar, **ngăn kéo menu**, bỏ thanh dưới đáy (mục Home/Browse/My List/Account vào ngăn kéo và menu avatar) |
| Hero trang chủ | Băng chuyền ngang 16:9, chữ đè lên | Điện thoại: ảnh dọc tràn khung, cao; máy tính: coverflow |
| Hàng phim | Lưới và hàng nhỏ | Hàng cuộn ngang, poster lớn, tên + thể loại bên dưới |
| Thẻ phim | Poster nhỏ, nhãn TOP/FREE | Poster 2:3 bo lớn, nhãn "VDrama Original", thể loại bên dưới |
| Trang chi tiết phim `/series/[slug]` | Trang riêng, poster 200px + nút | Gộp vào trang xem hoặc làm lại theo mẫu (xem câu hỏi 4) |
| Trang xem | Trình phát **16:9**, danh sách tập bên dưới/bên phải | Trình phát **dọc 9:16**; máy tính có cột phải với thông tin + lưới số tập chia khoảng |
| Màu, font | Nền #0B0709 (hơi tím), Inter | Xám tối trung tính, font hình học kiểu Poppins (miễn phí, giấy phép OFL) |
| Thanh mời | Không có | Thanh dính đáy mời **Get VIP** ở trang xem (thay cho "Download App") |

## Điều tôi cần bạn chốt (đã ghi mặc định, không trả lời thì làm theo mặc định)

1. **Video của VDrama là dọc (9:16) hay ngang (16:9)?** Mặc định: **dọc 9:16** như NetShort. Nếu là ngang thì giữ 16:9 và chỉ đổi bố cục xung quanh. *Bản demo hiện dùng một video mẫu ngang, nên trong khung dọc sẽ bị cắt giữa (`object-cover`); khi có video dọc thật thì thay là xong.*
2. **Ảnh poster**: ảnh giữ chỗ hiện nay (picsum, ảnh phong cảnh ngẫu nhiên) sẽ làm giao diện nhìn kém hơn NetShort rất nhiều, vì sức hút của họ nằm ở poster dọc có chữ. Bạn đã có poster AI cho 12 phim mẫu chưa? Mặc định: **tôi tạo poster giữ chỗ bằng SVG** (nền chuyển màu theo thể loại + tên phim cỡ lớn), nhìn có chủ đích hơn picsum. Có ảnh thật thì bỏ vào `public/demo/posters/`, thay một dòng cấu hình.
3. **Thanh điều hướng dưới đáy trên điện thoại**: NetShort không có, chỉ có hamburger. Mặc định: **bỏ**, theo NetShort. Bỏ thì tìm My List / Account sâu hơn một chạm; muốn giữ để dễ dùng một tay thì nói, mình giữ (chỉ là một component).
4. **Trang `/series/[slug]`**: NetShort chỉ có trang xem. Mặc định: **giữ route này nhưng làm giống trang xem tập 1 / tập đang xem dở** (cùng bố cục, vào là thấy trình phát và danh sách tập), để link chia sẻ và SEO vẫn có trang riêng mà trải nghiệm giống NetShort.
5. **Lượt "thích"**: API chưa có (chỉ có "lưu vào My List", `favorite_count`). Mặc định: hiện **số lượt lưu thật** (My List), chưa làm nút thích.

## Các bước (mỗi bước một commit, làm xong dừng cho bạn xem, mobile-first: thiết kế ở 390px rồi mới mở rộng)

- [ ] **Bước R0: Tài sản demo (poster, nhãn)**
  - Việc: bộ tạo poster SVG 2:3 theo thể loại cho 11 phim mẫu (chỉ dùng ở bản demo, không đổi dữ liệu thật); sửa `data.json` trỏ poster/banner dọc; nhãn "VDrama Original".
  - Hoàn thành khi: mọi phim ở bản demo có poster dọc nhìn được, không còn ảnh picsum ở bản demo.
- [ ] **Bước R1: Nền thiết kế mới**
  - Việc: đổi token màu sang xám tối trung tính, giữ hồng–cam làm điểm nhấn; đổi font (Poppins qua `next/font`); bo góc, cỡ tiêu đề, khoảng cách theo NetShort; cập nhật `docs/design.md` và trang `/dev/ui`.
  - Hoàn thành khi: toàn site đổi tông nhưng chưa vỡ bố cục; quét 360–440px không tràn ngang.
- [ ] **Bước R2: Khung trang (header, ngăn kéo menu)**
  - Việc: header điện thoại (hamburger, logo, ô tìm kiếm, avatar), ngăn kéo menu (Home, Genres, My List, VIP, đăng nhập/đăng xuất, thể loại), header máy tính có đủ điều hướng; bỏ `BottomNav` (theo câu hỏi 3); trang xem dùng header riêng + breadcrumb.
  - Hoàn thành khi: ngăn kéo mở/đóng bằng bàn phím và chạm, có `aria`, khóa cuộn nền; vùng bấm ≥ 44px.
- [ ] **Bước R3: Thẻ phim và hàng cuộn ngang**
  - Việc: `PosterCard` mới (2:3, tên 2 dòng, thể loại ngăn dấu chấm), `PosterRow` cuộn ngang có `scroll-snap`, thẻ kế bên thò ra, mũi tên ở máy tính; tiêu đề hàng cỡ lớn.
  - Hoàn thành khi: vuốt mượt trên điện thoại, mũi tên chạy trên máy tính, không tràn ngang.
- [ ] **Bước R4: Trang chủ**
  - Việc: hero dọc tràn khung (điện thoại) và coverflow (máy tính) với "Play Now"; các hàng Trending Now, New Releases, Highly Recommended, VDrama Originals, Continue watching, theo thể loại, dùng `PosterRow`.
  - Hoàn thành khi: trang chủ nhìn giống bố cục NetShort ở 390px và 1440px; vẫn lấy dữ liệu thật từ catalog.
- [ ] **Bước R5: Trang xem (trình phát dọc + cột phải)**
  - Việc: trình phát 9:16 tràn mép điện thoại, nút đóng và tập trước/sau trên máy tính; dưới trình phát: "Tên EP n", số lượt lưu, chip thể loại, Synopsis cắt ngắn mở rộng được, hàng "Recommended for you"; máy tính có cột phải với lưới số tập chia khoảng (1–30, 31–60...) và tập khóa VIP có ổ khóa; thanh dính đáy mời Get VIP khi chưa có VIP; giữ nguyên nhớ tiến độ, đoạn "Up next", bảo vệ VIP.
  - Hoàn thành khi: xem được tập free, tập VIP mời mua, tiến độ lưu đúng; chạy ở 360–440px và 1440px.
- [ ] **Bước R6: Trang phim `/series/[slug]`, Genres, tìm kiếm**
  - Việc: `/series/[slug]` theo bố cục trang xem (câu hỏi 4); trang Genres (chip thể loại + lưới poster); tìm kiếm dạng ô viên thuốc có gợi ý.
  - Hoàn thành khi: duyệt theo thể loại, tìm kiếm, mở phim đều chạy trên điện thoại và máy tính.
- [ ] **Bước R7: Tài khoản, VIP, đăng nhập theo tông mới + deploy**
  - Việc: `/account/*`, `/vip`, đăng nhập/đăng ký, thanh toán Preview đổi theo token mới; admin chỉ đổi theo token (không thiết kế lại); quét toàn site 360–440px và 1440px; deploy bản demo lên Netlify, cập nhật README.
  - Hoàn thành khi: mọi kiểm tra web xanh; luồng người xem và admin vẫn chạy đủ; bản Netlify mới chạy.

## Ngoài phạm vi (lần này)

- Backend: chưa thêm "thích", chưa đổi API, chưa tạo thêm trường poster.
- Admin: không thiết kế lại (chỉ đổi màu theo token).
- Ứng dụng di động, mã QR tải app, blog, đa ngôn ngữ của NetShort: không làm.
- Video dọc thật và poster AI thật: khi bạn có thì thay vào, không nằm trong code.

## Nhánh và PR

- Phần đã làm (Bước 1–13 frontend, bản demo Netlify, responsive) nằm trên `feat/frontend`: 17 commit, 152 file. Nên **mở PR vào `main` trước**, rồi cắt `feat/netshort-ui` từ đó: giao diện mới sẽ sửa gần như mọi file của frontend, PR riêng giúp xem diff gọn và dễ quay lại nếu sếp không ưng.
- Mỗi bước R là một commit; cả cụm R0–R7 là một PR thứ hai.
