// Chụp dữ liệu catalog từ API đang chạy (đã seed-demo) ra src/lib/demo/data.json cho bản demo tĩnh.
// Chạy:  API_URL=http://localhost:8000 ADMIN_EMAIL=admin@example.com DEMO_PASSWORD=... \
//        node scripts/capture-demo-data.mjs [slug-nháp ...]
// Đăng nhập admin để thấy cả phim / tập chưa xuất bản. Mật khẩu chỉ dùng trong lệnh này, không ghi ra file.
import { writeFileSync } from "node:fs";

const API = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "") + "/api/v1";
const ORIGIN = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error("Thiếu DEMO_PASSWORD");
const extraSlugs = process.argv.slice(2);

const login = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Đăng nhập admin thất bại: ${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

const get = async (path, auth = false) => {
  const res = await fetch(`${API}${path}`, { headers: auth ? { Cookie: cookie } : {} });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const genres = await get("/genres");
const slugs = [];
let cursor;
do {
  const page = await get(
    `/series?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  slugs.push(...page.items.map((s) => s.slug));
  cursor = page.next_cursor;
} while (cursor);
for (const s of extraSlugs) if (!slugs.includes(s)) slugs.push(s);

const series = [];
const episodes = {};
for (const slug of slugs) {
  series.push(await get(`/series/${slug}`, true));
  episodes[slug] = await get(`/series/${slug}/episodes`, true);
}

// Phim "hot" xếp theo view_count, "new" theo published_at: bộ giả tự sắp lại từ các trường này.
writeFileSync(
  new URL("../src/lib/demo/data.json", import.meta.url),
  JSON.stringify({ genres, series, episodes }, null, 1) + "\n",
);
console.log(`Đã chụp ${series.length} phim, ${Object.values(episodes).flat().length} tập.`);
