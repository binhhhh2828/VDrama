// Định dạng hiển thị dùng chung (tiếng Anh).

/** 1297 → "21 min"; 3725 → "1 h 2 min"; null → "". */
export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const minutes = Math.max(1, Math.round(sec / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Đồng hồ player: 75 → "1:15"; 3725 → "1:02:05". */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Tỉ lệ đã xem 0–1 (thời lượng không rõ thì 0). */
export function progressRatio(progressSec: number, durationSec: number | null | undefined): number {
  if (!durationSec || durationSec <= 0) return 0;
  return Math.min(Math.max(progressSec / durationSec, 0), 1);
}

/** Xem tới 95% (hoặc còn dưới 30 giây) coi như đã xem xong: mở lại thì phát từ đầu. */
export function isFinished(progressSec: number, durationSec: number | null | undefined): boolean {
  if (!durationSec || durationSec <= 0) return false;
  return progressSec >= durationSec * 0.95 || durationSec - progressSec < 30;
}

/** "12 min left" cho thẻ Continue watching; đã xong thì "Watched". */
export function timeLeft(progressSec: number, durationSec: number | null | undefined): string {
  if (!durationSec) return "";
  if (isFinished(progressSec, durationSec)) return "Watched";
  return `${formatDuration(durationSec - progressSec)} left`;
}

/** "12 episodes · Romance" cho thẻ phim. */
export function seriesMeta(s: { total_episodes: number | null; genres: { name: string }[] }) {
  const parts: string[] = [];
  if (s.total_episodes) parts.push(`${s.total_episodes} episodes`);
  if (s.genres[0]) parts.push(s.genres[0].name);
  return parts.join(" · ");
}

/** Ngày dạng "Nov 28, 2026" (UTC để server và trình duyệt ra cùng chuỗi). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** 12000 → "12K"; 1500000 → "1.5M". */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}
