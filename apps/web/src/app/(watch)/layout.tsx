// Trang xem phim có khung riêng (header gọn, không có footer và thanh dưới đáy) để tập trung vào video.
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
