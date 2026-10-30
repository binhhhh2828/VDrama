# Plan: Xử lý ảnh poster (admin up một ảnh, hệ thống ra đúng các cỡ)

> Trạng thái: đã duyệt 2026-10-30; Bước 1–2 xong, Bước 3–4 chưa làm
> Liên quan: Giai đoạn 4 trong `plan.md` ("Nơi lưu poster/banner", admin CRUD). Giao diện người xem: `docs/plans/gd3-netshort-ui.md`.

## Mục tiêu và phạm vi

- Mục tiêu: admin chỉ cần up **một** ảnh poster; backend tự kiểm tra, cắt bỏ viền thừa, rồi tạo ra các bản đúng khung mà giao diện cần, giống cách NetShort dùng ảnh. 5 poster tiếng Việt trong `apps/web/public/poster/vdrama_5_posters.zip` được xử lý bằng chính bộ này và đưa vào bản demo, thay ảnh giữ chỗ cũ.
- Không làm (ngoài phạm vi, để plan sau): nơi lưu thật trên Cloudflare R2 (cần tài khoản), ô upload ở trang admin (API chưa có CRUD series, xem "Câu hỏi còn mở"), poster cho từng tập, ảnh động.

## Điều đã tìm hiểu (cơ sở để chốt quyết định)

- **Giao diện NetShort dùng ảnh 3:4 cho mọi thứ**: thẻ phim nhỏ (≈118 px, hiển thị 3 thẻ/màn), poster ở trang giới thiệu, và hero trang chủ (rộng hết màn, cao hơn một chút). Không có ảnh ngang 16:9 cho phim dọc. VDrama đã theo đó: thẻ 3:4, hero 3:4, kết quả tìm kiếm 3:4.
- **5 ảnh trong zip đều 1024×1536 (2:3) nhưng phần tranh thật không chiếm hết khung**: ảnh 01 chỉ có tranh ở giữa (≈ x 165–857), hai bên là nền nhòe; ảnh 05 có tranh ở trên (≈ y 0–921), bên dưới là nền đen. Tranh thật có tỉ lệ khác nhau (≈ 0,45 và ≈ 0,66), đều **hẹp hơn 3:4 (0,75)**. Nếu cắt thẳng ảnh gốc ra 3:4 sẽ lấy cả phần viền nhòe/đen, còn nếu chỉ cắt giữa thì mất chữ tên phim ở gần đáy ảnh.
- Hệ quả: bộ xử lý phải (1) nhận ra và bỏ viền thừa, (2) đưa tranh về 3:4 theo cách không cắt mất tên phim.
- Admin API hiện chỉ có upload video (`routers/admin_stream.py`); chưa có endpoint tạo/sửa series. `series` đã có cột `poster_url`, `banner_url` (chuỗi URL), chưa có chỗ cho bản thứ ba.

## Quyết định (đề xuất, chờ bạn duyệt)

| Bản | Dùng ở đâu | Tỉ lệ / cỡ | Ghi vào |
|---|---|---|---|
| `thumb` | thẻ phim, hàng cuộn ngang, lưới 3 cột, kết quả tìm kiếm, lịch sử | 3:4, **360×480** (đủ nét cho màn 3×) | `series.poster_url` (giữ nghĩa cũ) |
| `detail` | trang giới thiệu phim, trang xem (nếu cần) | 3:4, **720×960** | cột mới `series.poster_detail_url` |
| `hero` | băng chuyền trang chủ | 3:4, **900×1200** (hiển thị rộng hết màn) | `series.banner_url` (giữ nghĩa cũ) |

- Định dạng ra **WebP chất lượng 82** (nhẹ hơn JPEG khoảng 30%, mọi trình duyệt hiện đại đều hỗ trợ, cả Safari iOS 14+). Không giữ EXIF/metadata. Tên file có mã băm nội dung (`<series_id>-<hash>/thumb.webp`) để đổi ảnh là đổi URL, cache lâu dài được.
- Cách đưa tranh về 3:4 (theo thứ tự):
  1. Cắt viền thừa (nền đen/trắng đồng màu hoặc nền nhòe) bằng cách đo độ "chi tiết" từng cột/hàng ở sát mép; chỉ cắt khi vùng tranh còn lại ≥ 50% diện tích và hai mép rõ ràng. Không chắc thì không cắt.
  2. Tranh có tỉ lệ trong khoảng 0,60–0,82 (gần 3:4): **cắt vừa khung (cover)**, lệch về phía trên để giữ khuôn mặt, nhưng chừa phần đáy chứa tên phim.
  3. Tranh hẹp hơn (như 2 ảnh trên, 9:16): **đặt tranh nguyên vẹn vào giữa khung 3:4, hai bên là chính ảnh đó phóng to và làm nhòe tối** (đúng kiểu ảnh gốc đang có), không cắt mất chữ.
  4. Tranh rộng hơn 0,82: cắt hai bên giữ giữa.
- Giới hạn và an toàn: chỉ nhận JPEG/PNG/WebP (xác định bằng giải mã thật, không tin đuôi file hay `Content-Type`); tối đa 10 MB; tối thiểu 600×800 (nhỏ hơn thì báo lỗi, vì phóng to sẽ vỡ nét); chặn ảnh có quá nhiều điểm ảnh (chống "decompression bomb"); bản `hero` không phóng to quá 1,6 lần ảnh gốc.
- Thư viện: **Pillow** (đủ cho cắt, thu phóng, làm nhòe, WebP; không cần numpy). Xử lý chạy trong thread để không chặn event loop (cùng cách `core/security.py` làm với argon2).
- Lưu trữ: lớp `ImageStore` trừu tượng với bản **lưu ra thư mục** (dev, bản demo) trước; bản **R2** viết khi có tài khoản Cloudflare, không đổi phần còn lại.

## Quy cách ảnh admin nên upload (để poster không bị nền nhòe hay cắt mất chữ)

- **Tỉ lệ 3:4 (dọc)**, khuyến nghị **1200×1600 px**; tối thiểu 600×800. JPEG, PNG hoặc WebP, tối đa 10 MB.
- **Không tự thêm viền** (đen, trắng, nền nhòe) quanh tranh: bộ xử lý tự phát hiện và cắt viền, nhưng ảnh đúng 3:4 sát mép là chuẩn nhất.
- **Chữ tên phim nằm trong vùng giữa** (cách mép khoảng 8% mỗi bên, cách đáy 10%) vì ảnh đôi khi bị cắt một ít để vừa khung.
- Bộ xử lý báo cách đưa tranh vào khung (`fit`): `exact` (đúng 3:4, tốt nhất), `cover` (lệch quá 3%, bị cắt bớt), `blur` (tranh quá hẹp như 9:16, phải độn nền nhòe hai bên). Admin UI/endpoint (Bước 4–5) hiện cảnh báo "nên up ảnh 3:4" khi `fit` khác `exact`; lệnh `poster-build` đã in cảnh báo này.
- Poster demo (cập nhật 2026-10-30): giữ 2 ảnh cũ gần 3:4 (Vương Phi Không Dễ Chọc, Nhà Có Ba Chàng Trai) và thêm 3 ảnh mới đúng 3:4 (Tiên Duyên Kỳ Ngộ, Hoa Tuyết Rơi Đầy Trời, Kiếm Khách Tình Duyên); 3 ảnh cũ 9:16 (Sói Về Đòi Món Nợ, Tổng Tài, Bí Mật Trong Bóng Tối) đã bỏ vì hero bị nền nhòe hai bên. **Bản demo còn 5 phim công khai + 1 bản nháp**, mỗi phim một poster, slug theo tên phim; thumbnail mọi tập là poster dọc của phim. Ảnh mới có biểu tượng ngôi sao nhỏ của công cụ tạo ảnh ở góc phải dưới, nên cắt bỏ khi dùng thật.
- Bộ cắt viền đã chỉnh: dải viền mỏng hơn 7% mỗi cạnh được giữ (gradient tối ở đáy poster từng bị cắt nhầm làm mất dòng chữ phụ).

## File/module bị ảnh hưởng

- Mới: `apps/api/app/services/poster_images.py`, test `apps/api/app/tests/test_poster_images.py`, `apps/api/app/services/image_store.py`.
- Sửa: `apps/api/pyproject.toml` (thêm Pillow), `apps/api/app/cli.py` (lệnh `poster-build`), `apps/api/app/models/catalog.py` + migration `0012` (cột `poster_detail_url`), `apps/api/app/schemas/catalog.py`, `docs/api.md`.
- Bản demo web: `apps/web/public/demo/posters/<slug>/{thumb,detail,hero}.webp`, `apps/web/src/lib/demo/art.ts`, `data.json`, `art.test.ts`, `types.ts`.

## Các bước

- [x] **Bước 1: Bộ xử lý ảnh (chỉ hàm thuần, chưa có endpoint)** — xong 2026-10-30: `app/services/poster_images.py`, 19 test trong `test_poster_images.py`, lệnh `poster-build`. Khác plan: hero là **900×1200** (ảnh nguồn chỉ cao 920 px nên 1080×1440 phải phóng quá 1,5 lần), giới hạn phóng to 1,6 lần, cắt vừa khung khi tỉ lệ 0,60–0,82 (lệch về phía đáy để giữ tên phim), diện tích tranh tối thiểu để cắt viền 25%.
  - Việc cần làm: `process_poster(data: bytes) -> {thumb, detail, hero}` (bytes WebP) và các lỗi riêng (`PosterTooSmall`, `PosterInvalid`, `PosterTooLarge`) theo quy tắc ở trên; test bằng ảnh tổng hợp tạo trong test (viền đen dưới, viền nhòe hai bên, đúng 3:4, quá nhỏ, file không phải ảnh, ảnh giả đuôi `.jpg`, ảnh quá lớn).
  - Tiêu chí hoàn thành: `uv run pytest app/tests/test_poster_images.py` pass; mọi bản ra đúng cỡ và tỉ lệ 3:4; ảnh có viền được cắt, ảnh không viền thì giữ nguyên.
- [x] **Bước 2: Chạy trên 5 poster thật và đưa vào bản demo** — xong 2026-10-30: 5 poster xử lý vào `apps/web/public/demo/posters/<khóa>/`; **cả 11 phim demo dùng 5 poster xoay vòng** (theo yêu cầu), 5 phim đầu đổi tên/mô tả/thể loại theo poster (slug giữ nguyên); `PosterArt` chỉ in chữ đè lên ảnh giữ chỗ picsum; bỏ review riêng gắn tên phim cũ.
  - Việc cần làm: lệnh `uv run python -m app.cli poster-build <file> --out <thư mục>`; chạy cho 5 ảnh trong zip; xem kết quả bằng mắt (tên phim không bị cắt, viền thừa biến mất); lưu vào `apps/web/public/demo/posters/<slug>/`; đổi `art.ts` để 5 phim demo đầu dùng ảnh này (thumb cho thẻ, hero cho băng chuyền, detail cho trang giới thiệu), đổi tên và mô tả 5 phim sang đúng tên trên poster (`data.json`); bỏ chữ tên phim in đè (`PosterArt`) cho những phim đã có poster thật vì ảnh đã có chữ; 6 phim còn lại giữ ảnh giữ chỗ cũ.
  - Tiêu chí hoàn thành: trang chủ, `/browse`, tìm kiếm, trang giới thiệu và trang xem hiển thị 5 poster đúng khung ở 320/390/440 px, không tràn; test demo cập nhật pass; `pnpm lint/typecheck/test/build` pass.
- [ ] **Bước 3: Cột mới và lưu trữ**
  - Việc cần làm: migration `0012` thêm `series.poster_detail_url`; schema API trả thêm trường này; `ImageStore` bản thư mục; test migration (up/down) và test schema.
  - Tiêu chí hoàn thành: `alembic upgrade head` / `downgrade -1` chạy; `alembic check` sạch; `test_*_schema.py` mới pass.
- [ ] **Bước 4: Endpoint admin upload poster**
  - Việc cần làm: `POST /api/v1/admin/series/{id}/poster` (multipart, `AdminUser`, CSRF theo quy ước, rate limit, ghi `audit_logs` trong cùng transaction, lý do `require_reason()`); xử lý ảnh trong thread, lưu 3 bản, cập nhật 3 URL; ảnh cũ được xóa sau khi commit thành công; mã lỗi mới thêm vào `ErrorCode` và bảng trong `docs/api.md`.
  - Tiêu chí hoàn thành: test API (admin được, viewer/guest bị chặn, ảnh hỏng, ảnh nhỏ, ảnh quá lớn, series không tồn tại); `test_permissions.py` vẫn pass.
- [ ] **Bước 5 (sau, khi có R2 và CRUD series): ô upload ở trang admin + `ImageStore` R2**
  - Chỉ làm khi bạn có tài khoản Cloudflare R2 và khi endpoint tạo/sửa series đã có.

## Rủi ro

- Phát hiện viền nhòe có thể sai với ảnh có nền mờ là một phần nghệ thuật (ví dụ ảnh xóa phông) → mặc định thận trọng (không cắt nếu không chắc), kèm test và xem bằng mắt 5 ảnh thật; sau này có thể thêm khung cắt tay ở trang admin.
- Ảnh tên phim ở sát đáy: cắt cover có thể lẹm chữ → quy tắc chừa đáy ở mục 2 và kiểm tra bằng mắt.
- Pillow là thư viện dễ bị tấn công qua file ảnh độc hại → giới hạn kích thước/điểm ảnh, chỉ 3 định dạng, cập nhật phiên bản thường xuyên.

## Câu hỏi còn mở

- Bạn duyệt bảng 3 bản (360×480, 720×960, 900×1200, WebP) chứ? Nếu cần chữ "ảnh nhỏ nhất admin được up" khác 600×800 thì nói mình.
- Đổi tên 5 phim demo đầu sang tiếng Việt theo poster (giao diện vẫn là tiếng Anh), hay giữ tên tiếng Anh và chỉ thay ảnh? (Đề xuất: đổi tên, vì chữ trên poster là tên thật.)
- Bước 1–2 làm trước (không cần hạ tầng mới); bước 3–4 làm tiếp sau khi bạn xem kết quả bước 2 — bạn đồng ý thứ tự này không?
