import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Test logic không cần trình duyệt (client API, định dạng, mã lỗi). Giao diện test bằng Playwright.
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
