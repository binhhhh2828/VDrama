// Dữ liệu chỉ có ở bản demo, API thật chưa có (docs/plans/gd3-netshort-ui.md, bước R0): nhãn góc
// poster, số lượt thích mẫu và vài bài "Reviews" biên tập. Không đưa vào data.json vì file đó phải
// giữ đúng định dạng response của API.

export type DemoBadge = "hot" | "original";

export type DemoReview = { title: string; body: string };

export type DemoExtras = {
  badge: DemoBadge | null;
  /** Lượt thích mẫu cố định (API thật chưa có "thích"). */
  likes: number;
  reviews: DemoReview[];
};

const EXTRAS: Record<string, DemoExtras> = {
  "virtual-city": {
    badge: "hot",
    likes: 21_400,
    reviews: [],
  },
  "memories-of-you": {
    badge: "hot",
    likes: 12_800,
    reviews: [],
  },
  "love-again": { badge: null, likes: 6_300, reviews: [] },
  "parallel-secrets": {
    badge: "original",
    likes: 9_700,
    reviews: [],
  },
  "summer-promise": { badge: null, likes: 4_100, reviews: [] },
  "behind-the-lights": { badge: "original", likes: 5_600, reviews: [] },
  "sky-of-memories": { badge: "hot", likes: 15_200, reviews: [] },
  "crack-in-time": { badge: "original", likes: 7_900, reviews: [] },
  "faded-moonlight": { badge: null, likes: 3_200, reviews: [] },
  "twin-destinies": { badge: null, likes: 2_700, reviews: [] },
  "the-one-in-my-dream": { badge: null, likes: 1_900, reviews: [] },
};

// Bài đánh giá chung, nối vào sau bài riêng của từng phim để trang xem luôn có nhiều review như NetShort.
const COMMON_REVIEWS: DemoReview[] = [
  {
    title: "Couldn't stop at one episode",
    body: "I only meant to watch the first one before bed. Every episode ends on a small hook, so I was three episodes deep before I noticed the time. The pacing is tight and nothing feels padded.",
  },
  {
    title: "The acting sells it",
    body: "Even in a few quiet seconds the leads say more with a look than most shows do with a speech. The close-ups are well chosen, and the score knows when to stay out of the way.",
  },
  {
    title: "Twist I did not see coming",
    body: "Around the middle the story flips what you thought you knew about one character. Looking back, the clues were there from the start, which makes a rewatch worth it.",
  },
  {
    title: "Perfect for a short break",
    body: "Episodes are short enough for a commute but the story keeps its depth. I like that the side characters get their own moments instead of only serving the main couple.",
  },
  {
    title: "Beautiful look, warm mood",
    body: "The colors and lighting give each scene a clear feeling. Night scenes feel cold, family scenes feel golden. It looks far more expensive than a series this short usually does.",
  },
  {
    title: "Slow burn done right",
    body: "The romance is not rushed. Small gestures build up until one line finally says it out loud, and by then you have been waiting for it for three episodes. Worth the wait.",
  },
];

const NONE: DemoExtras = { badge: null, likes: 0, reviews: [] };

/** Dữ liệu phụ của một phim demo; phim không có trong bảng thì trả giá trị rỗng. */
export const demoExtras = (slug: string): DemoExtras => {
  const own = EXTRAS[slug];
  if (!own) return NONE;
  return { ...own, reviews: [...own.reviews, ...COMMON_REVIEWS] };
};

/** Danh sách slug có dữ liệu phụ (cho test so khớp với data.json). */
export const demoExtrasSlugs = () => Object.keys(EXTRAS);
