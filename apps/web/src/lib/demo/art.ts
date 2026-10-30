// Ảnh poster cho bản demo (docs/plans/gd4-poster-images.md). 5 poster AI thật được xử lý bằng
// `uv run python -m app.cli poster-build` (cắt viền, ra thumb/detail/hero 3:4, WebP) và nằm ở
// public/demo/posters/<khóa>/. Mỗi phim demo một poster; phim không có trong bảng (bản nháp) dùng ảnh
// giữ chỗ picsum theo `seed` cố định.

const DEMO_POSTERS = [
  "hoang_tu_va_nu_tu_nhan",
  "chi_tien_cho_trai_dep",
  "loi_nguyen_duoi_anh_trang",
  "duoi_nguoi_chot_don_mat_luon_khach_vip",
  "ke_bao_thu",
] as const;

/** Slug phim demo có poster, cùng thứ tự với DEMO_POSTERS (phim thứ i dùng poster thứ i). */
const DEMO_SLUGS = [
  "hoang-tu-va-nu-tu-nhan",
  "chi-tien-cho-trai-dep",
  "loi-nguyen-duoi-anh-trang",
  "duoi-nguoi-chot-don-mat-luon-khach-vip",
  "ke-bao-thu",
] as const;

type Rendition = "thumb" | "detail" | "hero";

function posterKey(slug: string): string | null {
  const i = (DEMO_SLUGS as readonly string[]).indexOf(slug);
  return i < 0 ? null : DEMO_POSTERS[i];
}

const demoImage = (slug: string, size: Rendition) => {
  const key = posterKey(slug);
  return key ? `/demo/posters/${key}/${size}.webp` : null;
};

const PICSUM = "https://picsum.photos/seed";

/** Poster 3:4 (360×480) cho thẻ phim và danh sách. */
export const demoPosterUrl = (slug: string) =>
  demoImage(slug, "thumb") ?? `${PICSUM}/${slug}/600/800`;

/** Poster 3:4 (720×960) cho trang giới thiệu phim. */
export const demoPosterDetailUrl = (slug: string) =>
  demoImage(slug, "detail") ?? `${PICSUM}/${slug}/600/800`;

/** Ảnh hero 3:4 (900×1200) cho băng chuyền trang chủ. */
export const demoHeroUrl = (slug: string) =>
  demoImage(slug, "hero") ?? `${PICSUM}/${slug}-hero/800/1000`;
