# Plan: Đa ngôn ngữ giao diện (English, Tiếng Việt) và menu đổi ngôn ngữ

> Trạng thái: đã duyệt 2026-10-30; Bước 1 xong
> Bối cảnh: sếp hướng tới thị trường nước ngoài (mặc định tiếng Anh), nhưng trước mắt cần bản tiếng Việt để nhà đầu tư người Việt xem hiểu. Giao diện người xem: `docs/plans/gd3-netshort-ui.md`. Ảnh poster: `docs/plans/gd4-poster-images.md`.

## Mục tiêu và phạm vi

- Mục tiêu: người xem đổi được giữa **English** và **Tiếng Việt** ở menu; mọi chữ của giao diện người xem (trang chủ, Series, tìm kiếm, giới thiệu phim, trang xem, VIP, Account, đăng nhập, News, Download, trang pháp lý) hiển thị đúng ngôn ngữ đã chọn. Thiết kế để **thêm ngôn ngữ thứ ba chỉ cần thêm một file từ điển** (ví dụ `id`, `th`).
- Không làm (ngoài phạm vi):
  - Khu admin (`/admin/*`) giữ tiếng Anh, chỉ nhân viên dùng.
  - Nội dung phim (tên, mô tả, review) vẫn là **một ngôn ngữ**: dữ liệu phim chưa có bản dịch. Việc cần backend (`series.title_vi`...) làm ở plan riêng khi có bản dịch thật; plan này chỉ dịch **tên thể loại** (theo mã `slug`).
  - Lời nhắn lỗi từ API (hiện bằng tiếng Việt do backend viết) sẽ đổi sang **ánh xạ theo mã lỗi** ở web, backend không đổi.
  - Dịch tự động trong trình duyệt; chữ ký hiệu tiền (VND/USD) và số liệu.

## Điều đã tìm hiểu

- Chữ hiện nằm rải rác: `lib/copy.ts` (60 dòng, tiếng Anh, 20 file dùng) cộng khoảng **62 file** khác có chữ viết thẳng trong JSX; khoảng **36 file** dùng `next/link` và ~90 chỗ có `href`/`router.push`/`redirect`.
- Next.js 16 (docs `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`): cách chuẩn là **đường dẫn có tiền tố ngôn ngữ** (`/vi/...`), thư mục `app/[lang]`, `proxy.ts` để chuyển hướng/rewrite, từ điển JSON tải ở server theo `lang`.
- Dự án bật `cacheComponents`: đọc `cookies()` ở server làm cả cây phía dưới thành động. Vì vậy **không** chọn cách "lưu ngôn ngữ trong cookie rồi server đọc" (mất prerender tĩnh, chậm hơn); dùng tiền tố đường dẫn thì mỗi ngôn ngữ vẫn được dựng sẵn tĩnh.
- Số, ngày, thời lượng trong `lib/format.ts` đang cố định `en-US` và chuỗi "min", "left", "Watched".
- `layout.tsx` ghi chú Poppins không có bộ ký tự tiếng Việt: một số dấu (ạ, ợ, ế...) sẽ lấy font dự phòng và nhìn lệch nét.
- Thanh toán VIP, đăng nhập, `localStorage` demo không phụ thuộc ngôn ngữ.

## Quyết định (đề xuất, chờ bạn duyệt)

1. **URL**: tiếng Anh ở gốc (`/series/...`), tiếng Việt có tiền tố (`/vi/series/...`). Cài bằng `proxy.ts`: đường dẫn không có tiền tố được **rewrite** nội bộ sang `/en/...` (URL trên thanh địa chỉ không đổi), đường dẫn `/vi/...` đi thẳng; `/en/...` chuyển hướng về không tiền tố để mỗi trang chỉ có một địa chỉ. Tất cả route người xem chuyển vào `app/[lang]/`; `/admin` và `/dev` nằm ngoài.
2. **Tự nhận ngôn ngữ ở lần đầu**: không có cookie `NEXT_LOCALE` thì xem `Accept-Language`; trình duyệt tiếng Việt vào `/` được chuyển sang `/vi`, còn lại tiếng Anh. Người dùng chọn tay ở menu thì ghi cookie `NEXT_LOCALE` (1 năm) và luôn theo lựa chọn đó. Công cụ tìm kiếm (không cookie) luôn thấy tiếng Anh ở gốc và tiếng Việt ở `/vi`, kèm thẻ `hreflang` và sitemap cho cả hai.
3. **Từ điển**: một file TypeScript mỗi ngôn ngữ (`lib/i18n/dictionaries/en.ts` là bản gốc có kiểu; `vi.ts` phải **thỏa cùng kiểu** nên thiếu khóa là lỗi biên dịch). Chuỗi có tham số dùng mẫu `{n}` và hàm `t(key, { n })`; số nhiều dùng `Intl.PluralRules`. Server component dùng `getDictionary(lang)`, client component dùng `useT()` (từ điển truyền qua một Provider ở layout).
4. **Link và điều hướng**: thay `next/link` bằng `Link` của VDrama (tự thêm `/vi` khi cần) và `useRouter` bọc tương tự; `redirect()` ở server cũng qua hàm trợ giúp. Có test bảo đảm không còn `next/link` thô ngoài thư mục admin.
5. **Menu đổi ngôn ngữ**: dòng "Language / Ngôn ngữ" trong ngăn kéo menu (mở bảng chọn English / Tiếng Việt, có dấu tick) và trong footer; đổi ngôn ngữ giữ nguyên trang đang xem (`/series/a/episode/3` ↔ `/vi/series/a/episode/3`).
6. **Font**: đổi sang font có bộ ký tự tiếng Việt đầy đủ và nét gần Poppins (đề xuất **Be Vietnam Pro** cho cả hai ngôn ngữ để chữ không đổi dáng khi chuyển; nếu bạn muốn giữ Poppins cho tiếng Anh thì dùng Be Vietnam Pro riêng cho `/vi`).
7. **Trang pháp lý** (Terms, Privacy, Refunds): bản tiếng Việt do mình viết nháp, có dòng ghi chú "bản dịch tham khảo" đến khi bên pháp lý duyệt; bản tiếng Anh vẫn là bản chuẩn.

## File/module bị ảnh hưởng

- Mới: `src/lib/i18n/` (cấu hình, từ điển `en`/`vi`, `getDictionary`, `useT`, hàm đường dẫn), `src/proxy.ts`, `src/components/i18n/` (`Link`, `LanguageSheet`, Provider), test cho từ điển, proxy và hàm đường dẫn.
- Sửa: toàn bộ `src/app/(site|account|auth|watch)` chuyển vào `src/app/[lang]/`; `layout.tsx`, `sitemap.ts`; khoảng 60 component có chữ; `lib/format.ts`; `lib/copy.ts` (chuyển dần vào từ điển rồi bỏ); `lib/api/errors.ts` (ánh xạ mã lỗi); `lib/news-data.ts`; `docs/design.md`, `README.md`.

## Các bước

Mỗi bước giữ giao diện chạy được và có commit riêng.

- [x] **Bước 1: Nền tảng từ điển, chưa đổi giao diện** — xong 2026-10-30: `src/lib/i18n/` (`config`, `paths`, `negotiate`, `translate`, `dictionaries/{en,vi}`), 15 test. `copy.ts` còn nguyên và có test so khớp với `en.ts` để không lệch; các bước sau chuyển dần người dùng sang `t()` rồi bỏ `copy.ts`. `useT`/Provider làm ở Bước 2 cùng layout `[lang]`.
  - Việc cần làm: cấu hình ngôn ngữ (`en`, `vi`, mặc định `en`); `en.ts` chuyển toàn bộ `copy.ts` sang đây; `vi.ts` dịch phần đó; `t()` có tham số và số nhiều; hàm `localePath(lang, path)` / `stripLocale`; test: `vi` có đủ khóa như `en`, không chuỗi rỗng, mọi `{tham_số}` ở hai bản trùng nhau.
  - Tiêu chí hoàn thành: `pnpm test` pass; thiếu khóa ở `vi.ts` làm `pnpm typecheck` lỗi; giao diện chưa đổi.
- [ ] **Bước 2: Định tuyến theo ngôn ngữ (vẫn toàn tiếng Anh)**
  - Việc cần làm: chuyển route vào `app/[lang]`, `proxy.ts` (rewrite/redirect, cookie, `Accept-Language`), `generateStaticParams`, `<html lang>`, `Link`/router bọc, `hreflang` + sitemap hai ngôn ngữ; bản demo/`next.config` vẫn chạy.
  - Tiêu chí hoàn thành: mọi route cũ vẫn mở được ở địa chỉ cũ; `/vi/...` mở được (chữ còn tiếng Anh); `/en/x` chuyển về `/x`; test proxy (có/không cookie, các `Accept-Language`, đường dẫn tĩnh như `/_next`, `/demo/...` không bị đụng); `pnpm build` pass; không còn `next/link` thô ngoài admin.
- [ ] **Bước 3: Menu đổi ngôn ngữ**
  - Việc cần làm: `LanguageSheet` (bảng chọn dạng bottom sheet như bảng VIP), dòng trong ngăn kéo menu và footer, ghi cookie, giữ nguyên trang đang xem; đổi font.
  - Tiêu chí hoàn thành: bấm đổi thì URL và cookie đổi đúng, quay lại trang cũ đúng ngôn ngữ; kiểm tra ở 320/390/440 px.
- [ ] **Bước 4: Dịch phần khung dùng chung**
  - Việc cần làm: header, ngăn kéo menu, footer, thanh Get VIP, bảng VIP, bảng Top Up, ô tìm kiếm, trang lỗi/404, định dạng ngày/số/thời lượng theo ngôn ngữ, ánh xạ mã lỗi API.
  - Tiêu chí hoàn thành: ở `/vi` các phần này không còn chữ Anh (có test quét từ điển và kiểm tra bằng mắt); thanh kiểm tra bằng script mở các trang và liệt kê chuỗi tiếng Anh còn sót.
- [ ] **Bước 5: Dịch trang xem phim**
  - Việc cần làm: trang chủ, Series, tìm kiếm, giới thiệu phim, trang xem, danh sách tập, review, tên thể loại theo `slug`.
  - Tiêu chí hoàn thành: như bước 4 cho nhóm trang này; không tràn ngang ở 4 độ rộng (chữ tiếng Việt thường dài hơn).
- [ ] **Bước 6: Dịch tài khoản, đăng nhập, VIP, News và các trang tĩnh**
  - Việc cần làm: Account, Sign in/up, quên mật khẩu, VIP/checkout (giữ nhãn PREVIEW), News, Download, Contact, Terms/Privacy/Refunds (bản nháp có ghi chú).
  - Tiêu chí hoàn thành: như bước 4; luồng demo khách → đăng nhập → VIP → xem tập chạy được ở cả hai ngôn ngữ.
- [ ] **Bước 7: Quét toàn site và tài liệu**
  - Việc cần làm: quét mọi route × hai ngôn ngữ × 4 độ rộng (không lỗi console, không tràn ngang, không còn khóa trống); cập nhật `docs/design.md` (cách thêm ngôn ngữ mới), `README.md`.
  - Tiêu chí hoàn thành: `pnpm lint/typecheck/format:check/test/build` pass; báo cáo quét kèm.

## Rủi ro

- Chuyển route vào `[lang]` chạm gần như mọi file, dễ sót liên kết → có test không còn `next/link` thô và bước quét route ở bước 7.
- `proxy.ts` ở Next 16 chạy trên Netlify cho bản demo: chưa thử (không làm deploy trong plan này); nếu Netlify không hỗ trợ thì dự phòng là `redirects`/`rewrites` trong `next.config.ts`.
- Chữ tiếng Việt dài hơn tiếng Anh 10–30%: nút, chip, thẻ có thể tràn → kiểm tra ở bước 5, 6, 7.
- Bản dịch tiếng Việt do mình viết, giọng điệu (xưng hô "bạn") và thuật ngữ VIP/Top Up cần bạn đọc lại; trang pháp lý cần bên pháp lý duyệt.
- Nội dung phim (tên, mô tả, review) vẫn một ngôn ngữ nên màn tiếng Việt có chỗ pha tiếng Anh cho đến khi có dữ liệu dịch.

## Câu hỏi còn mở

- Đồng ý chọn **tiền tố đường dẫn** (`/vi/...`, tiếng Anh ở gốc) thay vì chỉ lưu cookie không đổi URL? (Đề xuất tiền tố: giữ trang tĩnh và tốt cho SEO nước ngoài, đổi lại phải chuyển route ở Bước 2.)
- Tiếng Việt có tự bật khi trình duyệt nhà đầu tư dùng tiếng Việt (mục 2) hay mặc định luôn tiếng Anh cho đến khi người xem chọn?
- Font: dùng Be Vietnam Pro cho cả hai ngôn ngữ (đề xuất) hay giữ Poppins cho tiếng Anh?
- Có cần thêm ngôn ngữ thứ ba ngay (ví dụ Indonesia, Thái) cho thị trường nước ngoài, hay chỉ chuẩn bị đường để thêm sau?
