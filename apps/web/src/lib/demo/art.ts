// Ảnh poster cho bản demo (docs/plans/gd4-poster-images.md). 5 poster AI thật được xử lý bằng
// `uv run python -m app.cli poster-build` (cắt viền, ra thumb/detail/hero 3:4, WebP) và nằm ở
// public/demo/posters/<khóa>/. Phim demo nhiều hơn poster nên xoay vòng theo thứ tự phim.
// Phim lạ (không có trong bảng) dùng ảnh giữ chỗ picsum theo `seed` cố định.

const DEMO_POSTERS = [
  "soi_ve_doi_mon_no_nam_xua",
  "tong_tai_danh_ca_thanh_xuan_de_yeu_em",
  "bi_mat_trong_bong_toi",
  "vuong_phi_khong_de_choc",
  "nha_co_ba_chang_trai",
] as const;

/** Thứ tự slug phim demo; phim thứ i dùng poster thứ i mod 5. */
const DEMO_SLUGS = [
  "virtual-city",
  "memories-of-you",
  "love-again",
  "parallel-secrets",
  "summer-promise",
  "behind-the-lights",
  "sky-of-memories",
  "crack-in-time",
  "faded-moonlight",
  "twin-destinies",
  "the-one-in-my-dream",
] as const;

type Rendition = "thumb" | "detail" | "hero";

function posterKey(slug: string): string | null {
  const i = (DEMO_SLUGS as readonly string[]).indexOf(slug);
  return i < 0 ? null : DEMO_POSTERS[i % DEMO_POSTERS.length];
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
