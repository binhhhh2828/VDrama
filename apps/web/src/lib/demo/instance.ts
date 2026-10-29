// Một API giả dùng chung cho cả trang (và cho server khi đọc catalog). Chỉ được import động
// sau khi kiểm tra IS_DEMO, để bản không-demo không kéo dữ liệu mẫu vào bundle.

import { createDemoFetch } from "./api";

export const demoFetch = createDemoFetch();
