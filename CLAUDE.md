# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

VDrama là dự án mới, chưa có code. Công nghệ, lệnh build/test/lint chưa được chọn.
Khi stack được chốt, cập nhật mục "Lệnh thường dùng" và "Kiến trúc" bên dưới (hoặc chạy lại `/init`). Không tự đoán hay bịa thông tin chưa có.

## Quy trình làm việc (bắt buộc)

Mọi thay đổi không tầm thường đi theo vòng lặp: **Khám phá → Plan → Thực thi từng bước → Kiểm tra → Commit**.

1. **Khám phá**: đọc code liên quan, chưa sửa gì (dùng Plan Mode). Yêu cầu mơ hồ thì hỏi làm rõ trước.
2. **Plan**: ghi kế hoạch vào `plan.md` ở thư mục gốc (xem mẫu trong file đó). Chờ người dùng review/chỉnh xong mới code.
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

Chưa có. Điền vào khi chốt stack (build, test, chạy một test đơn lẻ, lint, type-check).

## Kiến trúc

Chưa có. Mô tả bức tranh tổng thể ở đây khi code đã thành hình.

## Điều không được làm

- Không code khi `plan.md` chưa được người dùng duyệt (trừ sửa nhỏ, hiển nhiên).
- Không làm nhiều bước plan trong một lượt.
- Không commit, push hay tạo PR khi chưa được yêu cầu.
- Làm việc lớn trên branch riêng, không trực tiếp trên `main`.
