// Ảnh poster cho bản demo (docs/plans/gd4-poster-images.md). 5 poster AI thật được xử lý bằng
// `uv run python -m app.cli poster-build` (cắt viền, ra thumb/detail/hero 3:4, WebP) và nằm ở
// public/demo/posters/<khóa>/. Mỗi phim demo một poster; phim không có trong bảng (bản nháp) dùng ảnh
// giữ chỗ picsum theo `seed` cố định.

const DEMO_POSTERS = [
  "vuong_phi_khong_de_choc",
  "nha_co_ba_chang_trai",
  "tien_duyen_ky_ngo",
  "hoa_tuyet_roi_day_troi",
  "kiem_khach_tinh_duyen",
] as const;

/** Slug phim demo có poster, cùng thứ tự với DEMO_POSTERS (phim thứ i dùng poster thứ i). */
const DEMO_SLUGS = [
  "vuong-phi-khong-de-choc",
  "nha-co-ba-chang-trai",
  "tien-duyen-ky-ngo",
  "hoa-tuyet-roi-day-troi",
  "kiem-khach-tinh-duyen",
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
