// Từ điển gốc (tiếng Anh) và là nguồn của kiểu `Dictionary`: file ngôn ngữ khác phải có đúng các khóa
// này nên thiếu khóa là lỗi biên dịch. Chuỗi có tham số viết `{tên}`; số nhiều viết `{ one, other }`.

export type Plural = { one: string; other: string };

export const en = {
  language: {
    label: "Language",
    choose: "Choose language",
    close: "Close",
  },
  nav: {
    home: "Home",
    browse: "Series",
    download: "Download",
    news: "News",
    myList: "My List",
    vip: "VIP",
    account: "Account",
    admin: "Admin",
    search: "Search",
    searchLabel: "Search dramas",
    menu: "Menu",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    backToTop: "Back to top",
  },
  footer: {
    about: "About",
    contact: "Contact us",
    explore: "Explore",
    rights: "VDrama | All Rights Reserved | 2026",
  },
  home: {
    hot: "Hot Shorts",
    newReleases: "New Releases",
    forYou: "You May Like",
    originals: "Originals",
    continueWatching: "Continue Watching",
    seeAll: "See all",
  },
  series: {
    playNow: "Play now",
    watchNow: "Watch now",
    allEpisodes: "All episodes",
    episodeList: "Episode list",
    summary: "Summary",
    totalEpisodes: { one: "{n} episode", other: "{n} episodes" } satisfies Plural,
    episode: "EP {n}",
  },
  watch: {
    recommended: "Recommended for You",
    latest: "Latest Picks",
    comingSoon: "Coming Soon",
    reviews: "Episode Reviews",
    seeMore: "See more",
  },
  promo: {
    getVip: "Get VIP",
    getVipLine: "Unlock every episode, no ads",
    dismiss: "Dismiss",
  },
  badge: {
    hot: "HOT",
    original: "ORIGINAL",
  },
};

/** Cây từ điển: lá là chuỗi hoặc `{ one, other }`. */
export type Dictionary = typeof en;
