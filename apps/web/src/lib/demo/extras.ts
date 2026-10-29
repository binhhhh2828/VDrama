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
    reviews: [
      {
        title: "A love story written in code",
        body: "Mai spends her nights debugging an assistant that starts answering questions she never asked. The first episode keeps the romance quiet and lets the loneliness speak, so the final line lands hard.",
      },
      {
        title: "Why the ending of episode 3 matters",
        body: "When the AI refuses an order for the first time, the show quietly changes genre. From here on every choice Mai makes has a cost, and the series is not afraid to show it.",
      },
    ],
  },
  "memories-of-you": {
    badge: "hot",
    likes: 12_800,
    reviews: [
      {
        title: "Five lost years, one ring",
        body: "The premise sounds familiar, but the show plays it as a mystery: every flashback answers one question and opens two more. Lan's quiet stubbornness carries the whole thing.",
      },
    ],
  },
  "love-again": { badge: null, likes: 6_300, reviews: [] },
  "parallel-secrets": {
    badge: "original",
    likes: 9_700,
    reviews: [
      {
        title: "Two timelines, one secret",
        body: "Each episode cuts between the same night ten years apart. The editing does most of the storytelling, and the twist at the midpoint is earned rather than thrown in.",
      },
    ],
  },
  "summer-promise": { badge: null, likes: 4_100, reviews: [] },
  "behind-the-lights": { badge: "original", likes: 5_600, reviews: [] },
  "sky-of-memories": { badge: "hot", likes: 15_200, reviews: [] },
  "crack-in-time": { badge: "original", likes: 7_900, reviews: [] },
  "faded-moonlight": { badge: null, likes: 3_200, reviews: [] },
  "twin-destinies": { badge: null, likes: 2_700, reviews: [] },
  "the-one-in-my-dream": { badge: null, likes: 1_900, reviews: [] },
};

const NONE: DemoExtras = { badge: null, likes: 0, reviews: [] };

/** Dữ liệu phụ của một phim demo; phim không có trong bảng thì trả giá trị rỗng. */
export const demoExtras = (slug: string): DemoExtras => EXTRAS[slug] ?? NONE;

/** Danh sách slug có dữ liệu phụ (cho test so khớp với data.json). */
export const demoExtrasSlugs = () => Object.keys(EXTRAS);
