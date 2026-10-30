// Cấu hình bản demo tĩnh (docs/plans/gd3-netlify-demo.md). Bật bằng biến build NEXT_PUBLIC_DEMO=true.

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

/** Mật khẩu chung của 3 tài khoản demo. Giả, công khai, chỉ có tác dụng trong bản demo. */
export const DEMO_PASSWORD = "Demo1234!";

export const DEMO_ACCOUNTS = [
  {
    id: "viewer",
    email: "viewer@example.com",
    role: "Viewer",
    note: "Free episodes only; VIP episodes are locked",
  },
  { id: "vip", email: "vip@example.com", role: "VIP viewer", note: "Can watch every episode" },
  {
    id: "admin",
    email: "admin@example.com",
    role: "Admin",
    note: "Account menu → Admin opens the admin area",
  },
] as const;

/** Video mẫu dùng cho mọi tập (luồng HLS thử nghiệm công khai). */
export const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
