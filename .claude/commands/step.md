---
description: Làm đúng một bước trong plan.md rồi dừng
argument-hint: [số bước, mặc định là bước chưa đánh dấu đầu tiên]
---

Đọc `plan.md` và làm bước: $ARGUMENTS (nếu để trống, lấy bước `- [ ]` đầu tiên).

1. Chỉ làm bước đó, không làm sang bước khác. Nếu thấy bước quá lớn hoặc plan sai, dừng và đề xuất sửa plan.
2. Chạy test, lint, type-check của dự án; sửa đến khi đạt tiêu chí hoàn thành của bước. Nếu chưa có lệnh nào, nói rõ.
3. Đánh dấu `[x]` cho bước trong `plan.md`.
4. Tóm tắt ngắn đã làm gì, kết quả kiểm tra, rồi dừng cho tôi xem. Không commit trừ khi tôi yêu cầu.
