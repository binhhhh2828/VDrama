import { Be_Vietnam_Pro } from "next/font/google";

// Be Vietnam Pro: nét hình học gần Poppins nhưng có đủ bộ ký tự tiếng Việt (Poppins thiếu bộ này nên
// dấu như ạ, ợ, ế phải lấy font dự phòng và lệch nét). Dùng cho cả hai ngôn ngữ để chữ không đổi dáng
// khi chuyển. Không phải font biến nên phải liệt kê độ đậm.
export const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext", "vietnamese"],
});
