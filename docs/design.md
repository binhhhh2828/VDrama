# Hệ thiết kế VDrama

Nguồn: bố cục **NetShort mobile web** (23 ảnh chụp iPhone, số đo ở `docs/plans/gd3-netshort-ui.md`; chốt 2026-10-29, thay canvas [VDrama Web Design](https://claude.ai/artifact/Kto2QDvHNF4qtuLEAXUja2) cũ). Chỉ lấy bố cục, nhịp điệu, màu; thương hiệu, nội dung và chữ là của VDrama. Code nằm ở `apps/web/src/app/globals.css` (token) và `apps/web/src/components/ui/` (thành phần). Xem trực tiếp mọi thành phần ở `http://localhost:3000/dev/ui` khi chạy `pnpm dev`.

Giao diện **chỉ có nền tối**, **hai ngôn ngữ English và Tiếng Việt** (mọi chữ nằm ở `src/lib/i18n/dictionaries/`, xem mục Đa ngôn ngữ cuối file), **mobile-first** (viết cho 360–430 px trước).

## Màu

Dùng qua class Tailwind (`bg-surface`, `text-muted`, `border-line`...), không gõ mã màu trong component.

| Token | Mã | Dùng cho |
|---|---|---|
| `canvas` | `#141414` | Nền trang chính |
| `canvas-black` | `#000000` | Nền trang xem, bảng danh sách tập |
| `surface` | `#252525` | Ngăn kéo, thẻ đánh giá, panel |
| `surface-2` | `#2A2A2A` | Chip, ô tìm kiếm, ô số tập |
| `surface-3` | `#333333` | Nhãn thể loại chỉ đọc (`GenreTag`), hover của chip |
| `line` | `#383838` | Đường kẻ (divider), viền 1px |
| `fg` | `#F3F3F3` | Chữ chính, tiêu đề |
| `fg-soft` | `#D6D6D6` | Đoạn văn dài, chữ chip |
| `muted` | `#828282` | Dòng thể loại, breadcrumb, meta. Ảnh đo được `#7D7D7D`; nâng nhẹ để đạt tương phản 4.5:1 trên `canvas` |
| `faint` | `#5F5F5F` | Placeholder, chữ nút tắt |
| `accent` | `#F4305E` | Nút chính, chip/mục đang chọn, nút lên đầu trang, tập đang xem |
| `on-accent` | `#FFFFFF` | Chữ trên `accent` và các nền chuyển sắc. Tương phản ~3.9:1: chỉ dùng chữ đậm (≥ 600) |
| `link` / `link-hover` | `#F4305E` / `#FF7A96` | Link, viền focus |
| `ink` | `#141414` | Chữ tối trên nền sáng (nút trắng, thanh mời app bản sáng) |
| `vip` / `vip-ink` | `#F6C781` / `#4B3625` | **Chỉ cho VIP**: chữ vàng trên nền tối; chữ nâu trên thẻ vàng. Viền `vip-line` `#6B5536` |
| `wallet` | `#2B262C` | Thẻ thứ hai ở trang tài khoản (thay thẻ Ví) |
| `plum` / `plum-2` / `plum-3` | `#2F111D` / `#4C1623` / `#381624` | Nền tím mận: đỉnh trang tài khoản / đỉnh bảng VIP / khung giới thiệu phim |
| `cta-orange` | `#FF8225` | Điểm cuối của nút "Watch now" |
| `success` | `#4FD6A0` | Nhãn FREE, thông báo thành công |
| `error` / `error-soft` | `#FF6B6B` / `#FF8F8F` | Viền ô lỗi / chữ lỗi |

Nền chuyển sắc (`@utility` trong `globals.css`):

| Class | Giá trị | Dùng cho |
|---|---|---|
| `bg-brand` (`bg-brand-x`) | `#F4305E → #FE4F32` (90°) | Nút "Play now" ở kết quả tìm kiếm, nhãn TOP, thanh tiến độ |
| `bg-cta` | `#CE6A9E → #FF8225` | Nút "Watch now" ở trang giới thiệu phim |
| `bg-vip-gold` | `#FCDEA0 → #F6C781` | Thẻ VIP ở trang tài khoản |
| `bg-plum-fade` | `#2F111D → canvas` (dọc) | Nền đỉnh trang tài khoản |
| `bg-hot` | `#FF5A36 → #D8261F` | Nhãn HOT |
| `bg-art` | nền tối có quầng accent | Thay ảnh khi phim chưa có poster |

## Chữ

- **Be Vietnam Pro** (OFL), nạp bằng `next/font/google` (tự host), độ đậm 400–900, bộ ký tự latin + latin-ext + vietnamese. Dùng cho cả hai ngôn ngữ để chữ không đổi dáng khi chuyển. Đã bỏ Poppins vì không có bộ tiếng Việt (dấu ạ, ợ, ế lệch nét). Biến CSS `--font-body` (khai ở `src/lib/site-fonts.ts`).
- Tiêu đề trang ≈ 28px · 700; tiêu đề hàng trang chủ ≈ 24px · 600; tiêu đề hàng ở trang xem ≈ 16px · 700.
- Tên phim trong thẻ ≈ 15px/17px · 600, tối đa 2 dòng; dòng thể loại ≈ 12px `muted`, ngăn bằng " • ".
- Thân 15px / 1.6 `fg-soft`.

## Hình khối và khoảng cách

- Bo góc: thẻ poster, chip 10px (`rounded-card`, `rounded-chip`) · panel, bottom sheet 24px (`rounded-panel`) · hero 24px (`rounded-hero`) · ô nhập 12px (`rounded-input`) · nhãn 4px (`rounded-tag`) · nhãn thể loại 16px (`rounded-2xl`) · nút, ô tìm kiếm tròn hẳn (`rounded-full`).
- Poster **3:4**, hero trang chủ **4:5**, player **9:16** (dọc); thumbnail tập cũ 16:9.
- Số đo từng màn hình (header 58px, thẻ hàng cuộn 117px, lề trái 22px...) nằm ở bảng của `docs/plans/gd3-netshort-ui.md`.
- **Vùng bấm tối thiểu 44px**, kể cả khi hình nhìn nhỏ hơn: thêm class `hit-44` (phần tử phải `relative`). `Button size="xs"` nhìn 30px, `Chip` nhìn 33px, đều bấm được 44px.

## Thành phần (`src/components/ui/`)

| Thành phần | Ghi chú |
|---|---|
| `Button`, `ButtonLink` | `primary` (viên thuốc `accent`), `gradient` (`bg-brand`), `cta` (`bg-cta`), `secondary` (viền mờ), `vip` (vàng), `ghost`, `danger`; cỡ `md` (48px) / `sm` (44px) / `xs` (nhìn 30px, bấm 44px). Điều hướng dùng `ButtonLink`, hành động dùng `Button` |
| `Badge` | `hot` (đỏ gạch, nghiêng, ngọn lửa), `original` (nhãn nhỏ `accent` ở poster), `top`, `vip`, `free`, `new`, `preview` |
| `Chip`, `GenreTag` | Chip lọc chữ nhật bo 10, nền `surface-2`, đang chọn nền `accent`; nhãn thể loại chỉ đọc bo 16 nền `surface-3` |
| `PosterArt` | Ảnh 3:4 hoặc 4:5 có tên phim in đè (cho ảnh giữ chỗ không có chữ); `withTitle={false}` khi poster đã có chữ |
| `PosterCard` | Thẻ phim 3:4 bo 10, tên phim in đè ảnh (`PosterArt`), dưới là tên 15px tối đa 2 dòng (`variant="row"` 600, `"grid"` 400) và thể loại xám ngăn " • "; nhãn TOP/NEW trái, VIP phải, ORIGINAL ở đáy |
| `PosterRow` (`components/series`) | Hàng cuộn ngang: thẻ rộng `(100vw-76px)/3` (≈118 ở 430), gap 10, lề trái 22, thò thẻ thứ 4, tràn hai mép trang |
| `AuthFlow` (`components/auth`) | Màn hình đăng nhập/đăng ký (ảnh 21): provider Google/Apple (Preview), "Continue with email", ô đồng ý điều khoản dùng chung qua `useTerms()` |
| `VipPanel`, `VipSheetProvider` (`components/vip`) | Bảng VIP: nội dung dùng cho bottom sheet (mở bằng `useVipSheet().open()`) và cho trang `/vip` trên điện thoại; hộp thoại `<dialog>` bo trên 24, tay nắm vuốt xuống để đóng |
| `Breadcrumb` (`components/layout`) | "Home > Series > tên phim" chữ xám 15px, mục cuối sáng và xuống dòng; caller tự bọc lề |
| `GenreChips`, `SearchResultList` (`components/series`) | Chip thể loại nhiều dòng có nút mở rộng (Series); kết quả tìm kiếm dạng danh sách có tô từ khớp (Search) |
| `PosterGrid` (`components/series`) | Lưới 3 cột gap 10 trên điện thoại, từ `sm` tự chia cột 170px+ |
| `EpisodeThumb` | 16:9, nút play giữa (ổ khóa nếu chưa có quyền), tiến độ ở chân, nhãn FREE/VIP |
| `ProgressBar` | 0–1; có `label` thì là `progressbar` cho trình đọc màn hình |
| `Skeleton`, `PosterGridSkeleton` | Giữ chỗ khi chờ dữ liệu |
| `Field` | Nhãn + ô nhập + lỗi (`aria-invalid`, `aria-describedby`) |
| `icons.tsx` | Icon nét 24×24, `currentColor`, luôn `aria-hidden` (`FlameIcon`, `PlayIcon` là icon đặc) |
| `brand/Logo` | `full` hoặc `icon`, truyền `height` |

## Màn hình Preview (chưa có API)

Chức năng chưa có backend (thanh toán, quên mật khẩu, xác thực email) làm giao diện tĩnh để demo. Bắt buộc:

- Nhãn `<Badge kind="preview" />` ở đầu màn hình kèm một câu giải thích (ví dụ "Payments are not live yet.").
- Không gửi dữ liệu đi đâu, không báo thành công giả. Nút hành động chính bị tắt.
- Dữ liệu mẫu chỉ nằm ở `src/lib/preview-data.ts`.

## Logo

File trong `apps/web/public/brand/` (PNG nền trong suốt, tách từ 2 file JPG nền đen gốc ngày 2026-10-29):

| File | Dùng cho |
|---|---|
| `logo-horizontal.png` | Header, footer (nền tối) |
| `logo-stacked.png` | Trang đăng nhập, màn hình chào (nền tối) |
| `logo-icon.png` | Chỗ hẹp, ảnh đại diện mạng xã hội |
| `logo-horizontal-on-light.png`, `logo-stacked-on-light.png` | Nền sáng: email, tài liệu, hóa đơn (chữ màu `#16060D`) |

Favicon, icon 512 và Apple icon nằm ở `apps/web/src/app/` (`favicon.ico`, `icon.png`, `apple-icon.png`), Next.js tự gắn thẻ.

Cách tách nền: độ sáng thành độ trong suốt (đen → trong suốt hẳn, quầng sáng → bán trong suốt, chữ trắng → đặc), nên đặt lên nền tối vẫn giữ hiệu ứng phát sáng. Logo bản ngang không đặt lên nền sáng (chữ trắng). Khi team gửi file vector (SVG) thì thay vào; bản tách từ JPG đủ dùng cho web, chưa đủ cho in ấn khổ lớn.

## Khả năng truy cập

- Mọi thứ bấm được đều tới được bằng phím Tab; viền focus 2px màu `link`.
- Icon trang trí có `aria-hidden`; nút chỉ có icon phải có `aria-label`.
- Không truyền đạt thông tin chỉ bằng màu (ổ khóa đi kèm nhãn VIP, lỗi đi kèm chữ).

## Đa ngôn ngữ (English, Tiếng Việt)

Kế hoạch và quyết định: [docs/plans/gd4-i18n.md](plans/gd4-i18n.md).

- **URL:** tiếng Anh ở gốc (`/series/a`), tiếng Việt có tiền tố (`/vi/series/a`). `src/proxy.ts` (quy tắc ở `lib/i18n/routing.ts`, có test) rewrite địa chỉ gốc sang `/en/...`, chuyển `/en/...` về địa chỉ gốc, và chuyển người dùng có cookie `NEXT_LOCALE` hoặc trình duyệt tiếng Việt sang `/vi`. Admin và `/dev` nằm ngoài (nhóm `app/(internal)`, chỉ tiếng Anh, không tiền tố).
- **Từ điển:** `lib/i18n/dictionaries/en.ts` là bản gốc và sinh kiểu `Dictionary`; `vi.ts` phải có đúng các khóa nên thiếu khóa là lỗi biên dịch. Chuỗi có tham số viết `{tên}`; số nhiều viết `{ one, other }`. Test kiểm tra đủ khóa, không rỗng, `{tham_số}` khớp và bản dịch không trùng bản gốc (trừ thuật ngữ giữ nguyên).
- **Dùng trong code:** client component `useT()` / `useLocale()`; server component `getServerT(lang)` với `lang` từ `params`; tiêu đề tab `titleMetadata("khóa")`. Liên kết và điều hướng **phải** dùng `Link`, `useRouter`, `usePathname` của `@/components/i18n/navigation` (tự thêm `/vi`); có test chặn `next/link` thô ngoài admin.
- **Định dạng:** `lib/format.ts` nhận `locale` (thời lượng, ngày, số, VND). Lỗi API dịch theo mã lỗi qua `lib/i18n/api-errors.ts`. Tên thể loại dịch theo `slug` (`genreLabel`), tên tập mặc định "Episode N" thành "Tập N".
- **Thêm ngôn ngữ mới:** thêm mã vào `LOCALES` và tên vào `LOCALE_INFO` (`lib/i18n/config.ts`); tạo `dictionaries/<mã>.ts` thỏa kiểu `Dictionary` và đăng ký ở `dictionaries/index.ts`; thêm khối cùng cấu trúc trong `lib/legal-content.ts`; kiểm tra font có bộ ký tự của ngôn ngữ đó. Nếu mã mới có thể bị nhầm với một đoạn đường dẫn thì kiểm tra `splitLocale`.
- **Chưa dịch (là dữ liệu, không phải giao diện):** tên, mô tả và review phim. Khi có phim thật cần bản dịch cho từng phim (backend: cột/ bảng bản dịch), tách thành plan riêng.
- Trang pháp lý (Terms, Privacy, Refunds) mới là cấu trúc và phần giữ chỗ, cả hai bản cần luật sư duyệt.
