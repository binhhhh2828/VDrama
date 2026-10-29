// Trạng thái của bản demo (tài khoản, phiên, lịch sử, My List) lưu trong localStorage của từng
// trình duyệt. Không có localStorage (server, chế độ riêng tư) thì dùng bộ nhớ tạm.

import { DEMO_PASSWORD } from "./config";

export type StoredUser = {
  id: number;
  email: string;
  display_name: string;
  role: "user" | "admin";
  password: string;
  created_at: string;
  vip_expires_at: string | null;
};

export type DemoState = {
  users: StoredUser[];
  nextUserId: number;
  /** Người đang đăng nhập (thay cho cookie phiên). */
  sessionUserId: number | null;
  /** userId → episodeId → tiến độ. */
  history: Record<string, Record<string, { progress_sec: number; updated_at: string }>>;
  /** userId → id phim, mới thêm đứng đầu. */
  favorites: Record<string, number[]>;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "vdrama-demo-v1";
const DAY = 86_400_000;

export function initialState(now = Date.now()): DemoState {
  const created = new Date(now).toISOString();
  return {
    users: [
      {
        id: 1,
        email: "viewer@example.com",
        display_name: "Demo Viewer",
        role: "user",
        password: DEMO_PASSWORD,
        created_at: created,
        vip_expires_at: null,
      },
      {
        id: 2,
        email: "vip@example.com",
        display_name: "Demo VIP",
        role: "user",
        password: DEMO_PASSWORD,
        created_at: created,
        vip_expires_at: new Date(now + 365 * DAY).toISOString(),
      },
      {
        id: 3,
        email: "admin@example.com",
        display_name: "Demo Admin",
        role: "admin",
        password: DEMO_PASSWORD,
        created_at: created,
        vip_expires_at: null,
      },
    ],
    nextUserId: 100,
    sessionUserId: null,
    history: {},
    favorites: {},
  };
}

export type DemoStore = {
  read(): DemoState;
  write(state: DemoState): void;
  reset(): void;
};

export function createStore(storage?: StorageLike | null, now: () => number = Date.now): DemoStore {
  let memory: DemoState | null = null;
  const safe = () => {
    try {
      return storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    } catch {
      return null; // truy cập localStorage có thể ném lỗi (chế độ riêng tư, bị chặn)
    }
  };

  return {
    read() {
      const s = safe();
      if (s) {
        try {
          const raw = s.getItem(KEY);
          if (raw) return JSON.parse(raw) as DemoState;
        } catch {
          // dữ liệu hỏng: bắt đầu lại từ trạng thái ban đầu
        }
      }
      return (memory ??= initialState(now()));
    },
    write(state) {
      memory = state;
      try {
        safe()?.setItem(KEY, JSON.stringify(state));
      } catch {
        // đầy bộ nhớ hoặc bị chặn: vẫn giữ trong bộ nhớ tạm của lần mở trang này
      }
    },
    reset() {
      memory = null;
      try {
        safe()?.removeItem(KEY);
      } catch {
        // bỏ qua
      }
    },
  };
}
