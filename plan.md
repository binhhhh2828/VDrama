# VDrama — Plan dự án (sản phẩm thật, deploy thật)

> Mục tiêu: website xem phim bộ có tài khoản, gói VIP, video bảo vệ quyền xem, chạy production thật trên VPS.
> Quy mô khởi điểm: < 100 người xem/ngày. Ưu tiên: đơn giản, rẻ, dễ vận hành, dễ nâng cấp.

---

## 0. Kết quả rà soát plan (2026-10-27)

Kiến trúc và bảo mật ổn. Đã sửa/bổ sung:

1. **Mô hình dữ liệu**: thêm `sessions` (bắt buộc, vì giới hạn thiết bị cần nó), `email_tokens` (xác thực email/quên mật khẩu), `payment_events` (idempotent webhook), và quy tắc cộng dồn hạn VIP.
2. **Giai đoạn 1**: thêm task deploy "hello world" mà phần "Mẹo" ở mục 8 nhắc nhưng task list chưa có.
3. **Lịch 4–6 tuần là lạc quan** cho 1 người với phạm vi này (auth + admin + upload + thanh toán + deploy + pháp lý). Nên xem 6–8 tuần là thực tế hơn; phần nào cần bên ngoài (cổng thanh toán, pháp lý) quyết định ngày ra mắt.
4. **Quyết định kỹ thuật chốt thêm**:
   - Python 3.12 + `uv` quản lý dependency; Node 22 LTS + `pnpm` cho web.
   - Next.js gọi API phía server qua mạng nội bộ Docker (`http://api:8000`), phía trình duyệt qua `/api` cùng domain; phải chuyển tiếp cookie khi SSR.
   - Driver DB: `psycopg` 3 (sync hoặc async) với pooler của Neon; nếu dùng asyncpg thì tắt statement cache. Chốt khi làm Giai đoạn 2.
   - Giai đoạn 0 và các task cần tài khoản/pháp nhân là việc của chủ dự án, Claude không làm thay được.
5. **Tiến độ triển khai**: đi theo `CLAUDE.md` (mỗi lần một bước, xong đánh `[x]`). Bắt đầu từ Giai đoạn 1 vì không phụ thuộc bên ngoài.

---

## 1. Quyết định kiến trúc (đã chốt)

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Domain + DNS | `vdrama.vn` + Cloudflare DNS | Bật proxy (CDN/WAF cơ bản), SSL Full (strict) |
| Server | 1 VPS Linux (Ubuntu 24.04 LTS), 2 vCPU / 2–4 GB RAM | Đặt VPS ở Singapore, cùng vùng với Neon để API↔DB độ trễ thấp (video đi qua Cloudflare nên không phụ thuộc vị trí VPS). Thêm swap 2 GB |
| Frontend | Next.js (App Router, TypeScript) | Chạy container riêng |
| Backend | FastAPI (Python 3.12) + SQLAlchemy 2 + Alembic | Chạy container riêng |
| Database | Neon PostgreSQL (vùng Singapore) | Sản phẩm thật nên dùng gói trả phí: gói free có thể tự ngủ (request đầu chậm) và cần xem lại điều khoản dùng thương mại |
| Video | Cloudflare Stream | Lưu trữ, chuyển mã, phát video; dùng signed URL để kiểm soát quyền xem |
| Reverse proxy | Caddy | Dùng **một domain duy nhất**: `/api/*` → FastAPI, còn lại → Next.js. Không cần CORS, cookie đăng nhập đơn giản và an toàn hơn |
| Deploy | Docker Compose + GitHub Actions (SSH deploy) | Push vào nhánh `main` → tự deploy |
| Backup/Monitoring | pg_dump định kỳ + UptimeRobot + Sentry | Cấu hình từ đầu |

### Sơ đồ

```
Người dùng → Cloudflare DNS/CDN → VPS
                                   ├─ Caddy (443)
                                   │    ├─ vdrama.vn/*      → web (Next.js :3000)
                                   │    └─ vdrama.vn/api/*  → api (FastAPI :8000)
                                   └─ Docker Compose
Người dùng ←— video (HLS) ←— Cloudflare Stream (signed token do API cấp)
API → Neon PostgreSQL
```

### Luồng xem video có kiểm soát quyền

1. Người dùng mở trang tập phim → frontend gọi `GET /episodes/{id}/play`.
2. Backend kiểm tra: đăng nhập chưa? tập miễn phí hay cần VIP? VIP còn hạn không?
3. Nếu hợp lệ → backend tự ký **signed token** bằng signing key của Stream (tạo key 1 lần, ký JWT ngay trong backend, không cần gọi API Cloudflare mỗi lượt xem), hết hạn ngắn (ví dụ 2–4 giờ) → trả về URL phát.
4. Frontend dùng player (Stream player hoặc hls.js) phát bằng URL đó.

> Video phải để chế độ `requireSignedURLs = true`, nếu không ai có ID video đều xem được. Lưu ý: signed URL chặn người chưa có quyền, nhưng không phải DRM — người đã có quyền vẫn có thể quay màn hình hoặc chia sẻ link trong thời hạn token. Vì vậy token cần ngắn hạn và nên giới hạn số thiết bị đăng nhập đồng thời (xem Giai đoạn 5).

---

## 2. Cảnh báo cần xử lý trước khi ra mắt

1. **Nội dung**: phim do team của bạn sản xuất nên không cần mua bản quyền bên thứ ba. Chỉ nên có một văn bản ngắn xác nhận bạn được quyền khai thác thương mại với team làm phim, để tránh tranh chấp về sau.
2. **Chi phí video**: Stream tính phí theo phút lưu trữ + phút được xem. Ví dụ trong phân tích trước: 100 người × 30 phút/ngày ≈ 90.000 phút xem/tháng. Hãy **kiểm tra bảng giá Cloudflare Stream hiện hành** và tự tính lại trước khi mở bán. Nên đặt cảnh báo chi tiêu (billing alert).
3. **Điều khoản dịch vụ**: kiểm tra điều khoản thương mại của Neon, Cloudflare, VPS. Không dùng gói cá nhân/phi thương mại cho sản phẩm bán tiền.
4. **Thanh toán**: **đã chốt (2026-10-27) dùng SePay + VietQR trước** (xem Giai đoạn 5), MoMo/VNPay để sau. Lưu ý cho khi làm MoMo/VNPay: các cổng này thường yêu cầu pháp nhân (công ty hoặc hộ kinh doanh) có đăng ký kinh doanh, tài khoản ngân hàng tương ứng, và website đã có đủ trang pháp lý, giá, chính sách hoàn tiền. Thời gian duyệt production có thể kéo dài nhiều ngày đến vài tuần (tự xác minh với từng cổng). Đây là đường găng của lịch ra mắt: nếu chưa có pháp nhân, cần xử lý trước; nếu cần ra mắt sớm, có thể dùng cổng trung gian dễ đăng ký hơn (PayOS, SePay) cho giai đoạn đầu.
5. **Pháp lý web** (nên hỏi luật sư hoặc cơ quan quản lý để xác minh, vì quy định thay đổi):
   - Chính sách bảo mật, Điều khoản sử dụng, Chính sách hoàn tiền; có ô đồng ý khi đăng ký.
   - Quy định về bảo vệ dữ liệu cá nhân (bạn thu thập email, lịch sử xem, thông tin thanh toán).
   - Thông báo/đăng ký website thương mại điện tử với Bộ Công Thương nếu thuộc diện bắt buộc.
   - Hóa đơn điện tử cho giao dịch bán VIP.
   - Xem dịch vụ phát video trả phí của bạn có thuộc diện cần giấy phép/đăng ký riêng hay không.

---

## 3. Cấu trúc monorepo

```
vdrama/
├─ plan.md
├─ README.md
├─ docker-compose.yml            # production
├─ docker-compose.dev.yml        # local dev
├─ .env.example
├─ .github/workflows/
│   ├─ ci.yml                    # lint + test
│   └─ deploy.yml                # deploy lên VPS
├─ deploy/
│   ├─ Caddyfile
│   ├─ backup.sh                 # pg_dump → lưu ngoài VPS
│   └─ setup-vps.md              # hướng dẫn dựng VPS từ đầu
├─ apps/
│   ├─ web/                      # Next.js
│   │   ├─ Dockerfile
│   │   ├─ src/app/              # (public) (auth) (account) (admin)
│   │   ├─ src/components/
│   │   └─ src/lib/api.ts
│   └─ api/                      # FastAPI
│       ├─ Dockerfile
│       ├─ pyproject.toml
│       ├─ alembic/
│       ├─ app/
│       │   ├─ main.py
│       │   ├─ core/             # config, security, deps
│       │   ├─ models/           # SQLAlchemy
│       │   ├─ schemas/          # Pydantic
│       │   ├─ routers/          # auth, series, episodes, play, payments, admin
│       │   ├─ services/         # stream.py, payment.py, vip.py
│       │   └─ tests/
└─ docs/
    ├─ api.md
    └─ runbook.md                # xử lý sự cố, rollback, restore
```

---

## 4. Mô hình dữ liệu (PostgreSQL)

**Đã triển khai** (migration `0001`–`0009`, 2026-10-27). Thiết kế chi tiết, lý do và nguyên tắc scale: [docs/plans/gd2-b1-database.md](docs/plans/gd2-b1-database.md) (bảng, `0001`–`0006`) và [docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md](docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md) (trạng thái, xóa mềm, nhật ký, `0007`–`0009`). Nguồn sự thật là model trong `apps/api/app/models/`.

| Migration | Nhóm | Bảng |
|---|---|---|
| `0001` | Extension | `pg_trgm`, `unaccent` |
| `0002` | Tài khoản | `users`, `sessions`, `email_tokens` |
| `0003` | Catalog | `series`, `series_stats`, `genres`, `series_genres`, `episodes` |
| `0004` | Tìm kiếm | hàm `immutable_unaccent`, cột `series.search_text`, index GIN trigram |
| `0005` | VIP & thanh toán | `vip_plans`, `payments`, `subscriptions`, `payment_events` |
| `0006` | Hoạt động | `watch_history`, `favorites` |
| `0007` | Trạng thái | `payments.paid_event_id`, `failure_code`, `failure_detail`; trigger chuyển trạng thái `payments_guard`, `subscriptions_guard` |
| `0008` | Xóa mềm | `deleted_at`, `deleted_by_id` cho `users`, `series`, `episodes`, `genres`, `vip_plans`; trigger `block_hard_delete` |
| `0009` | Nhật ký | `audit_logs` (chỉ thêm) |

Quy tắc chính nằm ở tầng DB (có test):
- Email duy nhất không phân biệt hoa/thường; tìm user theo `lower(email)`.
- Tập phim chỉ xuất bản được khi video `ready`; series xuất bản phải có `published_at`.
- Một payment chỉ cộng VIP một lần (unique `subscriptions.payment_id`); webhook trùng bị chặn (unique `payment_events(provider, event_id)`); đơn `paid`/`refunded` phải có `paid_at`.
- Đơn chỉ `paid` khi gắn với giao dịch ngân hàng thật (`paid_event_id`, một giao dịch trả một đơn): admin không thể tự đánh dấu đã thanh toán. Cho VIP không qua tiền thì dùng "tặng VIP" (subscription không có payment, bắt buộc lý do).
- Trạng thái chỉ chuyển theo sơ đồ (trigger): đơn `pending → paid | failed | expired`, `paid → refunded`; gói `active → expired | cancelled`; trạng thái cuối không đổi được. Đơn đã rời `pending` thì khóa trường tiền. Đơn `failed` phải có `failure_code`.
- **Xóa trên web chỉ là xóa mềm** (`deleted_at`): dòng bị ẩn khỏi mọi truy vấn ORM nhưng vẫn nằm trong DB, khôi phục được; email/slug/số tập vẫn giữ chỗ. DB chặn `DELETE`/`TRUNCATE` thật trên 9 bảng quan trọng (chỉ script bảo trì bật cờ `vdrama.allow_hard_delete` mới qua được). `payments`/`subscriptions`/`payment_events` không bao giờ bị xóa, chỉ đổi trạng thái. Khóa ngoại RESTRICT/CASCADE chỉ còn tác dụng trong bảo trì.
- **Nhật ký thao tác `audit_logs`**: ai, lúc nào, làm gì, trên đối tượng nào, user bị ảnh hưởng, trước/sau, lý do, IP, request_id. Ghi cùng transaction với thay đổi; bắt buộc lý do cho xóa/khôi phục/đổi quyền/hủy gói/hoàn tiền/tặng VIP/gắn giao dịch; che mật khẩu và token; DB cấm sửa và xóa nhật ký.
- Gia hạn VIP: thêm dòng `subscriptions` mới với `starts_at` = max(bây giờ, hạn VIP hiện tại), `expires_at` = `starts_at` + `duration_days`; không sửa dòng cũ.
- Trạng thái VIP (chốt 2026-10-27, thêm ở migration `0010` cùng auth): cột `users.vip_expires_at`, VIP khi `vip_expires_at > now()`; không dùng role `vip` hay cờ `is_vip`. Cột này là bản tóm tắt của `subscriptions`, chỉ được ghi bởi `services/vip.py` trong cùng transaction.
- Mọi khóa ngoại đều có index; `watch_history` ghi bằng upsert và cập nhật tại chỗ (HOT).

---

## 5. API chính (REST, prefix `/api/v1`)

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me` |
| Catalog | `GET /series`, `GET /series/{slug}`, `GET /series/{slug}/episodes`, `GET /search?q=` |
| Play | `GET /episodes/{id}/play` (kiểm tra quyền → signed token) |
| User | `GET/POST /me/favorites`, `GET/PUT /me/history` |
| VIP | `GET /plans`, `POST /payments/checkout`, `POST /payments/webhook` |
| Admin | CRUD series/episodes/plans, `POST /admin/episodes/{id}/upload-url` (direct upload lên Stream), danh sách user/payment |
| Health | `GET /health` |

---

## 6. Bảo mật (bắt buộc cho bản thật)

- Hash mật khẩu bằng argon2 hoặc bcrypt; không lưu mật khẩu thô.
- JWT access token ngắn hạn + refresh token (httpOnly, Secure, SameSite cookie).
- Rate limit cho login/register/play (slowapi hoặc ở Caddy/Cloudflare).
- Cùng một domain cho web và API nên không mở CORS; cookie `Secure`, `httpOnly`, `SameSite=Lax`; thêm bảo vệ CSRF cho các request thay đổi dữ liệu.
- Vì đứng sau Cloudflare, backend và rate limit phải đọc IP thật từ header `CF-Connecting-IP` (chỉ tin header này khi request đến từ dải IP Cloudflare).
- Firewall VPS chỉ cho phép dải IP Cloudflare vào cổng 80/443 để không ai bỏ qua Cloudflare mà gọi thẳng IP máy chủ.
- Lưu thời gian dạng UTC, tiền dạng số nguyên VND; so sánh hạn VIP theo UTC.
- Webhook thanh toán: **xác thực chữ ký**, xử lý idempotent (không cộng VIP 2 lần).
- Secret chỉ ở `.env` trên VPS / GitHub Secrets; không commit.
- VPS: tắt đăng nhập root và password SSH, dùng SSH key, bật `ufw` (chỉ mở 22/80/443), `fail2ban`, tự cập nhật bảo mật.
- Cloudflare Stream: bật signed URL, giới hạn domain được nhúng (allowed origins).
- Backup database mã hóa, lưu ngoài VPS, **thử restore** định kỳ.

---

## 7. Danh sách task theo giai đoạn

### Giai đoạn 0 — Chuẩn bị (làm song song ngay)
- [ ] Có văn bản xác nhận quyền khai thác thương mại phim với team sản xuất
- [ ] Xác định pháp nhân (công ty/hộ kinh doanh) dùng để đăng ký cổng thanh toán và xuất hóa đơn
- [ ] Hỏi luật sư/cơ quan quản lý về các mục ở Mục 2.5 (giấy phép dịch vụ, dữ liệu cá nhân, TMĐT)
- [ ] Đăng ký domain `vdrama.vn`, chuyển nameserver sang Cloudflare
- [ ] Tạo tài khoản: GitHub (repo private), Cloudflare (bật Stream), Neon, VPS, Sentry
- [ ] Đăng ký SePay, liên kết tài khoản ngân hàng nhận tiền (nên là tài khoản của pháp nhân dùng để xuất hóa đơn), cấu hình tiền tố mã thanh toán và webhook; xác minh với SePay điều kiện dùng cho mục đích kinh doanh. MoMo/VNPay để sau khi đã kiểm chứng mô hình kinh doanh
- [ ] Đặt billing alert cho Cloudflare và VPS

### Giai đoạn 1 — Khởi tạo codebase
- [x] Tạo monorepo theo cấu trúc mục 3, `.gitignore`, `README.md`, `.env.example`
- [x] Scaffold `apps/api` (FastAPI, cấu hình pydantic-settings, `/api/health`)
- [x] Scaffold `apps/web` (Next.js + TypeScript + Tailwind)
- [x] Dockerfile cho cả hai; `docker-compose.dev.yml` (web + api + Postgres local)
- [x] Cấu hình lint/format: ruff + pytest (api), eslint + prettier (web)
- [x] CI GitHub Actions: chạy lint + test mỗi PR (đã xanh trên GitHub)
- [ ] (cuối tuần 1) Deploy bản "hello world" (web + `/api/health`) lên VPS qua Caddy + Cloudflare để phát hiện sớm lỗi DNS/HTTPS/CI-CD; cần xong Giai đoạn 0 (domain, VPS)

### Giai đoạn 2 — Backend lõi
- [x] (plan chi tiết: [docs/plans/gd2-b1-database.md](docs/plans/gd2-b1-database.md); xong 2026-10-27 trên Postgres local, **chưa thử trên Neon thật** vì chưa có tài khoản) Kết nối Neon, SQLAlchemy + Alembic, migration đầu tiên (toàn bộ bảng mục 4); dùng chuỗi kết nối pooled cho app, chuỗi direct cho migration, và cấu hình driver tương thích với pooler
- [x] (plan chi tiết: [docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md](docs/plans/gd2-b1b-trang-thai-xoa-mem-nhat-ky.md), xong 2026-10-27, migration `0007`–`0009`) Bổ sung schema: trạng thái đơn/gói VIP có kiểm soát, `payments.failure_code/detail`, xóa mềm (không mất dữ liệu khi admin xóa nhầm), nhật ký thao tác `audit_logs` để truy vết
- [ ] (plan chi tiết: [docs/plans/gd2-b2-auth.md](docs/plans/gd2-b2-auth.md), đã rà soát lại, chờ duyệt; có ma trận phân quyền khách/user/VIP/admin) Auth: đăng ký, đăng nhập, refresh, `/me`, phân quyền admin
- [ ] Xác thực email, quên/đặt lại mật khẩu (gửi email qua Resend/Brevo, cấu hình SPF/DKIM/DMARC cho domain)
- [ ] Catalog: series, episodes, thể loại, phân trang
- [ ] Tìm kiếm tiếng Việt không dấu (extension `unaccent` + `pg_trgm`)
- [ ] Service Cloudflare Stream: tạo direct upload URL, ký signed token cục bộ, nhận webhook khi video chuyển mã xong (cập nhật trạng thái tập phim)
- [ ] Endpoint `play` có kiểm tra quyền (free / VIP / hết hạn)
- [ ] Watch history, favorites
- [ ] Test tự động cho auth, play, phân quyền

### Giai đoạn 3 — Frontend
- [ ] Layout, header, footer, responsive mobile-first
- [ ] Trang chủ (banner, danh sách mới/hot), trang thể loại, trang tìm kiếm
- [ ] Trang chi tiết phim + danh sách tập
- [ ] Trang xem phim: player, nhớ tiến độ, chuyển tập kế tiếp
- [ ] Đăng ký/đăng nhập, trang tài khoản, lịch sử, yêu thích
- [ ] Trang giá VIP + trạng thái VIP trong tài khoản
- [ ] SEO: metadata, Open Graph, sitemap.xml, robots.txt
- [ ] Trang tĩnh: Điều khoản, Bảo mật, Hoàn tiền, Liên hệ

### Giai đoạn 4 — Admin & nội dung
- [ ] Trang admin (bảo vệ role admin): quản lý series, tập phim, gói VIP
- [ ] Upload video trực tiếp lên Cloudflare Stream từ trình duyệt (tus/direct upload)
- [ ] Theo dõi trạng thái chuyển mã, bật/tắt xuất bản
- [ ] Nơi lưu poster/banner: Cloudflare R2 (hoặc Cloudflare Images) kèm upload từ admin; không lưu ảnh trên VPS
- [ ] Quy trình nhận file phim từ team sản xuất (định dạng, độ phân giải, phụ đề) để upload thống nhất
- [ ] Xem danh sách user, thanh toán, thống kê cơ bản
- [ ] Nhập thử nội dung thật (ít nhất 1–2 bộ hoàn chỉnh)

### Giai đoạn 5 — Thanh toán VIP
**Phương thức: SePay + VietQR (chuyển khoản ngân hàng)**, quyết định 2026-10-27. Ít phải tích hợp, phù hợp để kiểm chứng mô hình kinh doanh trước. MoMo/VNPay thêm sau (Giai đoạn 9), dùng lại cùng bảng `payments`/`payment_events` với `provider` khác. Schema DB hiện tại (migration 0005) đã dùng được cho SePay, không cần đổi.

Luồng: người dùng chọn gói → backend tạo `payments` (`provider='sepay'`, `status='pending'`, mã đơn duy nhất làm nội dung chuyển khoản) → trang hiển thị ảnh VietQR (số tài khoản, số tiền, nội dung = mã đơn) → người dùng chuyển khoản → SePay gọi webhook → backend khớp mã đơn + số tiền → kích hoạt VIP → trang thanh toán thấy trạng thái đổi (hỏi lại backend định kỳ, không tin phía trình duyệt).

- [ ] Tạo đơn: sinh mã đơn ngắn, khó đoán, đúng định dạng mã thanh toán đã cấu hình trên SePay (tiền tố + số/chữ); lưu số tiền tại thời điểm mua; đơn có hạn (ví dụ 15–30 phút)
- [ ] Trang thanh toán: ảnh VietQR + thông tin chuyển khoản thủ công (ngân hàng, số tài khoản, số tiền, nội dung), đếm ngược hạn đơn, tự cập nhật khi đã nhận tiền
- [ ] Webhook SePay: xác thực API key trong header (so sánh an toàn, sai thì 401), chỉ nhận giao dịch tiền vào; lưu mọi sự kiện vào `payment_events` (`event_id` = mã giao dịch SePay) trước khi xử lý; trùng thì trả thành công mà không làm gì thêm; trả 2xx nhanh. Đối chiếu tên trường payload với tài liệu SePay hiện hành khi tích hợp
- [ ] Khớp giao dịch: tìm mã đơn trong nội dung chuyển khoản (người dùng hay gõ sai/thêm chữ, ngân hàng hay chèn tiền tố); khớp mã **và** đủ số tiền → `paid` + tạo subscription trong cùng transaction (unique `payment_id` chặn cộng hai lần)
- [ ] Ca bất thường, đưa vào hàng chờ cho admin xử lý thay vì tự đoán: chuyển thiếu tiền, không có/không khớp mã đơn, chuyển hai lần cho một đơn. Chuyển **sau khi đơn hết hạn** mà đúng mã và đủ tiền thì vẫn kích hoạt (tiền đã nhận); chuyển dư thì kích hoạt và ghi chú để admin xem
- [ ] Job đối soát định kỳ: gọi API giao dịch của SePay lấy các giao dịch gần đây, xử lý những giao dịch webhook bị trượt (cùng logic, idempotent); đóng đơn pending quá hạn
- [ ] Rate limit tạo đơn (tránh spam đơn pending)
- [ ] **Nhắc hạn VIP** (yêu cầu 2026-10-27): job chạy hằng ngày tìm user có VIP hết hạn trong **5 ngày** tới mà chưa gia hạn nối tiếp → gửi email + hiện thông báo trên web, có nút "Gia hạn" mở thẳng trang thanh toán của gói đang dùng. Nhắc thêm 1 ngày trước và đúng ngày hết hạn. Ghi lại đã nhắc lần nào (bảng thông báo, thêm bằng migration khi làm) để không gửi trùng khi job chạy lại
- [ ] **Gia hạn**: thanh toán sớm không mất ngày nào, subscription mới nối tiếp từ hạn hiện tại (quy tắc ở mục 4). Trang tài khoản hiện rõ "VIP đến ngày …"
- [ ] **Hết hạn** (chốt 2026-10-27: **không tự động trừ tiền gia hạn**): quá `vip_expires_at` là mất quyền xem tập VIP ngay, không cần job (so với giờ hiện tại). Job hằng ngày chỉ làm việc sổ sách: chuyển subscription quá hạn sang `expired` và gửi thông báo "Gói VIP đã hết hạn" kèm nút mua lại. Người dùng tự thanh toán lại; gói mới tính từ lúc thanh toán
- [ ] Giới hạn số thiết bị/phiên đăng nhập đồng thời (ví dụ 2) để hạn chế chia sẻ tài khoản VIP
- [ ] Xuất hóa đơn điện tử cho đơn VIP (thủ công hoặc qua nhà cung cấp hóa đơn)
- [ ] Email xác nhận thanh toán (Resend/Brevo/SMTP)
- [ ] Test: giả lập webhook SePay trong test tự động (đúng/sai API key, trùng sự kiện, thiếu/dư tiền, sai mã, quá hạn); sau đó chuyển khoản thật số tiền nhỏ
- [ ] Quy trình xử lý khiếu nại/hoàn tiền (thủ công qua admin)

### Giai đoạn 6 — Hạ tầng & Deploy
- [ ] Dựng VPS: tạo user không root, SSH key, ufw, fail2ban, Docker, Docker Compose
- [ ] `docker-compose.yml` production (web, api, caddy), restart policy, healthcheck, giới hạn log
- [ ] Caddyfile: `vdrama.vn` → web, `vdrama.vn/api/*` → api (một domain, không cần CORS)
- [ ] Cloudflare DNS trỏ về VPS, SSL Full (strict) với Cloudflare Origin Certificate cài trên Caddy (tránh lỗi cấp chứng chỉ qua proxy), bật cache cho static
- [ ] Next.js build chế độ `standalone` để image nhỏ; build image trên CI, không build trên VPS
- [ ] Mỗi lần deploy gắn tag image theo commit để rollback nhanh bằng cách chạy lại tag cũ
- [ ] Bật snapshot/backup VPS của nhà cung cấp, ngoài backup database
- [ ] `deploy.yml`: build image → đẩy lên GHCR → SSH vào VPS `pull && up -d` → chạy migration
- [ ] Chạy migration Alembic an toàn khi deploy; có cách rollback
- [ ] Biến môi trường production lưu ở GitHub Secrets + `.env` trên VPS

### Giai đoạn 7 — Vận hành
- [ ] Backup: `pg_dump` hằng ngày bằng cron → lưu ngoài VPS (R2/B2/S3), giữ 7–30 bản; thử restore
- [ ] Monitoring: UptimeRobot cho `/health`, Sentry cho web + api
- [ ] Log: xoay vòng log Docker, xem log nhanh khi lỗi
- [ ] `docs/runbook.md`: khi web sập, khi DB lỗi, rollback bản deploy, hết hạn chứng chỉ
- [ ] Theo dõi chi phí Stream hằng tuần trong tháng đầu

### Giai đoạn 8 — Kiểm thử & ra mắt
- [ ] Test end-to-end luồng: đăng ký → xem tập free → mua VIP → xem tập VIP → hết hạn bị chặn
- [ ] Test trên điện thoại (iOS Safari, Android Chrome) và desktop
- [ ] Kiểm tra link video không dùng được khi chưa đăng nhập/chưa VIP/token hết hạn
- [ ] Kiểm tra tốc độ (Lighthouse), tối ưu ảnh poster
- [ ] Rà soát bảo mật theo checklist mục 6
- [ ] Soft launch với nhóm nhỏ (10–20 người), thu feedback, sửa lỗi
- [ ] Ra mắt chính thức

### Giai đoạn 9 — Sau ra mắt (tùy chọn)
- [ ] Bình luận/đánh giá, thông báo tập mới, gợi ý phim
- [ ] Đăng nhập Google
- [ ] Thêm MoMo, VNPay (dùng lại bảng payments/payment_events, thêm provider mới)
- [ ] Hỗ trợ phụ đề nhiều ngôn ngữ
- [ ] Khi tải tăng: nâng VPS, hoặc tách frontend/backend sang dịch vụ managed

---

## 8. Thứ tự làm đề xuất (4–6 tuần, 1 người)

| Tuần | Trọng tâm |
|---|---|
| 1 | Giai đoạn 0 + 1 + khởi động 2 (auth, DB) |
| 2 | Hoàn thành 2 (catalog, Stream, play) |
| 3 | Giai đoạn 3 (frontend) + 4 (admin, upload) |
| 4 | Giai đoạn 5 (thanh toán) + 6 (deploy lên VPS thật) |
| 5 | Giai đoạn 7 + 8 (backup, monitor, test, soft launch) |
| 6 | Sửa lỗi, ra mắt, theo dõi chi phí |

> Lưu ý lịch: với SePay + VietQR, thời gian chờ duyệt ngắn hơn nhiều so với MoMo/VNPay, nhưng vẫn cần tài khoản ngân hàng nhận tiền và các việc pháp lý ở mục 2 (hóa đơn điện tử, trang chính sách) trước khi bán thật.

> Mẹo: deploy một bản "hello world" lên VPS ngay cuối tuần 1 để phát hiện sớm vấn đề DNS/HTTPS/CI-CD, thay vì để đến cuối.

---

## 9. Definition of Done cho bản production

- [ ] Truy cập `https://vdrama.vn` qua HTTPS, API tại `https://vdrama.vn/api`; truy cập thẳng IP VPS bị chặn
- [ ] Đăng ký có xác thực email, quên mật khẩu hoạt động, email không vào spam
- [ ] Push vào `main` tự deploy, có thể rollback
- [ ] Chỉ người có quyền mới xem được video (đã kiểm chứng)
- [ ] Thanh toán thật hoạt động và tự kích hoạt VIP
- [ ] Backup chạy tự động và đã thử restore thành công
- [ ] Có cảnh báo khi web sập và khi lỗi ứng dụng
- [ ] Có đủ trang pháp lý và nội dung có bản quyền
