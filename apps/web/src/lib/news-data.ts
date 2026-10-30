// Bài viết MẪU cho trang News (nhãn PREVIEW). Chưa có API hay trang soạn bài; khi có thì xóa file này và
// nối trang vào API. Chữ của bài (nhãn, tiêu đề, trích đoạn) nằm trong từ điển theo `key`; ảnh bìa là ảnh
// giữ chỗ cố định theo `slug`.

export type NewsArticle = {
  slug: string;
  /** Tiền tố khóa từ điển: `news.<key>Tag`, `news.<key>Title`, `news.<key>Excerpt`. */
  key: "behind" | "week" | "vip" | "tips";
  date: string;
};

export const NEWS_ARTICLES: NewsArticle[] = [
  { slug: "behind-loi-nguyen-duoi-anh-trang", key: "behind", date: "2026-10-28" },
  { slug: "new-this-week", key: "week", date: "2026-10-26" },
  { slug: "vip-explained", key: "vip", date: "2026-10-22" },
  { slug: "watch-anywhere", key: "tips", date: "2026-10-18" },
];

/** Ảnh bìa giữ chỗ 16:9, cố định theo slug. */
export const newsCoverUrl = (slug: string) => `https://picsum.photos/seed/news-${slug}/800/450`;
