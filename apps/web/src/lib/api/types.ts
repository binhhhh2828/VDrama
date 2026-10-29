// Kiểu dữ liệu response của API, viết tay theo docs/api.md. Đổi API thì sửa cả hai chỗ.

export type Genre = { slug: string; name: string };

export type SeriesStatus = "ongoing" | "completed";

export type SeriesCard = {
  id: number;
  slug: string;
  title: string;
  poster_url: string | null;
  banner_url: string | null;
  year: number | null;
  country: string | null;
  status: SeriesStatus;
  total_episodes: number | null;
  published_at: string | null;
  genres: Genre[];
};

export type SeriesDetail = SeriesCard & {
  description: string | null;
  episode_count: number;
  latest_episode_number: number | null;
  view_count: number;
  favorite_count: number;
  is_published: boolean;
};

export type EpisodeAccess = "free" | "vip";

export type Episode = {
  id: number;
  number: number;
  title: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  access: EpisodeAccess;
  published_at: string | null;
  is_published: boolean;
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export type SeriesSort = "new" | "hot";

export type UserRole = "user" | "admin";

export type User = {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
  vip_expires_at: string | null;
  is_vip: boolean;
};

export type PlayInfo = {
  episode_id: number;
  hls_url: string;
  dash_url: string;
  iframe_url: string;
  expires_at: string;
};

export type HistoryItem = {
  series: SeriesCard;
  episode: Episode;
  progress_sec: number;
  updated_at: string;
};

export type SeriesProgressItem = {
  episode_id: number;
  number: number;
  progress_sec: number;
  updated_at: string;
};

export type UploadTicket = { upload_url: string; video_id: string };

export type StreamStatus = "pending" | "uploading" | "processing" | "ready" | "error";

export type StreamSyncResult = {
  episode_id: number;
  video_id: string;
  stream_status: StreamStatus;
  duration_sec: number | null;
  thumbnail_url: string | null;
  result: "updated" | "unchanged" | "skipped_published";
};
