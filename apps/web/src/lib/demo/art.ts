// Ảnh giữ chỗ cho bản demo (docs/plans/gd3-netshort-ui.md, bước R0): poster 3:4 và hero 4:5 lấy từ
// picsum theo `seed` cố định nên ảnh không đổi giữa các lần tải. Có poster thật thì chỉ thay URL
// trong data.json, không đổi code.

const PICSUM = "https://picsum.photos/seed";

/** Poster 3:4 (600×800) cho thẻ phim. */
export const demoPosterUrl = (slug: string) => `${PICSUM}/${slug}/600/800`;

/** Ảnh hero 4:5 (800×1000) cho băng chuyền trang chủ. */
export const demoHeroUrl = (slug: string) => `${PICSUM}/${slug}-hero/800/1000`;
