// Chuỗi hiển thị của giao diện mới (docs/plans/gd3-netshort-ui.md). Tiếng Anh; gom một chỗ để sau này
// dịch được. Chuỗi cũ chưa chuyển sang đây; bước nào đụng tới màn hình nào thì chuyển chuỗi màn đó.

export const copy = {
  nav: {
    home: "Home",
    browse: "Browse",
    myList: "My List",
    vip: "VIP",
    account: "Account",
    search: "Search dramas",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    backToTop: "Back to top",
  },
  home: {
    hot: "Hot Shorts",
    newReleases: "New Releases",
    forYou: "You May Like",
    originals: "Originals",
    continueWatching: "Continue Watching",
  },
  series: {
    playNow: "Play now",
    watchNow: "Watch now",
    allEpisodes: "All episodes",
    episodeList: "Episode list",
    summary: "Summary",
    totalEpisodes: (n: number) => `${n} episodes`,
    episode: (n: number) => `EP ${n}`,
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
} as const;
