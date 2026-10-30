// Bài viết MẪU cho trang News (nhãn PREVIEW). Chưa có API hay trang soạn bài; khi có thì xóa file này và
// nối trang vào API. Ảnh bìa là ảnh giữ chỗ cố định theo `slug`.

export type NewsArticle = {
  slug: string;
  tag: string;
  date: string;
  author: string;
  title: string;
  excerpt: string;
};

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: "behind-virtual-city",
    tag: "Behind the scenes",
    date: "2026-10-28",
    author: "VDrama Team",
    title:
      "Behind “Tổng Tài Dành Cả Thanh Xuân Để Yêu Em”: how an AI love story was built in six weeks",
    excerpt:
      "From the first script draft to the final colour grade, the team shares how a lonely coder and the AI she built came to life, and why episode 3 changes everything.",
  },
  {
    slug: "new-this-week",
    tag: "New releases",
    date: "2026-10-26",
    author: "VDrama Team",
    title: "Four new series land this week, and the first episodes are free",
    excerpt:
      "Romance, family comedy and a time-bending thriller join the catalogue. Here is what to watch first and where each story starts.",
  },
  {
    slug: "vip-explained",
    tag: "VIP",
    date: "2026-10-22",
    author: "VDrama Team",
    title: "VIP explained: no auto-renewals, no lost days",
    excerpt:
      "How VIP plans work, why we never charge you automatically, and how renewing early adds days on top of the time you already have.",
  },
  {
    slug: "watch-anywhere",
    tag: "Tips",
    date: "2026-10-18",
    author: "VDrama Team",
    title: "Pick up where you left off: watching on more than one device",
    excerpt:
      "Your list and progress follow your account. A quick guide to switching between phone and laptop without losing your place.",
  },
];

/** Ảnh bìa giữ chỗ 16:9, cố định theo slug. */
export const newsCoverUrl = (slug: string) => `https://picsum.photos/seed/news-${slug}/800/450`;
