# Hệ thiết kế VDrama

Nguồn: canvas [VDrama Web Design](https://claude.ai/artifact/Kto2QDvHNF4qtuLEAXUja2) (7 bảng: trang chủ, chi tiết phim, xem phim, VIP, đăng nhập, mobile, style guide). Code nằm ở `apps/web/src/app/globals.css` (token) và `apps/web/src/components/ui/` (thành phần). Xem trực tiếp mọi thành phần ở `http://localhost:3000/dev/ui` khi chạy `pnpm dev`.

Giao diện **chỉ có nền tối**, **tiếng Anh**, mobile-first.

## Màu

Dùng qua class Tailwind (`bg-surface`, `text-muted`, `border-line`...), không gõ mã màu trong component.

| Token | Mã | Dùng cho |
|---|---|---|
| `canvas` | `#0B0709` | Nền trang |
| `surface` | `#150E12` | Ô nhập, chip, thẻ |
| `surface-2` | `#1F1419` | Bề mặt lớp 2, skeleton, nút tắt |
| `line` | `#36252D` | Viền 1px |
| `fg` | `#F7EFF2` | Chữ chính |
| `fg-soft` | `#E7D6DC` | Đoạn văn dài |
| `muted` | `#B5A2AA` | Chữ phụ, meta |
| `faint` | `#8A7880` | Placeholder, chữ nút tắt |
| `link` | `#FF6FA3` | Link, viền focus (hover `#FFB3CF`) |
| `pink` / `orange` | `#FF3D7F` / `#FF8A3D` | Điểm nhấn (gạch dưới menu đang chọn, viền tập đang xem) |
| `bg-brand` | `#FF2E7E → #FF7A3D` (135°) | Nút chính, nhãn TOP, thanh tiến độ (`bg-brand-x`, 90°) |
| `ink` | `#16060D` | **Chữ trên nền gradient** (tương phản ~5.7:1; không dùng chữ trắng) |
| `vip` / `vip-ink` | `#FFC247` / `#2B1D00` | **Chỉ cho VIP**: nút, nhãn, menu VIP. Khung VIP: `bg-vip-panel` + viền `vip-line` |
| `success` | `#4FD6A0` | Nhãn FREE, thông báo thành công |
| `error` / `error-soft` | `#FF6B6B` / `#FF8F8F` | Viền ô lỗi / chữ lỗi |

## Chữ

- **Inter** (100% sans-serif, chốt 2026-10-29), nạp bằng `next/font/google` (tự host, không gọi Google lúc chạy). Có bộ `vietnamese` vì tên phim hiện là tiếng Việt.
- Tên phim lớn: 900, `tracking-[-0.02em]`, 56–72px (desktop), 40–48px (mobile).
- Tiêu đề trang 800 · 28px; tiêu đề mục 800 · 22–24px.
- Thân 400 · 16px / 1.6; meta 400 · 13px `muted`; menu 500 · 15px.

## Hình khối và khoảng cách

- Bo góc: hero 24px (`rounded-hero`) · panel 18–20px (`rounded-panel`) · thẻ 14px (`rounded-card`) · ô nhập, thumbnail nhỏ 10–12px (`rounded-input`) · nhãn 6px (`rounded-tag`) · nút, chip, ô tìm kiếm tròn hẳn (`rounded-full`).
- Lưới 4px. Giữa các mục trang chủ 48px, giữa các thẻ 20px (mobile 16px). Lề hai bên 16px trên điện thoại, 24px từ `sm`. Khung nội dung tối đa 1360px.
- Poster **2:3**; thumbnail tập và player **16:9**.
- Vùng bấm tối thiểu **44px** (`Button size="sm"` = 44px, `md` = 48px).

## Thành phần (`src/components/ui/`)

| Thành phần | Ghi chú |
|---|---|
| `Button`, `ButtonLink` | `primary` (gradient), `secondary` (viền mờ), `vip` (vàng), `ghost`, `danger`; cỡ `md`/`sm`. Điều hướng thì dùng `ButtonLink`, hành động thì `Button` |
| `Badge` | `top`, `vip`, `free`, `new`, `original`, `preview` |
| `Chip`, `GenreTag` | Chip lọc (link, có trạng thái đang chọn); nhãn thể loại chỉ đọc |
| `PosterCard` | Poster 2:3, TOP/NEW trái, VIP phải, tên đè chân ảnh; không có ảnh thì nền `bg-art` |
| `EpisodeThumb` | 16:9, nút play giữa (ổ khóa nếu chưa có quyền), tiến độ ở chân, nhãn FREE/VIP |
| `ProgressBar` | 0–1; có `label` thì là `progressbar` cho trình đọc màn hình |
| `Skeleton`, `PosterGridSkeleton` | Giữ chỗ khi chờ dữ liệu |
| `Field` | Nhãn + ô nhập + lỗi (`aria-invalid`, `aria-describedby`) |
| `icons.tsx` | Icon nét 24×24, `currentColor`, luôn `aria-hidden` |
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
