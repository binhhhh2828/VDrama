# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Monorepo VDrama (kế hoạch đầy đủ ở `plan.md`): `apps/api` (FastAPI, Python 3.12, uv) và `apps/web` (Next.js, TypeScript, Tailwind, pnpm). Mới xong Giai đoạn 1 (khung dự án); chưa có DB, auth hay tính năng. Chi tiết stack và các quyết định kiến trúc nằm trong `plan.md`, không lặp lại ở đây.

## Quy trình làm việc (bắt buộc)

Mọi thay đổi không tầm thường đi theo vòng lặp: **Khám phá → Plan → Thực thi từng bước → Kiểm tra → Commit**.

1. **Khám phá**: đọc code liên quan, chưa sửa gì (dùng Plan Mode). Yêu cầu mơ hồ thì hỏi làm rõ trước.
2. **Plan**: ghi kế hoạch vào `plan.md` ở thư mục gốc (xem mẫu ở `docs/plan-template.md`). Chờ người dùng review/chỉnh xong mới code.
3. **Thực thi**: làm đúng **một bước** trong `plan.md`, rồi dừng cho người dùng xem. Không làm cả plan một lượt.
4. **Kiểm tra**: chạy test, lint, type-check của dự án; sửa đến khi pass. Báo trung thực nếu có thứ không chạy được.
5. **Commit**: mỗi bước chạy ổn là một commit nhỏ, message rõ ràng. Chỉ commit khi người dùng yêu cầu.

### Quy tắc với plan.md

- `plan.md` là bộ nhớ liên phiên: phiên mới bắt đầu bằng việc đọc `CLAUDE.md` và `plan.md`, tiếp tục từ bước chưa đánh dấu `[x]`.
- Mỗi bước phải nhỏ, làm xong chạy được và test được, có tiêu chí hoàn thành riêng.
- Xong bước nào thì đánh `[x]` ngay trong `plan.md`. Nếu phải đổi hướng, sửa plan trước rồi mới code.
- Việc lớn thì chia thành nhiều plan nhỏ; plan đã xong có thể chuyển vào `docs/plans/` để lưu.

### Slash command có sẵn (`.claude/commands/`)

- `/plan <mô tả>`: khám phá và viết `plan.md`, không sửa code.
- `/step [số bước]`: làm một bước trong plan, kiểm tra, đánh dấu, dừng.
- `/review`: review thay đổi hiện tại như reviewer khó tính.
- `/resume`: nạp lại ngữ cảnh từ CLAUDE.md và plan.md ở phiên mới.

## Lệnh thường dùng

API (chạy trong `apps/api`):

- Cài/chạy: `uv sync`, `uv run uvicorn app.main:app --reload`
- Kiểm tra: `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest -q`
- Test cần Postgres: bật DB (`docker compose -f docker-compose.dev.yml up -d db`) rồi đặt `TEST_DATABASE_URL=postgresql://vdrama:vdrama@localhost:5432/vdrama`; thiếu biến này các test đó tự bỏ qua (CI luôn đặt)
- Windows: psycopg async cần SelectorEventLoop, chạy server bằng `uv run uvicorn app.main:app --reload --loop app.core.loop:selector_loop_factory` (Linux/Docker không cần)
- Một test: `uv run pytest app/tests/test_health.py::test_health_ok`

Web (chạy trong `apps/web`):

- Chạy: `pnpm dev` (đặt `API_PROXY_TARGET=http://localhost:8000` để proxy `/api/*` sang FastAPI)
- Kiểm tra: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`

Cả bộ local: `docker compose -f docker-compose.dev.yml up --build`. CI (`.github/workflows/ci.yml`) chạy đúng các lệnh kiểm tra trên.

## Kiến trúc

- Web và API dùng **một domain**: mọi route API nằm dưới `/api` (kể cả `/api/health`), Caddy chuyển `/api/*` sang FastAPI, phần còn lại sang Next.js. Local không có Caddy nên Next.js `rewrites` thay vai trò đó. Không dùng CORS.
- Code API theo lớp trong `apps/api/app/`: `routers/` → `services/` → `models/`, cấu hình ở `core/config.py` (pydantic-settings, đọc `.env`). DB là SQLAlchemy 2 **async** + psycopg 3 (`core/db.py`: engine tạo lười, dependency `DbSession`); `DATABASE_URL` là URL qua pooler cho app, `DATABASE_URL_DIRECT` cho migration. Kế hoạch DB/scale: `docs/plans/gd2-b1-database.md`.
- Next.js ở phiên bản mới có breaking changes: đọc docs trong `apps/web/node_modules/next/dist/docs/` trước khi viết code web (theo `apps/web/AGENTS.md`).

## Điều không được làm

- Không code khi `plan.md` chưa được người dùng duyệt (trừ sửa nhỏ, hiển nhiên).
- Không làm nhiều bước plan trong một lượt.
- Không commit, push hay tạo PR khi chưa được yêu cầu.
- Làm việc lớn trên branch riêng, không trực tiếp trên `main`.
